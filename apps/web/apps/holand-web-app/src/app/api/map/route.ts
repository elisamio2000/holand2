// ============================================
// API: POST /api/map/export
// Assembles a ZIP archive containing the current map session:
//   • map-session.json  — full layer/viewport configuration
//   • screenshot.png    — PNG of the map canvas (from client base64)
//   • streetview/       — all JPEG images from the active SV folder (optional)
//   • custom-layers/    — inline GeoJSON layers as .geojson files (optional)
//
// WHY server-side: street-view images live on the server filesystem.
// Having the server read and zip them avoids transferring potentially
// hundreds of JPEG files through the browser round-trip.
// ============================================

import { type NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

interface GeoJsonLayerPayload {
  name: string;
  /** Inline GeoJSON — present when the layer was loaded from a local file */
  data?: object;
}

interface PmtilesExportEntry {
  /** Human-readable label used as the filename (without extension). */
  label: string;
  /**
   * URL for the tile resource:
   * - PMTiles archive: HTTP URL to a .pmtiles file
   * - XYZ tile directory: relative path like /api/tiles/satellite-modis/
   */
  url: string;
  /**
   * When true, this entry is an XYZ tile directory on the server filesystem.
   * The export route resolves it via TILE_FILES_DIR and walks the tree.
   */
  isDir?: boolean;
}

interface ExportRequestBody {
  /** Human-readable name for the export (used as filename). */
  sessionName: string;
  /** Full map session config — viewport + all active layer settings. */
  sessionConfig: object;
  /** PNG data URL from the MapLibre canvas (optional). */
  screenshotDataUrl?: string;
  /**
   * Absolute paths to one or more street-view image folders.
   * Only used when includeStreetViewImages is true.
   */
  streetViewFolders?: string[];
  /** Whether to bundle street-view JPEGs into the ZIP. */
  includeStreetViewImages?: boolean;
  /** GeoJSON layers with inline data to include as .geojson files. */
  geoJsonLayers?: GeoJsonLayerPayload[];
  /**
   * PMTiles (or other single-file tile archives) to download and bundle.
   * The server fetches each URL and stores the raw file under tiles/ in the ZIP.
   * Files larger than MAX_PMTILES_BYTES are skipped with a warning.
   */
  pmtilesFiles?: PmtilesExportEntry[];
}

/**
 * POST /api/map/export
 *
 * Creates and streams a ZIP containing the map session snapshot.
 *
 * @endpoint POST /api/map/export
 * @param body.sessionName        - Filename prefix for the ZIP
 * @param body.sessionConfig      - Full layer + viewport state object
 * @param body.screenshotDataUrl  - PNG base64 data URL (optional)
 * @param body.streetViewFolder   - Absolute server path to SV images (optional)
 * @param body.includeStreetViewImages - Whether to bundle SV JPEGs
 * @param body.geoJsonLayers      - Inline GeoJSON layers to bundle
 * @param body.pmtilesFiles        - PMTiles archives to fetch and bundle
 * @returns ZIP file download
 * @throws 400 on bad input, 500 on ZIP build failure
 */

/**
 * Maximum PMTiles file size we will attempt to load into memory (500 MB).
 * Files exceeding this are skipped to prevent OOM on large world tile archives.
 */
const MAX_PMTILES_BYTES = 500 * 1024 * 1024;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: ExportRequestBody;
  try {
    body = (await request.json()) as ExportRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    sessionName = 'map-export',
    sessionConfig,
    screenshotDataUrl,
    streetViewFolders,
    includeStreetViewImages,
    geoJsonLayers,
    pmtilesFiles,
  } = body;

  console.info('[MapExport] Building ZIP export:', {
    sessionName,
    hasScreenshot: !!screenshotDataUrl,
    streetViewFolders,
    includeStreetViewImages,
    geoJsonCount: geoJsonLayers?.length ?? 0,
    pmtilesCount: pmtilesFiles?.length ?? 0,
  });

  const zip = new JSZip();

  // ── 1. Session configuration ──────────────────────────────────────
  // Always included: the full map state so it can be replayed later.
  zip.file(
    'map-session.json',
    JSON.stringify(
      {
        _exportedAt: new Date().toISOString(),
        _version: '1.0',
        ...sessionConfig,
      },
      null,
      2
    )
  );

  // ── 2. Map screenshot ─────────────────────────────────────────────
  if (screenshotDataUrl) {
    // Strip the data URL header — JSZip expects raw base64 content.
    const base64 = screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file('screenshot.png', base64, { base64: true });
    console.info('[MapExport] Screenshot added to ZIP');
  }

  // ── 3. Street-view images ─────────────────────────────────────────
  if (streetViewFolders?.length && includeStreetViewImages) {
    // Security: validate every folder path before reading the filesystem.
    for (const folder of streetViewFolders) {
      if (!path.isAbsolute(folder) || folder.includes('..')) {
        console.warn('[MapExport] Rejected unsafe streetViewFolder:', folder);
        return NextResponse.json(
          { error: `streetViewFolders contains an unsafe path: ${folder}` },
          { status: 400 }
        );
      }
    }

    // Each folder gets its own subdirectory under streetview/<folderName>/.
    // WHY: keeps images from different capture sessions separate and identifiable.
    for (const folder of streetViewFolders) {
      if (!fs.existsSync(folder)) {
        console.warn('[MapExport] streetViewFolder not found on disk:', folder);
        continue;
      }
      const folderName = path.basename(folder);
      const svSubfolder = zip.folder('streetview')?.folder(folderName);
      let jpegFiles: string[] = [];
      try {
        jpegFiles = fs.readdirSync(folder).filter((f) => /\.jpe?g$/i.test(f));
      } catch (err) {
        console.warn('[MapExport] Cannot read streetViewFolder:', { folder, err });
        continue;
      }

      // Cap at 2000 images per folder to prevent extreme ZIP sizes.
      const MAX_IMAGES = 2000;
      if (jpegFiles.length > MAX_IMAGES) {
        console.warn('[MapExport] SV image count exceeds cap:', { folder, count: jpegFiles.length, cap: MAX_IMAGES });
        jpegFiles = jpegFiles.slice(0, MAX_IMAGES);
      }

      for (const file of jpegFiles) {
        try {
          const data = fs.readFileSync(path.join(folder, file));
          svSubfolder?.file(file, data);
        } catch {
          // Skip unreadable files silently
        }
      }
      console.info('[MapExport] Street-view images added:', { folder: folderName, count: jpegFiles.length });
    }
  }

  // ── 4. Inline GeoJSON layers ──────────────────────────────────────
  if (geoJsonLayers?.length) {
    const layersFolder = zip.folder('custom-layers');
    for (const layer of geoJsonLayers) {
      if (layer.data) {
        // Sanitize layer name for use as filename.
        const safeName = layer.name.replace(/[^a-z0-9_\-. ]/gi, '_') || 'layer';
        layersFolder?.file(`${safeName}.geojson`, JSON.stringify(layer.data, null, 2));
      }
    }
    console.info('[MapExport] GeoJSON layers added:', { count: geoJsonLayers.length });
  }

  // ── 5. PMTiles / tile-archive files ──────────────────────────────
  // The server fetches each PMTiles URL and stores it verbatim under
  // tiles/ so the user can drop the file straight into a local tile server.
  //
  // WHY server-side fetch instead of having the browser stream the file:
  // PMTiles files can be many GB. Having the server fetch them keeps the
  // client-side payload small and avoids CORS issues with tile servers that
  // only allow localhost access.
  if (pmtilesFiles?.length) {
    const tilesFolder = zip.folder('tiles');
    for (const entry of pmtilesFiles) {
      // ── XYZ tile directory (isDir) ─────────────────────────────
      if (entry.isDir) {
        const TILE_FILES_DIR_VAL = process.env.TILE_FILES_DIR?.replace(/\/$/, '') ?? '';
        if (!TILE_FILES_DIR_VAL) {
          console.warn('[MapExport] TILE_FILES_DIR not set — skipping isDir entry:', entry.url);
          continue;
        }
        // Parse tile dir name from /api/tiles/<name>/
        const tilePath = entry.url.replace(/^\/api\/tiles\//, '').replace(/\/$/, '');
        // Security: reject path traversal
        if (!tilePath || tilePath.includes('..') || tilePath.includes('%2e') || tilePath.includes('%2E')) {
          console.warn('[MapExport] Path traversal rejected for isDir entry:', entry.url);
          continue;
        }
        const dirPath = path.resolve(TILE_FILES_DIR_VAL, tilePath);
        if (!dirPath.startsWith(path.resolve(TILE_FILES_DIR_VAL))) {
          console.warn('[MapExport] Path traversal rejected:', { url: entry.url, dirPath });
          continue;
        }
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
          console.warn('[MapExport] XYZ directory not found on disk:', dirPath);
          continue;
        }
        // Size check via du -sb to avoid walking millions of small tile files.
        const duResult = spawnSync('du', ['-sb', dirPath], { timeout: 30_000 });
        const dirBytes = duResult.status === 0
          ? (parseInt(duResult.stdout.toString().split('\t')[0], 10) || 0)
          : 0;
        if (dirBytes > MAX_PMTILES_BYTES) {
          console.warn('[MapExport] XYZ directory exceeds size cap — adding note:', {
            label: entry.label,
            dirBytes,
            cap: MAX_PMTILES_BYTES,
          });
          const safeLbl = entry.label.replace(/[^a-z0-9_\-. ]/gi, '_');
          tilesFolder?.file(
            `${safeLbl}_TOO_LARGE.txt`,
            `Directory skipped: ${tilePath}\nReason: ${dirBytes} bytes exceeds the 500 MB in-memory limit.\nTo use offline: copy the directory to your local tile server's tiles/ folder.\n`
          );
          continue;
        }
        // Walk and add all tile files under tiles/<dirName>/
        const addDir = (srcDir: string, zipTarget: JSZip): void => {
          for (const name of fs.readdirSync(srcDir)) {
            const full = path.join(srcDir, name);
            if (fs.statSync(full).isDirectory()) {
              addDir(full, zipTarget.folder(name)!);
            } else {
              zipTarget.file(name, fs.readFileSync(full));
            }
          }
        };
        addDir(dirPath, tilesFolder!.folder(tilePath)!);
        console.info('[MapExport] XYZ directory bundled:', { label: entry.label, tilePath, dirBytes });
        continue;
      }

      // ── PMTiles archive (HTTP fetch) ───────────────────────────
      // Only allow http/https — block file:// or other schemes.
      if (!/^https?:\/\//i.test(entry.url)) {
        console.warn('[MapExport] Skipping non-HTTP PMTiles URL:', entry.url);
        continue;
      }
      try {
        // Pre-check size via HEAD to avoid loading a multi-GB file into memory.
        const headRes = await fetch(entry.url, { method: 'HEAD' });
        const cl = headRes.headers.get('content-length');
        if (cl && parseInt(cl, 10) > MAX_PMTILES_BYTES) {
          console.warn('[MapExport] PMTiles file exceeds size cap — skipping:', {
            url: entry.url,
            sizeBytes: parseInt(cl, 10),
            capBytes: MAX_PMTILES_BYTES,
          });
          // Write a README so the user knows why the file was omitted.
          const safeLbl = entry.label.replace(/[^a-z0-9_\-. ]/gi, '_');
          tilesFolder?.file(
            `${safeLbl}_TOO_LARGE.txt`,
            `File skipped: ${entry.url}\nReason: file is ${cl} bytes which exceeds the 500 MB in-memory limit.\nDownload it manually from the tile server and place it in this folder.\n`
          );
          continue;
        }

        const res = await fetch(entry.url);
        if (!res.ok) {
          console.warn('[MapExport] PMTiles fetch failed:', { url: entry.url, status: res.status });
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        // Use the label as filename; append .pmtiles if the URL has it.
        const ext = entry.url.toLowerCase().endsWith('.pmtiles') ? '.pmtiles' : '.tiles';
        const safeName2 = entry.label.replace(/[^a-z0-9_\-. ]/gi, '_');
        tilesFolder?.file(`${safeName2}${ext}`, buf);
        console.info('[MapExport] PMTiles added:', { label: entry.label, sizeBytes: buf.length });
      } catch (err) {
        console.warn('[MapExport] Could not fetch PMTiles:', { url: entry.url, err });
      }
    }
  }

  // ── 6. Generate ZIP and return as download ────────────────────────
  let zipBuffer: Buffer;
  try {
    zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      // Level 6 balances speed and size — images are already compressed so
      // higher levels add CPU time without meaningful size reduction.
      compressionOptions: { level: 6 },
    });
  } catch (err) {
    console.error('[MapExport] ZIP generation failed:', err);
    return NextResponse.json({ error: 'Failed to generate ZIP' }, { status: 500 });
  }

  const safeName = sessionName.replace(/[^a-z0-9_\-. ]/gi, '_') || 'map-export';
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `${safeName}_${timestamp}.zip`;

  console.info('[MapExport] ZIP ready:', { filename, sizeBytes: zipBuffer.length });

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.length),
      // Prevent browser caching of export files
      'Cache-Control': 'no-store',
    },
  });
}
