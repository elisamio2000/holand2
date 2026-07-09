import { waitForOverlaysToClear } from './color-sample';

/** Screen color sampler via the EyeDropper API (Chrome, Edge, Opera). */
export function isEyeDropperSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'EyeDropper' in globalThis;
}

export async function pickColorFromScreen(): Promise<string | null> {
  if (!isEyeDropperSupported()) return null;
  try {
    const EyeDropperCtor = (
      globalThis as typeof globalThis & {
        EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper;
    const dropper = new EyeDropperCtor();
    const { sRGBHex } = await dropper.open();
    return sRGBHex;
  } catch {
    return null;
  }
}

export type StartCustomEyedropper = () => Promise<string | null>;

/**
 * Close overlays, then run custom in-app eyedropper (all browsers).
 * Falls back to native EyeDropper on desktop when custom handler is unavailable.
 */
export async function pickColorWithFallback(
  startCustom: StartCustomEyedropper | null,
  options?: { overlayDelayMs?: number; preferNative?: boolean }
): Promise<string | null> {
  const delay = options?.overlayDelayMs ?? 320;
  await waitForOverlaysToClear(delay);

  if (startCustom) {
    return startCustom();
  }

  if (options?.preferNative !== false && isEyeDropperSupported()) {
    return pickColorFromScreen();
  }

  return null;
}
