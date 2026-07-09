/** Dev-only invariant warnings for MPS integration misuse. */

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (process.env.NODE_ENV === 'production') return;
  if (warned.has(key)) return;
  warned.add(key);
  console.error(`[MPS] ${message}`);
}

export function warnDualMediaOwnership(
  surface: string,
  hasMediaSessionId: boolean,
  hasLegacySyncRef: boolean
): void {
  if (!hasMediaSessionId || !hasLegacySyncRef) return;
  warnOnce(
    `dual-ownership:${surface}`,
    `${surface}: pass either mediaSessionId OR syncAudioRef/syncVideoRef, not both.`
  );
}

export function warnStickyVariantMisuse(): void {
  warnOnce(
    'sticky-variant',
    'AudioPlayer variant="sticky" is not supported — use GlobalAudioPlayerHost instead.'
  );
}

export function warnMediaPreviewSourceWithoutKey(
  prevKey: string,
  nextKey: string,
  src?: string
): void {
  if (prevKey === nextKey && src) {
    warnOnce(
      `preview-source:${prevKey}:${src}`,
      'useMediaPreview: src/artifactId changed but sessionKey did not — pass a stable sessionKey when identity changes.'
    );
  }
}

export function warnVideoEngineRegistryLeak(count: number, threshold: number): void {
  if (count <= threshold) return;
  warnOnce(
    'video-engine-registry-leak',
    `videoEngineRegistry has ${count} entries (threshold ${threshold}) — possible session leak.`
  );
}

export function warnPipWithoutSession(surface: string): void {
  warnOnce(
    `pip-without-session:${surface}`,
    `${surface}: in-app PiP opened without mediaSessionId — cold-start engine will mount. Prefer MPS session handoff.`
  );
}

export function warnExpandWithoutSession(surface: string): void {
  warnOnce(
    `expand-without-session:${surface}`,
    `${surface}: expand/modal opened with empty mediaSessionId — guard with useMpsExpandFilePreview.`
  );
}
