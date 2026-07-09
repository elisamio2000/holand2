/**
 * ZIP packaging for graph HTML exports (vendor scripts beside index.html).
 */

import JSZip from 'jszip';

export async function downloadGraphExplorerZip(
  folderName: string,
  indexHtml: string,
  vendorFiles: Record<string, string | Blob>
): Promise<void> {
  const zip = new JSZip();
  const root = zip.folder(folderName);
  if (!root) throw new Error('ZIP folder failed');
  root.file('index.html', indexHtml);
  const vendor = root.folder('vendor');
  if (!vendor) throw new Error('ZIP vendor folder failed');
  for (const [name, content] of Object.entries(vendorFiles)) {
    vendor.file(name, content);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
