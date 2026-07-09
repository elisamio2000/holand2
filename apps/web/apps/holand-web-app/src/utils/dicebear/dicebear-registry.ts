import type { Style } from '@dicebear/core';
import * as collection from '@dicebear/collection';

export type DiceBearStyleKey =
  | 'adventurer'
  | 'adventurerNeutral'
  | 'avataaars'
  | 'avataaarsNeutral'
  | 'bigEars'
  | 'bigEarsNeutral'
  | 'bigSmile'
  | 'bottts'
  | 'botttsNeutral'
  | 'croodles'
  | 'croodlesNeutral'
  | 'dylan'
  | 'funEmoji'
  | 'glass'
  | 'icons'
  | 'identicon'
  | 'initials'
  | 'lorelei'
  | 'loreleiNeutral'
  | 'micah'
  | 'miniavs'
  | 'notionists'
  | 'notionistsNeutral'
  | 'openPeeps'
  | 'personas'
  | 'pixelArt'
  | 'pixelArtNeutral'
  | 'rings'
  | 'shapes'
  | 'thumbs'
  | 'toonHead';

export interface DiceBearStyleEntry {
  key: DiceBearStyleKey;
  module: Style<unknown>;
}

export const DICEBEAR_STYLES: Record<DiceBearStyleKey, DiceBearStyleEntry> = {
  adventurer: { key: 'adventurer', module: collection.adventurer },
  adventurerNeutral: { key: 'adventurerNeutral', module: collection.adventurerNeutral },
  avataaars: { key: 'avataaars', module: collection.avataaars },
  avataaarsNeutral: { key: 'avataaarsNeutral', module: collection.avataaarsNeutral },
  bigEars: { key: 'bigEars', module: collection.bigEars },
  bigEarsNeutral: { key: 'bigEarsNeutral', module: collection.bigEarsNeutral },
  bigSmile: { key: 'bigSmile', module: collection.bigSmile },
  bottts: { key: 'bottts', module: collection.bottts },
  botttsNeutral: { key: 'botttsNeutral', module: collection.botttsNeutral },
  croodles: { key: 'croodles', module: collection.croodles },
  croodlesNeutral: { key: 'croodlesNeutral', module: collection.croodlesNeutral },
  dylan: { key: 'dylan', module: collection.dylan },
  funEmoji: { key: 'funEmoji', module: collection.funEmoji },
  glass: { key: 'glass', module: collection.glass },
  icons: { key: 'icons', module: collection.icons },
  identicon: { key: 'identicon', module: collection.identicon },
  initials: { key: 'initials', module: collection.initials },
  lorelei: { key: 'lorelei', module: collection.lorelei },
  loreleiNeutral: { key: 'loreleiNeutral', module: collection.loreleiNeutral },
  micah: { key: 'micah', module: collection.micah },
  miniavs: { key: 'miniavs', module: collection.miniavs },
  notionists: { key: 'notionists', module: collection.notionists },
  notionistsNeutral: { key: 'notionistsNeutral', module: collection.notionistsNeutral },
  openPeeps: { key: 'openPeeps', module: collection.openPeeps },
  personas: { key: 'personas', module: collection.personas },
  pixelArt: { key: 'pixelArt', module: collection.pixelArt },
  pixelArtNeutral: { key: 'pixelArtNeutral', module: collection.pixelArtNeutral },
  rings: { key: 'rings', module: collection.rings },
  shapes: { key: 'shapes', module: collection.shapes },
  thumbs: { key: 'thumbs', module: collection.thumbs },
  toonHead: { key: 'toonHead', module: collection.toonHead },
};

export const DICEBEAR_STYLE_KEYS = Object.keys(DICEBEAR_STYLES) as DiceBearStyleKey[];

export const DEFAULT_DICEBEAR_STYLE: DiceBearStyleKey = 'avataaars';

export function getDiceBearStyleModule(key: DiceBearStyleKey) {
  return DICEBEAR_STYLES[key].module;
}

export function getDiceBearStyleTitle(key: DiceBearStyleKey): string {
  return DICEBEAR_STYLES[key].module.meta?.title ?? key;
}
