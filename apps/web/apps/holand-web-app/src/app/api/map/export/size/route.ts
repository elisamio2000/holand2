// ============================================
// API: POST /api/map/export/size
// Returns estimated byte sizes for export items without actually
// building the ZIP. Used by MapExportPanel to show size hints before
// the user commits to an export.
//
// For PMTiles files: sends HTTP HEAD requests and reads Content-Length.
// For the SV folder: walks the JPEG files and sums their on-disk sizes.
// ============================================

import { type NextRequest, NextResponse } from 'next/server';
import { getTileServerUrl } from '@/lib/service-urls';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Sum total byte usage of a directory tree using `du -sb`.
 *
 * WHY spawnSync instead of recursive readdir/stat:
 *   XYZ tile directories may contain 1 M+ small files (one tile per file).
 *   Recursive stat() calls take 30+ seconds on large trees. `du -sb` reads
 *   directory metadata without opening file contents — completes in < 5 s.
 *
 * NOTE: Requires GNU coreutils `du` (standard on Linux). Falls back to 0 if
 * the command is unavailable.
 */
function sumDirBytes(dirPath: string): number {
  try {
    // spawnSync (not exec) — no shell interpolation, so dirPath cannot inject commands.
    const result = spawnSync('du', ['-sb', dirPath], { timeout: 30_000 });
    if (result.status !== 0 || !result.stdout) return 0;
    const bytes = parseInt(result.stdout.toString().split('\t')[0], 10);
    return Number.isNaN(bytes) ? 0 : bytes;
  } catch {
    return 0;
  }
}

/**
 * Tile server base URL (server-side only).
 * WHY: PMTiles URLs coming from the client are typically relative paths
 * like /api/tiles/middle-east.pmtiles. Server-side fetch cannot use relative
 * URLs, and going through the Next.js proxy would be wasteful. We hit the
 * tile server directly for size checks.
 */
interface SizeRequestBody {
  /** HTTP URLs to PMTiles (or any single-file tile archive) to size-check. */
  pmtilesUrls?: string[];
  /** Absolute server-side paths to street-view image folders. */
  streetViewFolders?: string[];
}

interface SizeEntry {
  /** Identifies which item this result belongs to. */
  key: string;
  /** Byte size, or null when it could not be determined. */
  bytes: number | null;
  /** Human-readable error if the size could not be fetched. */
  error?: string;
}

interface SizeResponseBody {
  results: SizeEntry[];
}

/**
 * POST /api/map/export/size
 *
 * Returns byte-size estimates for the requested export items without
 * building a ZIP. Clients use this to show size hints in the UI.
 *
 * @endpoint POST /api/map/export/size
 * @param body.pmtilesUrls       - Array of HTTP URLs to size-check via HEAD
 * @param body.streetViewFolders - Absolute paths to SV image folders
 * @returns SizeResponseBody with per-item byte counts (null = unknown)
 * @throws 400 on invalid JSON
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let tileServerUrl: string;
  try {
    tileServerUrl = getTileServerUrl();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'TILE_SERVER_URL is not configured';
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  let body: SizeRequestBody;
  try {
    body = (await request.json()) as SizeRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { pmtilesUrls, streetViewFolders } = body;
  const results: SizeEntry[] = [];

  console.info('[MapExportSize] Estimating sizes:', {
    pmtilesCount: pmtilesUrls?.length ?? 0,
    streetViewFolderCount: streetViewFolders?.length ?? 0,
  });

  // ── PMTiles files — Range request for Content-Range total size ──────
  for (const url of pmtilesUrls ?? []) {
    // Resolve relative /api/tiles/ paths directly to the tile server.
    // WHY: Server-side fetch cannot use relative URLs. /api/tiles/* is a
    // Next.js proxy — hitting it from the server itself adds unnecessary
    // overhead and the proxy may not forward Content-Length/Content-Range.
    // Going to TILE_SERVER_URL directly is the reliable path.
    let resolvedUrl: string;
    if (url.startsWith('/api/tiles/')) {
      const tilePath = url.slice('/api/tiles/'.length).replace(/\/$/, '');
      // Security: reject path traversal
      if (tilePath.includes('..') || tilePath.includes('%2e') || tilePath.includes('%2E')) {
        results.push({ key: url, bytes: null, error: 'Invalid tile path' });
        continue;
      }

      // XYZ tile directories have no file extension (e.g. satellite-modis, terrain-dem).
      // Size them via filesystem walk instead of a Range request to the tile server.
      if (path.extname(tilePath) === '') {
        const TILE_FILES_DIR_VAL = process.env.TILE_FILES_DIR?.replace(/\/$/, '') ?? '';
        if (!TILE_FILES_DIR_VAL) {
          console.warn('[MapExportSize] TILE_FILES_DIR not set — cannot size XYZ directory:', tilePath);
          results.push({ key: url, bytes: null, error: 'TILE_FILES_DIR not configured' });
          continue;
        }
        const dirPath = path.resolve(TILE_FILES_DIR_VAL, tilePath);
        // Security: ensure resolved path stays within TILE_FILES_DIR.
        if (!dirPath.startsWith(path.resolve(TILE_FILES_DIR_VAL))) {
          console.warn('[MapExportSize] Path traversal rejected:', { tilePath, dirPath });
          results.push({ key: url, bytes: null, error: 'Path traversal rejected' });
          continue;
        }
        if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
          console.warn('[MapExportSize] XYZ directory not found on disk:', dirPath);
          results.push({ key: url, bytes: null, error: 'Directory not found on disk' });
          continue;
        }
        const bytes = sumDirBytes(dirPath);
        console.info('[MapExportSize] XYZ directory sized:', { url, tilePath, bytes });
        results.push({ key: url, bytes });
        continue;
      }

      resolvedUrl = `${tileServerUrl}/${tilePath}`;
      console.info('[MapExportSize] Resolved tile path to server URL:', { url, resolvedUrl });
    } else if (/^https?:\/\//i.test(url)) {
      resolvedUrl = url;
    } else {
      results.push({ key: url, bytes: null, error: 'Unsupported URL format' });
      continue;
    }

    try {
      // Use Range: bytes=0-0 — PMTiles files are served by servers that support
      // range requests. The response includes Content-Range: bytes 0-0/TOTALSIZE.
      // This is more reliable than HEAD Content-Length across different servers.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const rangeRes = await fetch(resolvedUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // Cancel body immediately — only the headers matter.
      await rangeRes.body?.cancel();

      // Content-Range: bytes 0-0/12345678
      const cr = rangeRes.headers.get('content-range');
      const crMatch = cr?.match(/\/(\d+)$/);
      if (crMatch) {
        const bytes = parseInt(crMatch[1], 10);
        console.info('[MapExportSize] PMTiles size from Content-Range:', { url, bytes });
        results.push({ key: url, bytes });
        continue;
      }

      // Fallback: full Content-Length from a 200 response (small or non-range server)
      const cl = rangeRes.headers.get('content-length');
      if (cl) {
        const bytes = parseInt(cl, 10);
        console.info('[MapExportSize] PMTiles size from Content-Length:', { url, bytes });
        results.push({ key: url, bytes });
        continue;
      }

      console.warn('[MapExportSize] PMTiles size undetermined:', { url, status: rangeRes.status, cr });
      results.push({ key: url, bytes: null, error: 'Tile server did not return file size' });
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const msg = isAbort ? 'Tile server did not respond in time' : 'Could not reach tile server';
      console.warn('[MapExportSize] PMTiles size check failed:', { url, resolvedUrl, err });
      results.push({ key: url, bytes: null, error: msg });
    }
  }

  // ── Street-view folders — sum JPEG file sizes on disk per folder ──
  for (const folder of streetViewFolders ?? []) {
    const folderName = path.basename(folder);
    const key = `streetview/${folderName}`;

    // Security: reject non-absolute paths and path traversal.
    if (!path.isAbsolute(folder) || folder.includes('..')) {
      console.warn('[MapExportSize] Rejected unsafe streetViewFolder:', folder);
      results.push({ key, bytes: null, error: 'Invalid folder path' });
      continue;
    }
    try {
      const files = fs.readdirSync(folder).filter((f) => /\.jpe?g$/i.test(f));
      let totalBytes = 0;
      for (const f of files) {
        try {
          totalBytes += fs.statSync(path.join(folder, f)).size;
        } catch {
          // Skip unreadable files
        }
      }
      console.info('[MapExportSize] SV folder sized:', { folder: folderName, totalBytes, count: files.length });
      results.push({ key, bytes: totalBytes });
    } catch (err) {
      console.warn('[MapExportSize] Cannot read SV folder:', { folder, err });
      results.push({ key, bytes: null, error: 'Cannot read folder' });
    }
  }

  const response: SizeResponseBody = { results };
  return NextResponse.json(response);
}
