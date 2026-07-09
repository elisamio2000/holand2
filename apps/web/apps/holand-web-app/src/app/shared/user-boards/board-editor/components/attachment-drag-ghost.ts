import { storageService } from '@/services/storage.service';

/** Set a drag ghost image from an attachment thumbnail when possible. */
export function setAttachmentDragGhost(
  e: React.DragEvent,
  artifactId: string,
  name: string
): void {
  const el = document.createElement('div');
  el.className =
    'flex items-center gap-1 rounded border border-primary bg-white px-2 py-1 text-[10px] font-medium shadow-md';
  el.textContent = name.length > 24 ? `${name.slice(0, 22)}…` : name;
  el.style.position = 'absolute';
  el.style.top = '-1000px';
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 0, 0);
  requestAnimationFrame(() => {
    if (el.parentNode) document.body.removeChild(el);
  });

  const url = storageService.getDownloadUrl(artifactId, 'inline');
  if (url) {
    const img = new Image();
    img.onload = () => {
      try {
        e.dataTransfer.setDragImage(img, 24, 24);
      } catch {
        // drag may have ended
      }
    };
    img.src = url;
  }
}
