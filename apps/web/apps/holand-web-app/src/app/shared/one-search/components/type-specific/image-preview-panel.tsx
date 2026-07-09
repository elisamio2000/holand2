'use client';

import { Tooltip } from '@/components/tooltip';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import type { OneSearchHit, OneSearchQueryImage } from '@/types/one-search.types';
import { formatRelativeDate, formatFileSize } from '../../utils/format-date';
import {
  PiDownloadBold,
  PiShareNetworkBold,
  PiArrowsOutBold,
  PiScanBold,
} from 'react-icons/pi';
import { Button, ActionIcon } from 'rizzui';
import { useFilePreview } from '@/hooks/use-file-preview';
import { buildOneSearchUrl } from '../../utils/search-urls';
import { SearchHitThumbnail } from '../search-hit-thumbnail';
import { ImageHitCard, type ImageHitLayout } from '../image-hit-card';
import { artifactIdFromHit, downloadStorageArtifact } from '@/utils/storage-artifact-media';
import { queryImageFromHit } from '../../utils/visual-search-upload';
import { storageService } from '@/services/storage.service';
import toast from 'react-hot-toast';
import { HitMatchBadges } from '../hit-match-badges';
import { isQueryImageSelf } from '../../utils/hit-match-meta';
import {
  isLensSelectionValid,
  lensCropFromPointer,
  normalizeLensCrop,
} from '../../utils/lens-crop-utils';

export interface ImagePreviewPanelProps {
  image: OneSearchHit;
  allImages: OneSearchHit[];
  onImageSelect: (image: OneSearchHit) => void;
  onBack: () => void;
  onVisualSearch?: (queryImage: OneSearchQueryImage) => void;
  queryImageEcho?: string;
  viewMode?: ImageHitLayout;
  className?: string;
}

const ITEMS_PER_PAGE = 12;

export function ImagePreviewPanel({
  image,
  allImages,
  onImageSelect,
  onBack,
  onVisualSearch,
  queryImageEcho,
  viewMode = 'grid',
  className,
}: ImagePreviewPanelProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();
  const [currentPage, setCurrentPage] = useState(1);
  const [isLensMode, setIsLensMode] = useState(false);
  const [lensSelection, setLensSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const imageUrl = String(image.meta?.url || image.meta?.thumb_url || '');
  const artifactId = artifactIdFromHit(image.meta);
  const mimeType = String(image.meta?.mime || 'image/jpeg');
  const width = Number(image.meta?.width || 0);
  const height = Number(image.meta?.height || 0);
  const size = Number(image.meta?.size_bytes || 0);

  const similarImages = allImages
    .filter((img) => img.id !== image.id && !isQueryImageSelf(img, queryImageEcho))
    .slice(0, 8);

  const gridImages = allImages.filter((img) => img.id !== image.id);
  const totalPages = Math.ceil(gridImages.length / ITEMS_PER_PAGE);
  const safePage = Math.min(currentPage, Math.max(1, totalPages || 1));
  const paginatedImages = gridImages.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleExpandPreview = useCallback(() => {
    openFilePreview({
      src: artifactId
        ? storageService.getDownloadUrl(artifactId, 'inline')
        : imageUrl,
      name: image.title || 'image.jpg',
      mimeType,
      fileSize: size,
      artifactId,
    });
  }, [openFilePreview, artifactId, imageUrl, image.title, mimeType, size]);

  const handleDownload = useCallback(async () => {
    if (!artifactId) {
      toast.error(t('toast.failedDownloadFile', 'Download failed'));
      return;
    }
    try {
      await downloadStorageArtifact(artifactId, image.title);
      toast.success(t('common.download', 'Download'));
    } catch {
      toast.error(t('toast.failedDownloadFile', 'Download failed'));
    }
  }, [artifactId, image.title, t]);

  const handleLensPointerDown = useCallback((clientX: number, clientY: number) => {
    if (!isLensMode || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const { x, y } = lensCropFromPointer(rect, clientX, clientY);
    setDragStart({ x, y });
    setIsDragging(true);
    setLensSelection({ x, y, width: 0, height: 0 });
  }, [isLensMode]);

  const handleLensPointerMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStart || !imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const { x: currentX, y: currentY } = lensCropFromPointer(rect, clientX, clientY);
    setLensSelection({
      x: dragStart.x,
      y: dragStart.y,
      width: currentX - dragStart.x,
      height: currentY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const finalizeLensSelection = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (isLensSelectionValid(lensSelection)) {
      const crop = normalizeLensCrop(lensSelection);
      const queryImage = queryImageFromHit(image, crop);
      if (queryImage && onVisualSearch) {
        onVisualSearch(queryImage);
      } else if (queryImage) {
        const cropParam = `${crop.x},${crop.y},${crop.width},${crop.height}`;
        window.location.href = buildOneSearchUrl({
          mode: 'image',
          visualArtifact: queryImage.artifact_id,
          crop: cropParam,
        });
      }
    }
  }, [isDragging, lensSelection, image, onVisualSearch]);

  const handleLensMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleLensPointerDown(e.clientX, e.clientY);
  }, [handleLensPointerDown]);

  const handleLensMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    handleLensPointerMove(e.clientX, e.clientY);
  }, [handleLensPointerMove]);

  const handleLensMouseUp = useCallback(() => {
    finalizeLensSelection();
  }, [finalizeLensSelection]);

  const handleLensTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isLensMode || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleLensPointerDown(touch.clientX, touch.clientY);
  }, [handleLensPointerDown, isLensMode]);

  const handleLensTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleLensPointerMove(touch.clientX, touch.clientY);
  }, [handleLensPointerMove, isDragging]);

  const handleLensTouchEnd = useCallback(() => {
    finalizeLensSelection();
  }, [finalizeLensSelection]);

  const handleLensCancel = useCallback(() => {
    setIsLensMode(false);
    setLensSelection(null);
    setIsDragging(false);
    setDragStart(null);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setIsLensMode(false);
    setLensSelection(null);
    setIsDragging(false);
    setDragStart(null);
  }, [image.id]);

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-700"
        >
          ← {t('common.back')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {viewMode === 'masonry' ? (
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
              {paginatedImages.map((gridImage) => (
                <ImageHitCard
                  key={gridImage.id}
                  hit={gridImage}
                  layout="masonry"
                  queryImageEcho={queryImageEcho}
                  onClick={() => onImageSelect(gridImage)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {paginatedImages.map((gridImage) => (
                <ImageHitCard
                  key={gridImage.id}
                  hit={gridImage}
                  layout="grid"
                  queryImageEcho={queryImageEcho}
                  onClick={() => onImageSelect(gridImage)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previous')}
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600 dark:text-gray-400">
                {safePage} / {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                {t('common.next')}
              </Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-6 rounded-xl border border-muted bg-gray-0 p-6 shadow-sm dark:bg-gray-50">
            <div
              ref={imageContainerRef}
              className={cn(
                'relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-200/15',
                isLensMode && 'cursor-crosshair'
              )}
              style={{ height: '400px' }}
              onMouseDown={handleLensMouseDown}
              onMouseMove={handleLensMouseMove}
              onMouseUp={handleLensMouseUp}
              onMouseLeave={handleLensMouseUp}
              onTouchStart={handleLensTouchStart}
              onTouchMove={handleLensTouchMove}
              onTouchEnd={handleLensTouchEnd}
              onTouchCancel={handleLensTouchEnd}
            >
              {(artifactId || imageUrl) ? (
                <>
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
                    {artifactId ? (
                      <SearchHitThumbnail
                        hit={image}
                        className="h-full w-full max-h-full max-w-full"
                        objectFit="contain"
                        lazy={false}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={image.title}
                        className="max-h-full max-w-full select-none object-contain"
                        draggable={false}
                      />
                    )}
                  </div>

                  {isLensMode && (
                    <div className="pointer-events-none absolute inset-0 bg-blue-500/20">
                      {lensSelection && Math.abs(lensSelection.width) > 0 && Math.abs(lensSelection.height) > 0 && (
                        <div
                          className="absolute border-2 border-blue-500 bg-blue-500/10"
                          style={{
                            left: `${lensSelection.width >= 0 ? lensSelection.x : lensSelection.x + lensSelection.width}%`,
                            top: `${lensSelection.height >= 0 ? lensSelection.y : lensSelection.y + lensSelection.height}%`,
                            width: `${Math.abs(lensSelection.width)}%`,
                            height: `${Math.abs(lensSelection.height)}%`,
                          }}
                        />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-gray-400">No Image</span>
                </div>
              )}

              <div className="absolute bottom-2 end-2 flex gap-1">
                <Tooltip content={isLensMode ? t('common.cancel') : t('searchHub.googleLens')} placement="top">
                  <ActionIcon
                    size="sm"
                    variant="flat"
                    color={isLensMode ? 'danger' : 'secondary'}
                    onClick={() => (isLensMode ? handleLensCancel() : setIsLensMode(true))}
                  >
                    <PiScanBold className="h-4 w-4" />
                  </ActionIcon>
                </Tooltip>
                <Tooltip content={t('common.preview')} placement="top">
                  <ActionIcon
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onClick={handleExpandPreview}
                  >
                    <PiArrowsOutBold className="h-4 w-4" />
                  </ActionIcon>
                </Tooltip>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-700">
                {image.title}
              </h2>
              <HitMatchBadges
                hit={image}
                queryImageEcho={queryImageEcho}
                size="sm"
                className="mb-2"
              />
              <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {image.meta?.mime ? <p>{String(image.meta.mime)}</p> : null}
                {width && height ? <p>{width} × {height}</p> : null}
                {size > 0 ? <p>{formatFileSize(size)}</p> : null}
                <p>{formatRelativeDate(image.occurredAt || '')}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => void handleDownload()}>
                <PiDownloadBold className="me-1 h-4 w-4" />
                {t('common.download')}
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                <PiShareNetworkBold className="me-1 h-4 w-4" />
                {t('common.share')}
              </Button>
            </div>

            {image.snippet && (
              <div className="rounded-lg bg-gray-100/60 p-3 dark:bg-gray-200/10">
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-700">
                  OCR / {t('common.description')}
                </h3>
                <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-400">
                  {image.snippet}
                </p>
              </div>
            )}

            {image.meta?.tags && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-700">
                  {t('common.tags')}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {String(image.meta.tags).split(',').map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-200/15 dark:text-gray-400"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {similarImages.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-700">
                  {t('searchHub.similarImages')}
                </h3>
                <div className="max-h-[400px] space-y-2 overflow-y-auto pe-2">
                  {similarImages.map((similarImage) => {
                    const similarWidth = Number(similarImage.meta?.width || 0);
                    const similarHeight = Number(similarImage.meta?.height || 0);

                    return (
                      <button
                        key={similarImage.id}
                        type="button"
                        onClick={() => onImageSelect(similarImage)}
                        className="flex w-full gap-3 rounded-lg border border-transparent p-2 text-start transition-colors hover:border-muted hover:bg-gray-100 dark:hover:bg-gray-200/20"
                      >
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-200/15">
                          <SearchHitThumbnail hit={similarImage} className="h-full w-full" objectFit="cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="mb-1 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-700">
                            {similarImage.title}
                          </h4>
                          <HitMatchBadges
                            hit={similarImage}
                            queryImageEcho={queryImageEcho}
                            size="xs"
                          />
                          {similarWidth && similarHeight ? (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {similarWidth}×{similarHeight}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <Button
              variant="solid"
              className="w-full"
              onClick={() => {
                const searchQuery = image.title || `image:${image.id}`;
                window.location.href = buildOneSearchUrl({ q: searchQuery, mode: 'image' });
              }}
            >
              {t('searchHub.findSimilarImages')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImagePreviewPanel;
