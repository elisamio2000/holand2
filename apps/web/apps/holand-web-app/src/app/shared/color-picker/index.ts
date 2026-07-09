export {
  AppColorPicker,
  AppColorPickerCompact,
  type AppColorPickerCompactProps,
  type AppColorPickerProps,
} from './color-picker';

export { ColorEyedropperProvider, useColorEyedropper } from './color-eyedropper-provider';

export {
  BOARD_COLOR_PRESETS,
  COLOR_PRESETS,
  normalizeHexColor,
  resolveDisplayHex,
} from './lib/color-utils';

export {
  isEyeDropperSupported,
  pickColorFromScreen,
  pickColorWithFallback,
  type StartCustomEyedropper,
} from './lib/color-eyedropper';

export {
  colorFromElement,
  parseCssColorWithAlpha,
  sampleColorAtPoint,
  waitForOverlaysToClear,
  type RgbaColor,
} from './lib/color-sample';

/** Chat folder preset palette */
export const CHAT_FOLDER_COLOR_PRESETS = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
] as const;
