'use client';

import cn from '@core/utils/class-names';
import type { OneSearchMode } from '@/types/one-search.types';

function Bone({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-gray-200 dark:bg-gray-200/30', className)} />;
}

export function TopInfoPanelsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', className)}>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col rounded-lg border border-muted bg-gray-0 p-4 shadow-sm dark:bg-gray-50">
          <div className="mb-3 flex items-center gap-2">
            <Bone className="h-8 w-8 rounded-lg" />
            <Bone className="h-4 w-24" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex flex-col items-center gap-2 rounded-md bg-gray-50 p-2.5 dark:bg-gray-100">
                <Bone className="h-5 w-10" />
                <Bone className="h-2.5 w-8" />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5 border-t border-muted pt-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between">
                <Bone className="h-3 w-20" />
                <Bone className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImageSliderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-muted bg-gray-0 p-3 shadow-sm dark:bg-gray-50', className)}>
      <div className="mb-2.5 flex items-center gap-2">
        <Bone className="h-8 w-8 rounded-lg" />
        <div className="space-y-1.5">
          <Bone className="h-3.5 w-20" />
          <Bone className="h-2.5 w-14" />
        </div>
      </div>
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <Bone key={i} className="h-[130px] w-[130px] shrink-0 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function LaneSectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-muted bg-gray-0 shadow-sm dark:bg-gray-50', className)}>
      <div className="flex items-center justify-between border-b border-muted px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Bone className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Bone className="h-3.5 w-24" />
            <Bone className="h-2.5 w-14" />
          </div>
        </div>
        <Bone className="h-6 w-20 rounded-md" />
      </div>
      <div className="divide-y divide-muted">
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-3 py-2.5">
            <div className="flex gap-3">
              <Bone className="h-7 w-7 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2">
                <Bone className="h-2.5 w-32" />
                <Bone className="h-3.5 w-3/4" />
                <Bone className="h-3 w-full" />
                <Bone className="h-3 w-2/3" />
                <div className="flex gap-2 pt-0.5">
                  <Bone className="h-2.5 w-12" />
                  <Bone className="h-2.5 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImageGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6', className)}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Bone key={i} className="aspect-square rounded-md" />
      ))}
    </div>
  );
}

export function MediaListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-muted p-3">
          <Bone className="h-16 w-16 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-full" />
            <Bone className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TextResultsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-muted p-4">
          <Bone className="h-4 w-3/4" />
          <Bone className="mt-2 h-3 w-full" />
          <Bone className="mt-1 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

export function SearchResultsSkeleton({
  mode = 'all',
  className,
}: {
  mode?: OneSearchMode;
  className?: string;
}) {
  if (mode === 'image') {
    return (
      <div className={cn('space-y-4', className)}>
        <Bone className="h-10 w-full max-w-xl rounded-md" />
        <ImageGridSkeleton />
      </div>
    );
  }
  if (mode === 'video' || mode === 'audio') {
    return (
      <div className={cn('space-y-4', className)}>
        <Bone className="h-10 w-full max-w-xl rounded-md" />
        <MediaListSkeleton />
      </div>
    );
  }
  if (mode === 'file') {
    return (
      <div className={cn('space-y-4', className)}>
        <Bone className="h-10 w-48 rounded-md" />
        <MediaListSkeleton />
      </div>
    );
  }
  if (mode === 'text') {
    return <TextResultsSkeleton className={className} />;
  }
  return (
    <div className={cn('space-y-4', className)}>
      <TopInfoPanelsSkeleton />
      <ImageSliderSkeleton />
      <LaneSectionSkeleton />
      <LaneSectionSkeleton />
      <LaneSectionSkeleton />
    </div>
  );
}
