'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiFolder, PiPlus, PiDotsThreeVertical, PiPencilSimple, PiTrash } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useDroppable } from '@dnd-kit/core';
import type { ChatSessionFolder } from '@/types/chat.types';
import FolderCreateModal from './folder-create-modal';

const DEFAULT_PUBLIC_SLUG = 'default_public';

interface SessionFoldersSectionProps {
  folders: ChatSessionFolder[];
  activeFolderId: string | null;
  onActiveFolderChange: (folderId: string | null) => void;
  isAvailable: boolean;
  isLoading?: boolean;
  onCreateFolder: (data: { name: string; color?: string }) => Promise<void>;
  onUpdateFolder: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onOpenDevPanel?: () => void;
}

function folderDisplayName(folder: ChatSessionFolder, t: (key: string) => string): string {
  if (folder.slug === DEFAULT_PUBLIC_SLUG) {
    return t('chatSidebar.folders.systemPublic');
  }
  if (folder.slug?.startsWith('surface:')) {
    const surfaceId = folder.slug.replace('surface:', '');
    const key = `chat.folders.surfaces.${surfaceId}`;
    const translated = t(key);
    return translated !== key ? translated : folder.name;
  }
  return folder.name;
}

function FolderDropRow({
  folder,
  isActive,
  onSelect,
  onRename,
  onDelete,
  readOnly,
}: {
  folder: ChatSessionFolder;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({ id: `folder-${folder.id}` });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors',
        isActive && 'bg-primary/10 text-primary',
        isOver && 'ring-2 ring-primary/40',
        !isActive && 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200/10'
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5">
        <PiFolder className="h-3.5 w-3.5 shrink-0" style={{ color: folder.color }} />
        <span className="truncate">{folderDisplayName(folder, t)}</span>
        {(folder.session_count ?? 0) > 0 && (
          <span className="shrink-0 text-[10px] text-gray-400">{folder.session_count}</span>
        )}
      </button>
      {!readOnly && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded p-0.5 opacity-0 group-hover:opacity-100"
            aria-label={t('common.more')}
          >
            <PiDotsThreeVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-full z-50 min-w-[120px] rounded-md border border-muted bg-gray-0 py-1 shadow-lg dark:bg-gray-50">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-200/10"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
              >
                <PiPencilSimple className="h-3.5 w-3.5" />
                {t('common.rename')}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <PiTrash className="h-3.5 w-3.5" />
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function FolderGroup({
  title,
  folders,
  activeFolderId,
  onActiveFolderChange,
  onRename,
  onDelete,
  readOnly,
}: {
  title: string;
  folders: ChatSessionFolder[];
  activeFolderId: string | null;
  onActiveFolderChange: (folderId: string | null) => void;
  onRename: (folder: ChatSessionFolder) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  if (folders.length === 0) return null;
  return (
    <div className="mb-2">
      <div className="mb-0.5 px-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        {title}
      </div>
      <ul className="space-y-0.5">
        {folders.map((folder) => (
          <FolderDropRow
            key={folder.id}
            folder={folder}
            isActive={activeFolderId === folder.id}
            onSelect={() => onActiveFolderChange(folder.id)}
            onRename={() => onRename(folder)}
            onDelete={() => void onDelete(folder.id)}
            readOnly={readOnly}
          />
        ))}
      </ul>
    </div>
  );
}

export default function SessionFoldersSection({
  folders,
  activeFolderId,
  onActiveFolderChange,
  isAvailable,
  isLoading,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onOpenDevPanel,
}: SessionFoldersSectionProps) {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ChatSessionFolder | null>(null);

  const publicFolders = folders.filter(
    (f) => f.slug === DEFAULT_PUBLIC_SLUG || (f.is_system && f.kind === 'system' && !f.slug?.startsWith('surface:'))
  );
  const surfaceFolders = folders.filter(
    (f) => f.is_system && f.slug?.startsWith('surface:') && (f.session_count ?? 0) > 0
  );
  const userFolders = folders.filter((f) => !f.is_system && f.kind !== 'system');

  if (isLoading) return null;

  if (!isAvailable && folders.length === 0) {
    return (
      <div className="border-b border-muted px-3 py-2">
        <p className="text-[10px] leading-snug text-gray-400">
          {t('chatSidebar.foldersHint')}{' '}
          {onOpenDevPanel && (
            <button type="button" className="text-primary underline" onClick={onOpenDevPanel}>
              {t('chatPage.backendPending.openDevChecklist')}
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-muted px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('chatSidebar.foldersTitle')}
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-gray-400 hover:text-primary"
            aria-label={t('chatSidebar.newFolder')}
            onClick={() => setCreateOpen(true)}
          >
            <PiPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onActiveFolderChange(null)}
          className={cn(
            'mb-1 w-full rounded px-1.5 py-1 text-start text-xs',
            activeFolderId === null
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-200/10'
          )}
        >
          {t('chatSidebar.allSessions')}
        </button>

        <FolderGroup
          title={t('chatSidebar.folders.systemPublic')}
          folders={publicFolders}
          activeFolderId={activeFolderId}
          onActiveFolderChange={onActiveFolderChange}
          onRename={setEditingFolder}
          onDelete={onDeleteFolder}
          readOnly
        />
        <FolderGroup
          title={t('chatSidebar.folders.fromPages')}
          folders={surfaceFolders}
          activeFolderId={activeFolderId}
          onActiveFolderChange={onActiveFolderChange}
          onRename={setEditingFolder}
          onDelete={onDeleteFolder}
          readOnly
        />
        <FolderGroup
          title={t('chatSidebar.folders.user')}
          folders={userFolders}
          activeFolderId={activeFolderId}
          onActiveFolderChange={onActiveFolderChange}
          onRename={setEditingFolder}
          onDelete={onDeleteFolder}
        />
      </div>

      <FolderCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreateFolder}
      />
      <FolderCreateModal
        isOpen={Boolean(editingFolder)}
        onClose={() => setEditingFolder(null)}
        onSubmit={async (data) => {
          if (editingFolder) await onUpdateFolder(editingFolder.id, data);
        }}
        initialName={editingFolder?.name ?? ''}
        initialColor={editingFolder?.color ?? undefined}
        titleKey="common.rename"
      />
    </>
  );
}
