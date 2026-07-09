// ============================================
// FileMetaRenderer — Display file.meta tool results
// Shows file metadata, hash, stats, and image dimensions
// ============================================

'use client';

import { Text, Badge } from 'rizzui';
import {
  PiFileDuotone,
  PiHashBold,
  PiClockBold,
  PiImageDuotone,
  PiMapPinDuotone,
} from 'react-icons/pi';

/**
 * Format bytes to human-readable size.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * MetaRow — Key-value display for metadata fields.
 */
function MetaRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1">
      {icon && <span className="mt-0.5 text-gray-400">{icon}</span>}
      <Text className="text-xs text-gray-500 dark:text-gray-400">{label}:</Text>
      <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">{value}</Text>
    </div>
  );
}

/**
 * FileMetaRenderer — Renders file.meta tool results.
 *
 * Displays:
 * - File path, name, extension
 * - MIME type and kind
 * - File size
 * - SHA256 hash
 * - Timestamps (modified, created, accessed)
 * - Image dimensions (if applicable)
 * - GPS location (if applicable)
 *
 * @param result - The tool result object from file.meta
 */
export default function FileMetaRenderer({ result }: { result: Record<string, any> }) {
  const data = result?.data || result;

  if (!data) {
    return (
      <Text className="text-xs text-gray-400">No metadata available</Text>
    );
  }

  const {
    filename,
    extension,
    mime_type,
    mime_description,
    kind,
    stats,
    sha256,
    metadata,
    location,
  } = data;

  return (
    <div className="space-y-3">
      {/* File Info */}
      <div>
        <Text className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
          <PiFileDuotone className="me-1 inline h-3.5 w-3.5" />
          File Information
        </Text>
        <div className="space-y-0.5 rounded border border-muted bg-white p-2 dark:bg-gray-50/5">
          {filename && <MetaRow label="Name" value={filename} />}
          {extension && <MetaRow label="Extension" value={extension} />}
          {mime_type && (
            <MetaRow
              label="MIME"
              value={
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" size="sm" className="font-mono text-xs">
                    {mime_type}
                  </Badge>
                  {kind && (
                    <Badge size="sm" className="text-xs">
                      {kind}
                    </Badge>
                  )}
                </div>
              }
            />
          )}
          {mime_description && (
            <Text className="text-xs text-gray-500">
              {mime_description}
            </Text>
          )}
        </div>
      </div>

      {/* File Stats */}
      {stats && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
            <PiClockBold className="me-1 inline h-3.5 w-3.5" />
            File Stats
          </Text>
          <div className="space-y-0.5 rounded border border-muted bg-white p-2 dark:bg-gray-50/5">
            {stats.size_bytes && (
              <MetaRow
                label="Size"
                value={`${formatBytes(stats.size_bytes)} (${stats.size_bytes.toLocaleString()} bytes)`}
              />
            )}
            {stats.modified_at && (
              <MetaRow
                label="Modified"
                value={new Date(stats.modified_at).toLocaleString()}
              />
            )}
            {stats.created_at && (
              <MetaRow
                label="Created"
                value={new Date(stats.created_at).toLocaleString()}
              />
            )}
          </div>
        </div>
      )}

      {/* SHA256 Hash */}
      {sha256 && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
            <PiHashBold className="me-1 inline h-3.5 w-3.5" />
            Hash
          </Text>
          <div className="rounded border border-muted bg-white p-2 dark:bg-gray-50/5">
            <Text className="break-all font-mono text-xs text-gray-600 dark:text-gray-400">
              {sha256}
            </Text>
          </div>
        </div>
      )}

      {/* Image Metadata */}
      {metadata?.image && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
            <PiImageDuotone className="me-1 inline h-3.5 w-3.5" />
            Image Properties
          </Text>
          <div className="space-y-0.5 rounded border border-muted bg-white p-2 dark:bg-gray-50/5">
            {metadata.image.width && metadata.image.height && (
              <MetaRow
                label="Dimensions"
                value={`${metadata.image.width} × ${metadata.image.height}`}
              />
            )}
            {metadata.image.mode && <MetaRow label="Mode" value={metadata.image.mode} />}
            {metadata.image.format && <MetaRow label="Format" value={metadata.image.format} />}
          </div>
        </div>
      )}

      {/* GPS Location */}
      {location && (location.latitude || location.longitude) && (
        <div>
          <Text className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400">
            <PiMapPinDuotone className="me-1 inline h-3.5 w-3.5" />
            Location
          </Text>
          <div className="space-y-0.5 rounded border border-muted bg-white p-2 dark:bg-gray-50/5">
            <MetaRow label="Latitude" value={location.latitude} />
            <MetaRow label="Longitude" value={location.longitude} />
            {location.altitude && <MetaRow label="Altitude" value={`${location.altitude}m`} />}
          </div>
        </div>
      )}
    </div>
  );
}
