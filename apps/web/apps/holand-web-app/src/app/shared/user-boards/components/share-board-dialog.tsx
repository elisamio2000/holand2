'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, Text } from 'rizzui';
import { PiPaperPlaneTiltBold } from 'react-icons/pi';
import { boardService } from '../services/board.service';
import { formatBoardLinkMessageBody } from '@/app/shared/messages/components/board-link-message-card';
import { routes } from '@/config/routes';
import toast from 'react-hot-toast';

export interface ShareBoardDialogProps {
  boardId: string;
  boardTitle?: string;
  open: boolean;
  onClose: () => void;
}

export function ShareBoardDialog({ boardId, boardTitle, open, onClose }: ShareBoardDialogProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'read' | 'edit'>('read');
  const [userIds, setUserIds] = useState('');
  const [link, setLink] = useState<string | null>(null);

  const handleShare = async () => {
    const ids = userIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const result = await boardService.shareRemote(boardId, { mode, userIds: ids });
    if (result?.publicLink) {
      setLink(result.publicLink);
      toast.success(t('boards.shareSuccess', 'Share link created'));
    } else {
      toast.error(t('boards.shareMock', 'Backend not ready — share saved as local draft only'));
      setLink(`${window.location.origin}/boards/${boardId}?view=readOnly&share=${mode}`);
    }
  };

  const messengerBody = formatBoardLinkMessageBody(boardId, boardTitle);
  const messengerHref = `${routes.messagesCompose}?body=${encodeURIComponent(messengerBody)}`;

  return (
    <Modal isOpen={open} onClose={onClose} size="md">
      <div className="p-6">
        <Text className="mb-4 font-semibold">{t('boards.shareTitle', 'Share board')}</Text>
        <Select
          size="sm"
          label={t('boards.shareMode', 'Permission')}
          options={[
            { label: t('boards.readOnly', 'Read only'), value: 'read' },
            { label: t('boards.canEdit', 'Can edit'), value: 'edit' },
          ]}
          value={mode}
          onChange={(opt: { value: 'read' | 'edit' } | null) => {
            if (opt?.value) setMode(opt.value);
          }}
          className="mb-3"
        />
        <Input
          label={t('boards.shareUsers', 'User IDs (comma-separated)')}
          value={userIds}
          onChange={(e) => setUserIds(e.target.value)}
          placeholder="user-1, user-2"
          className="mb-4"
        />
        {link ? (
          <Text className="mb-4 break-all text-xs text-gray-600">{link}</Text>
        ) : null}
        <div className="mb-4">
          <Button size="sm" variant="outline" className="gap-1" as="span">
            <Link href={messengerHref}>
              <PiPaperPlaneTiltBold className="h-3.5 w-3.5" />
              {t('boards.shareToMessenger', 'Share in messenger')}
            </Link>
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleShare}>{t('boards.share', 'Share')}</Button>
        </div>
      </div>
    </Modal>
  );
}
