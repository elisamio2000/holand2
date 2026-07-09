'use client';

import { useEffect, useRef } from 'react';
import {
  PiDownloadSimpleBold,
  PiEyeBold,
  PiTrashBold,
  PiShareNetworkBold,
  PiInfoBold,
  PiPencilSimpleBold,
  PiFolderOpenBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { Artifact } from '@/types/storage.types';

export interface FileExplorerContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  artifact: Artifact | null;
  folderPath: string | null;
}

interface FileExplorerContextMenuProps {
  state: FileExplorerContextMenuState;
  labels: {
    preview: string;
    download: string;
    share: string;
    details: string;
    delete: string;
    rename: string;
    openFolder: string;
  };
  onClose: () => void;
  onPreview?: (artifact: Artifact) => void;
  onDownload?: (artifact: Artifact) => void;
  onShare?: (artifact: Artifact) => void;
  onDetails?: (artifact: Artifact) => void;
  onDelete?: (artifact: Artifact) => void;
  onRename?: (artifact: Artifact) => void;
  onOpenFolder?: (path: string) => void;
}

export default function FileExplorerContextMenu({
  state,
  labels,
  onClose,
  onPreview,
  onDownload,
  onShare,
  onDetails,
  onDelete,
  onRename,
  onOpenFolder,
}: FileExplorerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.visible) return;
    const onOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [state.visible, onClose]);

  if (!state.visible) return null;

  const artifact = state.artifact;

  const items: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }[] = [];

  if (artifact) {
    if (onPreview)
      items.push({
        label: labels.preview,
        icon: <PiEyeBold className="h-4 w-4" />,
        onClick: () => {
          onPreview(artifact);
          onClose();
        },
      });
    if (onDownload)
      items.push({
        label: labels.download,
        icon: <PiDownloadSimpleBold className="h-4 w-4" />,
        onClick: () => {
          onDownload(artifact);
          onClose();
        },
      });
    if (onShare)
      items.push({
        label: labels.share,
        icon: <PiShareNetworkBold className="h-4 w-4" />,
        onClick: () => {
          onShare(artifact);
          onClose();
        },
      });
    if (onDetails)
      items.push({
        label: labels.details,
        icon: <PiInfoBold className="h-4 w-4" />,
        onClick: () => {
          onDetails(artifact);
          onClose();
        },
      });
    if (onRename)
      items.push({
        label: labels.rename,
        icon: <PiPencilSimpleBold className="h-4 w-4" />,
        onClick: () => {
          onRename(artifact);
          onClose();
        },
      });
    if (artifact.folder_path && onOpenFolder)
      items.push({
        label: labels.openFolder,
        icon: <PiFolderOpenBold className="h-4 w-4" />,
        onClick: () => {
          onOpenFolder(artifact.folder_path!);
          onClose();
        },
      });
    if (onDelete)
      items.push({
        label: labels.delete,
        icon: <PiTrashBold className="h-4 w-4" />,
        danger: true,
        onClick: () => {
          onDelete(artifact);
          onClose();
        },
      });
  } else if (state.folderPath && onOpenFolder) {
    items.push({
      label: labels.openFolder,
      icon: <PiFolderOpenBold className="h-4 w-4" />,
      onClick: () => {
        onOpenFolder(state.folderPath!);
        onClose();
      },
    });
  }

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[180px] rounded-lg border border-muted bg-gray-0 py-1 shadow-lg dark:bg-gray-50"
      style={{ left: state.x, top: state.y }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={item.onClick}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-100/10',
            item.danger && 'text-red-600 hover:bg-red-50 dark:text-red-400'
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
