// ============================================
// ImagePreviewModal — Full-screen image preview
// Triggered by clicking file attachments or inline images
// ============================================

'use client';
/* eslint-disable @next/next/no-img-element -- modal image preview from blob URL */

import { useCallback, useEffect, useState } from 'react';
import { PiX, PiDownloadSimple, PiMagnifyingGlassMinus, PiMagnifyingGlassPlus } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { chatService } from '@/services/chat.service';

interface ImagePreviewModalProps {
  /** Image URL or data URI */
  src: string;
  /** Image filename or alt text */
  name?: string;
  /** Callback to close the modal */
  onClose: () => void;
}

/**
 * ImagePreviewModal — Full-screen image preview with zoom controls.
 *
 * Features:
 * - Full-screen overlay with dark backdrop
 * - Zoom in/out controls
 * - Download button
 * - Click outside or ESC to close
 * - Responsive image sizing
 *
 * @example
 * ```tsx
 * {showPreview && (
 *   <ImagePreviewModal
 *     src={imageUrl}
 *     name="screenshot.png"
 *     onClose={() => setShowPreview(false)}
 *   />
 * )}
 * ```
 */
export default function ImagePreviewModal({
  src,
  name,
  onClose,
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(100);
  // ⚠️ Storage endpoints require JWT auth — load image as blob URL for display
  const [displaySrc, setDisplaySrc] = useState<string | null>(
    src.startsWith('blob:') || src.startsWith('data:') ? src : null
  );

  // Load authenticated image on mount if not a local blob/data URL
  useEffect(() => {
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      setDisplaySrc(src);
      return;
    }
    // Fetch with auth headers
    chatService.fetchAuthenticatedBlobUrl(src).then((blobUrl) => {
      setDisplaySrc(blobUrl ?? src); // Fallback to original src if auth fetch fails
    });
  }, [src]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.info('[ImagePreviewModal] Closing via ESC key');
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = useCallback(async () => {
    console.info('[ImagePreviewModal] Downloading image:', { name });
    try {
      // ⚠️ Storage endpoints require JWT auth — use chatService.downloadFile
      await chatService.downloadFile(src, name || 'image.png');
      console.info('[ImagePreviewModal] Image downloaded successfully');
    } catch (error) {
      console.error('[ImagePreviewModal] Failed to download image:', error);
    }
  }, [src, name]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 50));
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking the backdrop, not the image
    if (e.target === e.currentTarget) {
      console.info('[ImagePreviewModal] Closing via backdrop click');
      onClose();
    }
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-black/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white/90">
            {name || 'Image Preview'}
          </span>
          <span className="text-xs text-white/60">{zoom}%</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className={cn(
              'rounded p-2 text-white/80 transition-colors hover:bg-white/10',
              zoom <= 50 && 'cursor-not-allowed opacity-40'
            )}
            title="Zoom out"
          >
            <PiMagnifyingGlassMinus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className={cn(
              'rounded p-2 text-white/80 transition-colors hover:bg-white/10',
              zoom >= 200 && 'cursor-not-allowed opacity-40'
            )}
            title="Zoom in"
          >
            <PiMagnifyingGlassPlus className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="rounded p-2 text-white/80 transition-colors hover:bg-white/10"
            title="Download"
          >
            <PiDownloadSimple className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-2 text-white/80 transition-colors hover:bg-white/10"
            title="Close (ESC)"
          >
            <PiX className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Image — displays authenticated blob URL with zoom */}
      <div className="max-h-[90vh] max-w-[90vw] overflow-auto p-4">
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={name || 'Preview'}
            style={{ width: `${zoom}%`, height: 'auto' }}
            className="mx-auto rounded-lg shadow-2xl"
          />
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </div>
    </div>
  );
}
