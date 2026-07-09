/** Offloads heavy SVG→PNG rasterization when Worker + OffscreenCanvas are available. */
export async function rasterizeSvgToPngBlob(
  svg: string,
  width: number,
  height: number
): Promise<Blob | null> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  const workerCode = `
    self.onmessage = async (e) => {
      const { svg, width, height } = e.data;
      try {
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = await createImageBitmap(await fetch(url).then((r) => r.blob()));
        URL.revokeObjectURL(url);
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) { self.postMessage({ error: 'no-ctx' }); return; }
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const out = await canvas.convertToBlob({ type: 'image/png' });
        self.postMessage({ blob: out });
      } catch (err) {
        self.postMessage({ error: String(err) });
      }
    };
  `;

  return new Promise((resolve) => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (ev: MessageEvent<{ blob?: Blob; error?: string }>) => {
      worker.terminate();
      URL.revokeObjectURL(blob as unknown as string);
      resolve(ev.data.blob ?? null);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(null);
    };
    worker.postMessage({ svg, width, height });
  });
}
