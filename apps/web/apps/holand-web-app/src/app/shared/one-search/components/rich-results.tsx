'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { PiCaretDownBold, PiCaretUpBold, PiArrowRightBold } from 'react-icons/pi';
import StorageArtifactThumbnail from '@/components/storage-artifact-thumbnail';
import { useFilePreview } from '@/hooks/use-file-preview';
import { isProtectedStorageUrl } from '@/utils/storage-artifact-media';
import { storageService } from '@/services/storage.service';
import toast from 'react-hot-toast';

// Featured Snippet
export interface FeaturedSnippetProps {
  question: string;
  answer: string;
  source: {
    domain: string;
    path: string;
    url: string;
  };
  className?: string;
}

export function FeaturedSnippet({ question, answer, source, className }: FeaturedSnippetProps) {
  return (
    <div
      className={cn(
        'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800',
        'rounded-lg p-4 mb-6',
        className
      )}
    >
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {question}
      </h3>
      <div className="h-px bg-gray-200 dark:bg-gray-800 mb-3" />
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {answer}
      </p>
      <a
        href={source.url}
        className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400 hover:underline"
      >
        <span>🌐</span>
        <span>{source.domain}</span>
        <span className="text-gray-500">›</span>
        <span>{source.path}</span>
      </a>
    </div>
  );
}

// Image Pack
export interface ImagePackProps {
  images: Array<{
    id: string;
    url: string;
    thumb: string;
    title: string;
    /** Storage artifact UUID — enables JWT-safe thumbnail + preview */
    artifactId?: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
  totalCount: number;
  onViewAll?: () => void;
  className?: string;
}

export function ImagePack({ images, totalCount, onViewAll, className }: ImagePackProps) {
  const { t } = useTranslation();
  const { openFilePreview } = useFilePreview();

  const handleImageClick = (image: ImagePackProps['images'][number]) => {
    if (image.artifactId) {
      openFilePreview({
        src: storageService.getDownloadUrl(image.artifactId, 'inline'),
        name: image.title || 'image.jpg',
        mimeType: image.mimeType || 'image/jpeg',
        fileSize: image.sizeBytes,
        artifactId: image.artifactId,
      });
      return;
    }
    if (isProtectedStorageUrl(image.url)) {
      toast.error(t('common.previewFailed', 'Preview failed'));
      return;
    }
    window.open(image.url, '_blank');
  };

  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('searchHub.relatedImages')}
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {t('searchHub.viewAll')} {totalCount} {t('searchHub.images')}
            <PiArrowRightBold className="h-3 w-3" />
          </button>
        )}
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            className="flex-shrink-0 group"
            onClick={() => handleImageClick(image)}
          >
            <div className="w-[120px] h-[120px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
              {image.artifactId ? (
                <StorageArtifactThumbnail
                  artifactId={image.artifactId}
                  mimeType={image.mimeType || 'image/jpeg'}
                  mediaType="image"
                  alt={image.title}
                  className="h-full w-full group-hover:scale-105 transition-transform"
                  objectFit="cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.thumb}
                  alt={image.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate w-[120px]">
              {image.title}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

// People Also Ask
export interface PeopleAlsoAskProps {
  questions: Array<{
    question: string;
    answer: string;
  }>;
  className?: string;
}

export function PeopleAlsoAsk({ questions, className }: PeopleAlsoAskProps) {
  const { t } = useTranslation();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const toggleQuestion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className={cn('border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden mb-6', className)}>
      <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('searchHub.peopleAlsoAsk')}
        </h3>
      </div>
      
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {questions.map((item, index) => {
          const isExpanded = expandedIndex === index;
          
          return (
            <div key={index}>
              <button
                onClick={() => toggleQuestion(index)}
                className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-1">
                  {item.question}
                </span>
                {isExpanded ? (
                  <PiCaretUpBold className="h-4 w-4 text-gray-500 flex-shrink-0 mr-2" />
                ) : (
                  <PiCaretDownBold className="h-4 w-4 text-gray-500 flex-shrink-0 mr-2" />
                )}
              </button>
              
              {isExpanded && (
                <div className="px-4 pb-3 pt-1">
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const richResultsComponents = { FeaturedSnippet, ImagePack, PeopleAlsoAsk };
export default richResultsComponents;
