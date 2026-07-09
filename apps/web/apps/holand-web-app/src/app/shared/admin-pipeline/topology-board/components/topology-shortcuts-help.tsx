'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { Text, ActionIcon } from 'rizzui';
import { PiKeyboardBold, PiXBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';

const SHORTCUT_KEYS = [
  'delete',
  'duplicate',
  'fit',
  'layout',
  'zoomIn',
  'zoomOut',
  'save',
  'group',
  'undo',
  'redo',
  'context',
] as const;

export default function TopologyShortcutsHelp() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <>
      <Tooltip content={t('pipeline.topology.board.shortcuts.title', 'Keyboard shortcuts')}>
        <ActionIcon
          variant="outline"
          size="sm"
          onClick={() => setShow(true)}
          className="!border-muted"
        >
          <PiKeyboardBold className="h-4 w-4" />
        </ActionIcon>
      </Tooltip>

      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShow(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-muted bg-white p-5 shadow-2xl dark:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Text className="font-semibold">
                {t('pipeline.topology.board.shortcuts.title', 'Keyboard shortcuts')}
              </Text>
              <button type="button" onClick={() => setShow(false)} className="rounded-lg p-1 text-gray-400">
                <PiXBold className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {SHORTCUT_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs"
                >
                  <span className="text-gray-600">
                    {t(`pipeline.topology.board.shortcuts.${key}`, key)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
