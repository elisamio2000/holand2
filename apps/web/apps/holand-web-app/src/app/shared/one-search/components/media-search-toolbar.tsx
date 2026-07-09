'use client';

import {
  ImageSearchToolbar,
  type ImageSearchToolbarProps,
} from './image-search-toolbar';

export type MediaKind = 'image' | 'video' | 'audio';

export interface MediaSearchToolbarProps extends ImageSearchToolbarProps {
  mediaKind: MediaKind;
}

/** Shared sort/filter toolbar — layout toggle only for image mode. */
export function MediaSearchToolbar({ mediaKind, ...rest }: MediaSearchToolbarProps) {
  return (
    <ImageSearchToolbar
      {...rest}
      mediaKind={mediaKind}
      showLayoutToggle={mediaKind === 'image'}
    />
  );
}
