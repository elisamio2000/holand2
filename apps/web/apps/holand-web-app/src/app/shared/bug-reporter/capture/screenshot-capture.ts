'use client';

import type { BugReportScreenshot } from '../types';
import { captureViewportScreenshotV2 } from './screenshot-capture-v2';

/** Capture current viewport as PNG data URL (multi-strategy) */
export async function captureViewportScreenshot(label?: string): Promise<BugReportScreenshot> {
  const result = await captureViewportScreenshotV2(label);
  const { method: _method, ...screenshot } = result;
  return screenshot;
}
