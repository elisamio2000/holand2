// ============================================
// PdfViewer â€” PDF document viewer with pagination
// Lazy-loaded to avoid pdfjs-dist webpack incompatibility
// ============================================

'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import cn from '@core/utils/class-names';

// WHY: pdfjs worker served from public/ for offline independence.
// The file is copied from node_modules/pdfjs-dist/build/pdf.worker.min.mjs
// via: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
// Run this copy whenever pdfjs-dist is updated.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * PdfViewerProps â€” Props for the PDF viewer component.
 */
interface PdfViewerProps {
  /** URL or base64 data of the PDF file */
  file: string;
}

/**
 * PdfViewer â€” Renders a PDF document with page navigation.
 *
 * Uses react-pdf (pdfjs-dist) for rendering. Must be loaded via
 * next/dynamic with ssr: false to avoid webpack ESM incompatibility.
 *
 * @param props.file - URL or base64 string of the PDF to display
 *
 * @example
 * ```tsx
 * const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false });
 * <PdfViewer file="/brand/brand-mark-4x.svg" />
 * ```
 */
export default function PdfViewer({ file }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  return (
    <div className="flex flex-col gap-3">
      <Document
        file={file}
        onLoadSuccess={({ numPages: total }) => {
          console.info('[PdfViewer] PDF loaded:', { numPages: total });
          setNumPages(total);
        }}
        onLoadError={(error: unknown) => {
          console.error('[PdfViewer] PDF load failed:', error);
        }}
        className="flex justify-center"
      >
        <Page
          pageNumber={pageNumber}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          className="shadow-lg"
        />
      </Document>

      {numPages && numPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-50 px-3 py-2 dark:bg-gray-100/50">
          <button
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber(pageNumber - 1)}
            className={cn(
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              pageNumber <= 1
                ? 'cursor-not-allowed text-gray-400'
                : 'text-primary hover:bg-primary/10'
            )}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pageNumber} of {numPages}
          </span>
          <button
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber(pageNumber + 1)}
            className={cn(
              'rounded px-3 py-1 text-sm font-medium transition-colors',
              pageNumber >= numPages
                ? 'cursor-not-allowed text-gray-400'
                : 'text-primary hover:bg-primary/10'
            )}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

