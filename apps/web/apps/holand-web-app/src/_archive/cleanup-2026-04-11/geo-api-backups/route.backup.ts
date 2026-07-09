// ============================================
// API Route: /api/geo/files — Fetch files with GPS from MongoDB
// Reads photo_tagger.files collection and returns GpsFile[]
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import type { Filter, Document } from 'mongodb';

// WHY force-dynamic: This route uses searchParams and connects to MongoDB.
// Static generation at build time would fail.
export const dynamic = 'force-dynamic';

/**
 * GET /api/geo/files — Fetch files with GPS coordinates from MongoDB.
 *
 * @endpoint GET /api/geo/files
 * @param searchParams.page - Page number (default: 1)
 * @param searchParams.per_page - Items per page (default: 100)
 * @param searchParams.date_start - Filter by EXIF start date (ISO string, file_meta.metadata.image.exif_clean.DateTime)
 * @param searchParams.date_end - Filter by EXIF end date (ISO string)
 * @param searchParams.camera - Filter by camera make/model
 * @param searchParams.has_gps - If "true", only files with GPS; if "false", all files; if "all", both (default: "true")
 * @param searchParams.tags - Comma-separated tag list for filtering (OR logic)
 * @param searchParams.case_ids - Comma-separated case ID list for filtering (OR logic)
 * @param searchParams.mime_types - Comma-separated MIME type list for filtering (OR logic)
 * @param searchParams.volume_labels - Comma-separated volume.label list for filtering ($in)
 * @param searchParams.filename - Filename substring for case-insensitive regex filtering
 * @param searchParams.metadata_stored_start - Filter by metadata_stored_at >= (ISO string)
 * @param searchParams.metadata_stored_end - Filter by metadata_stored_at <= (ISO string)
 * @param searchParams.tagged_at_start - Filter by tagged_at >= (ISO string)
 * @param searchParams.tagged_at_end - Filter by tagged_at <= (ISO string)
 * @param searchParams.thumbnail_at_start - Filter by thumbnail_at >= (ISO string)
 * @param searchParams.thumbnail_at_end - Filter by thumbnail_at <= (ISO string)
 * @param searchParams.fields - Response detail level: "minimal" (id, lat, lng, type, case_id) or "full" (default)
 * @returns GpsFilesResponse with files or markers array
 */
export async function GET(request: NextRequest) {
  console.info('[API/geo/files] Fetching files from MongoDB...');

  try {
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const perPage = parseInt(searchParams.get('per_page') || '100', 10);
    const dateStart = searchParams.get('date_start');
    const dateEnd = searchParams.get('date_end');
    const camera = searchParams.get('camera');
    const hasGps = searchParams.get('has_gps') || 'true';
    const tagsParam = searchParams.get('tags');
    const caseIdsParam = searchParams.get('case_ids');
    const mimeTypesParam = searchParams.get('mime_types');
    const volumeLabelsParam = searchParams.get('volume_labels');
    const filenameParam = searchParams.get('filename');
    const hasThumbnailParam = searchParams.get('has_thumbnail');
    const metadataStoredStart = searchParams.get('metadata_stored_start');
    const metadataStoredEnd = searchParams.get('metadata_stored_end');
    const taggedAtStart = searchParams.get('tagged_at_start');
    const taggedAtEnd = searchParams.get('tagged_at_end');
    const thumbnailAtStart = searchParams.get('thumbnail_at_start');
    const thumbnailAtEnd = searchParams.get('thumbnail_at_end');
    const fields = searchParams.get('fields') || 'full';

    const db = await getDatabase();
    const collection = db.collection('files');

    // Build query filter
    const filter: Filter<Document> = {};

    if (hasGps === 'true') {
      filter['file_meta.metadata.image.gps'] = { $exists: true, $ne: null };
    } else if (hasGps === 'all') {
      // no GPS filter — return all files
    }

    if (dateStart || dateEnd) {
      const dateFilter: Record<string, string> = {};
      if (dateStart) dateFilter.$gte = dateStart;
      if (dateEnd) dateFilter.$lte = dateEnd;
      filter['file_meta.metadata.image.exif_clean.DateTime'] = dateFilter;
    }

    if (camera) {
      // Support comma-separated camera values for multi-select
      const cameraList = camera.split(',').map((c) => c.trim()).filter(Boolean);
      if (cameraList.length === 1) {
        filter.$or = [
          { 'file_meta.metadata.image.exif_clean.Make': { $regex: cameraList[0], $options: 'i' } },
          { 'file_meta.metadata.image.exif_clean.Model': { $regex: cameraList[0], $options: 'i' } },
        ];
      } else if (cameraList.length > 1) {
        // WHY $or with $in-like pattern: Each camera name must match either Make or Model
        filter.$or = cameraList.flatMap((cam) => [
          { 'file_meta.metadata.image.exif_clean.Make': { $regex: cam, $options: 'i' } },
          { 'file_meta.metadata.image.exif_clean.Model': { $regex: cam, $options: 'i' } },
        ]);
      }
    }

    // Tag filter — OR logic: match if document has ANY of the specified tags
    // WHY dot notation: tags is stored as a dict {Blood: true, Fire: false},
    // so we check `tags.Blood: true` instead of `tags: { $in: ['Blood'] }`
    if (tagsParam) {
      const tagList = tagsParam.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length === 1) {
        filter[`tags.${tagList[0]}`] = true;
      } else if (tagList.length > 1) {
        // OR logic: match if ANY of the specified tags is true
        const tagOr = tagList.map((t) => ({ [`tags.${t}`]: true }));
        // Merge with existing $or if camera filter already created one
        if (filter.$or) {
          // WHY $and: camera filter already uses $or, so wrap both in $and
          filter.$and = [{ $or: filter.$or as Record<string, unknown>[] }, { $or: tagOr }];
          delete filter.$or;
        } else {
          filter.$or = tagOr;
        }
      }
    }

    // Case ID filter — OR logic: match if document belongs to ANY of the specified cases
    if (caseIdsParam) {
      const caseList = caseIdsParam.split(',').map((c) => c.trim()).filter(Boolean);
      if (caseList.length > 0) {
        filter['case_id'] = { $in: caseList };
      }
    }

    // MIME type filter — OR logic: match if document has ANY of the specified MIME types
    if (mimeTypesParam) {
      const mimeList = mimeTypesParam.split(',').map((m) => m.trim()).filter(Boolean);
      if (mimeList.length > 0) {
        filter['file_meta.mime_type'] = { $in: mimeList };
      }
    }

    // Volume label filter — $in on volume.label (replaces hostname)
    if (volumeLabelsParam) {
      const labelList = volumeLabelsParam.split(',').map((l) => l.trim()).filter(Boolean);
      if (labelList.length > 0) {
        filter['volume.label'] = { $in: labelList };
      }
    }

    // Filename filter — case-insensitive regex match on filename
    if (filenameParam) {
      filter['filename'] = { $regex: filenameParam, $options: 'i' };
    }

    // Thumbnail filter — only documents with a real (non-empty) thumbnail value
    if (hasThumbnailParam === 'true') {
      filter['thumbnail'] = { $exists: true, $nin: [null, ''] };
    }

    // metadata_stored_at date range — when metadata analysis ran
    if (metadataStoredStart || metadataStoredEnd) {
      const f: Record<string, string> = {};
      if (metadataStoredStart) f.$gte = metadataStoredStart;
      if (metadataStoredEnd) f.$lte = metadataStoredEnd;
      filter['metadata_stored_at'] = f as unknown as typeof filter[string];
    }

    // tagged_at date range — when the file was tagged
    if (taggedAtStart || taggedAtEnd) {
      const f: Record<string, string> = {};
      if (taggedAtStart) f.$gte = taggedAtStart;
      if (taggedAtEnd) f.$lte = taggedAtEnd;
      filter['tagged_at'] = f as unknown as typeof filter[string];
    }

    // thumbnail_at date range — when the thumbnail was generated
    if (thumbnailAtStart || thumbnailAtEnd) {
      const f: Record<string, string> = {};
      if (thumbnailAtStart) f.$gte = thumbnailAtStart;
      if (thumbnailAtEnd) f.$lte = thumbnailAtEnd;
      filter['thumbnail_at'] = f as unknown as typeof filter[string];
    }

    // Count total matching documents
    const total = await collection.countDocuments(filter);

    // Fetch documents
    const skip = (page - 1) * perPage;

    // WHY minimal projection: With 100K+ records, fetching all 22 fields
    // is 100MB+ of data. Minimal mode returns only 5 fields (~70B/record)
    // for map marker rendering. Full details are fetched on-demand.
    if (fields === 'minimal') {
      const projection = {
        _id: 1,
        'file_meta.metadata.image.gps.latitude': 1,
        'file_meta.metadata.image.gps.longitude': 1,
        'file_meta.mime_type': 1,
        case_id: 1,
      };

      const docs = await collection
        .find(filter)
        .project(projection)
        .sort({ metadata_stored_at: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray();

      console.info('[API/geo/files] Minimal documents fetched:', { total, returned: docs.length, page });

      const markers = docs
        .map((doc) => {
          const gps = doc.file_meta?.metadata?.image?.gps;
          if (!gps?.latitude || !gps?.longitude) return null;
          return {
            id: doc._id.toString(),
            lat: gps.latitude as number,
            lng: gps.longitude as number,
            type: (doc.file_meta?.mime_type as string) || 'image/jpeg',
            case_id: (doc.case_id as string) || undefined,
          };
        })
        .filter(Boolean);

      return NextResponse.json({
        success: true,
        total,
        page,
        per_page: perPage,
        returned: docs.length,
        files: [],
        markers,
      });
    }

    // Full mode — return complete GpsFile records
    const docs = await collection
      .find(filter)
      .sort({ metadata_stored_at: -1 })
      .skip(skip)
      .limit(perPage)
      .toArray();

    console.info('[API/geo/files] Documents fetched:', { total, returned: docs.length, page });

    // Transform MongoDB documents to GpsFile format
    const files = docs.map((doc) => {
      const gps = doc.file_meta?.metadata?.image?.gps;
      const exif = doc.file_meta?.metadata?.image?.exif_clean || {};
      const stats = doc.file_meta?.stats || {};
      const image = doc.file_meta?.metadata?.image || {};

      const cameraInfo = [exif.Make, exif.Model].filter(Boolean).join(' ') || undefined;

      // Parse EXIF DateTime for timestamp
      let datetime = doc.metadata_stored_at || new Date().toISOString();
      let timestamp = Math.floor(new Date(datetime).getTime() / 1000);

      if (exif.DateTime) {
        // EXIF DateTime format: "2025:10:13 00:12:19"
        const parts = exif.DateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
        const parsed = new Date(parts);
        if (!isNaN(parsed.getTime())) {
          datetime = parsed.toISOString();
          timestamp = Math.floor(parsed.getTime() / 1000);
        }
      }

      return {
        id: doc._id.toString(),
        path: doc.file_path || '',
        filename: doc.filename || doc.file_meta?.filename || '',
        type: doc.file_meta?.mime_type || 'image/jpeg',
        size: stats.size_bytes || 0,
        size_formatted: stats.size_formatted || '',
        case_id: doc.case_id || undefined,
        volume_label: doc.volume?.label || undefined,
        // WHY: tags is stored as dict {Blood: true, Fire: false}; extract active tag names
        tags:
          doc.tags && typeof doc.tags === 'object' && !Array.isArray(doc.tags)
            ? Object.entries(doc.tags as Record<string, boolean>)
                .filter(([, v]) => v === true)
                .map(([k]) => k)
            : Array.isArray(doc.tags)
              ? doc.tags
              : [],
        gps: gps
          ? {
              latitude: gps.latitude,
              longitude: gps.longitude,
              altitude: gps.altitude,
              source: gps.source || 'exif',
            }
          : null,
        datetime,
        timestamp,
        camera: cameraInfo,
        faces_count: 0,
        // Image dimensions
        width: image.width,
        height: image.height,
        format: image.format,
        metadata_stored_at: doc.metadata_stored_at || undefined,
        tagged_at: doc.tagged_at || undefined,
        // Origin info
        origin: doc.origin
          ? {
              hostname: doc.origin.hostname,
              ip: doc.origin.ip,
              os: doc.origin.os,
            }
          : undefined,
        // Thumbnail served via dedicated route to avoid bloating list responses
        thumbnail: doc.thumbnail ? `/api/geo/files/${doc._id.toString()}/thumbnail` : undefined,
      };
    });

    // Separate files with and without GPS
    const gpsFiles = files.filter((f) => f.gps !== null);
    const nonGpsFiles = files.filter((f) => f.gps === null);

    return NextResponse.json({
      success: true,
      total,
      page,
      per_page: perPage,
      files: gpsFiles,
      all_files: hasGps === 'all' ? files : undefined,
      non_gps_files: hasGps === 'all' ? nonGpsFiles : undefined,
      stats: {
        total_files: total,
        with_gps: gpsFiles.length,
        without_gps: nonGpsFiles.length,
        cameras: Array.from(new Set(files.map((f) => f.camera).filter(Boolean))),
      },
    });
  } catch (error: unknown) {
    console.error('[API/geo/files] Failed to fetch from MongoDB:', error);
    const message = error instanceof Error ? error.message : 'Database connection failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
