'use client';

import { PlaybackSurface } from './playback-surface';
import type { VariantProps } from '../types';

export function AdvancedVariant(props: VariantProps) {
  return <PlaybackSurface {...props} />;
}
