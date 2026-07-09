/** Classify HTMLMediaElement.play() rejections — autoplay policy vs real errors. */

export function isAutoplayPolicyRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name ?? '';
  return name === 'NotAllowedError' || name === 'AbortError';
}

export function playRejectionMessage(err: unknown): string {
  if (isAutoplayPolicyRejection(err)) {
    return 'Playback blocked by browser autoplay policy';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Playback failed';
}
