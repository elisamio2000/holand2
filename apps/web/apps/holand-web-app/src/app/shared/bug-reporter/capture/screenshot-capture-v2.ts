'use client';

import type { BugReportScreenshot } from '../types';

export type ScreenshotCaptureMethod = 'display_media' | 'html2canvas';

function bitmapToDataUrl(bitmap: ImageBitmap, quality = 0.92): string {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return canvas.toDataURL('image/png', quality);
}

async function captureViaDisplayMedia(): Promise<string> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('getDisplayMedia not supported');
  }

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'browser',
    } as MediaTrackConstraints,
    audio: false,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);

  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('No video track available');
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 150));

    if ('ImageCapture' in window) {
      const imageCapture = new (window as unknown as { ImageCapture: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }).ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();
      const dataUrl = bitmapToDataUrl(bitmap);
      bitmap.close();
      return dataUrl;
    }

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();

    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) resolve();
      else video.onloadeddata = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context unavailable');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/png', 0.92);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

async function captureViaHtml2Canvas(): Promise<string> {
  const html2canvas = (await import('html2canvas')).default;
  const scale = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = await html2canvas(document.documentElement, {
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale,
    backgroundColor: null,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    ignoreElements: (el) =>
      Boolean(
        el.classList?.contains('bug-report-fab-root') ||
          el.classList?.contains('unified-assistant-fab')
      ),
  });

  return canvas.toDataURL('image/png', 0.92);
}

/** Multi-strategy viewport screenshot: native display capture first, html2canvas fallback */
export async function captureViewportScreenshotV2(
  label?: string
): Promise<BugReportScreenshot & { method: ScreenshotCaptureMethod }> {
  let method: ScreenshotCaptureMethod = 'display_media';
  let dataUrl: string;

  try {
    dataUrl = await captureViaDisplayMedia();
  } catch {
    method = 'html2canvas';
    dataUrl = await captureViaHtml2Canvas();
  }

  return {
    timestamp: Date.now(),
    dataUrl,
    label,
    method,
  };
}
