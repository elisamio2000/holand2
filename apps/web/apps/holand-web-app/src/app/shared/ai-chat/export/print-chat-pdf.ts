import type { ConversationExportData, ExportOptions } from './export-types';
import { buildPrintReportHtml } from './build-interactive-chat-html';

/**
 * PDF export via the browser print pipeline using a clean, paginated A4 report.
 *
 * WHY print (not pdfmake/pdf-lib): those libraries cannot shape Persian/Arabic
 * (letters render disconnected/reversed). Printing the report HTML yields a
 * pixel-faithful, Persian-correct PDF with the app's design, fully offline.
 */
export async function printChatToPdf(
  data: ConversationExportData,
  options: ExportOptions
): Promise<void> {
  const html = await buildPrintReportHtml(data, {
    ...options,
    labels: options.labels,
  });

  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
  });
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1500);
  };

  await new Promise<void>((resolve, reject) => {
    iframe.onload = async () => {
      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        cleanup();
        reject(new Error('Print window unavailable'));
        return;
      }

      try {
        // Wait for embedded images (data URIs) to decode before printing,
        // so nothing is clipped or missing in the PDF.
        const images = Array.from(doc.images || []);
        await Promise.all(
          images.map((img) =>
            img.complete
              ? Promise.resolve()
              : new Promise<void>((res) => {
                  img.onload = () => res();
                  img.onerror = () => res();
                })
          )
        );

        // Let layout/fonts settle, then print.
        window.setTimeout(() => {
          win.focus();
          win.print();
          cleanup();
          resolve();
        }, 350);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      reject(new Error('Print document unavailable'));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  });
}
