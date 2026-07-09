// ============================================
// WorkflowShortcutsHelp — Keyboard shortcuts quick reference
// Shows overlay with available shortcuts
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useState } from 'react';
import { Text, ActionIcon } from 'rizzui';
import { PiKeyboardBold, PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';

const SHORTCUTS = [
  { keys: ['Del'], action: 'Delete selected node' },
  { keys: ['Ctrl', 'D'], action: 'Duplicate selected node' },
  { keys: ['Ctrl', '0'], action: 'Fit view to canvas' },
  { keys: ['Ctrl', 'L'], action: 'Auto-layout nodes' },
  { keys: ['Ctrl', '+'], action: 'Zoom in' },
  { keys: ['Ctrl', '-'], action: 'Zoom out' },
  { keys: ['Ctrl', 'S'], action: 'Save workflow' },
  { keys: ['Right-click'], action: 'Context menu' },
  { keys: ['Shift', 'Click'], action: 'Multi-select' },
  { keys: ['Drag'], action: 'Pan canvas' },
  { keys: ['Scroll'], action: 'Zoom in/out' },
];

export default function WorkflowShortcutsHelp() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <>
      <Tooltip content="Keyboard Shortcuts">
        <ActionIcon
          variant="outline"
          size="sm"
          onClick={() => setShow(true)}
          className="!border-muted !bg-white/80 !shadow-sm !backdrop-blur-sm dark:!bg-gray-100/80"
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
              <div className="flex items-center gap-2">
                <PiKeyboardBold className="h-5 w-5 text-primary" />
                <Text className="font-semibold">Keyboard Shortcuts</Text>
              </div>
              <button
                type="button"
                onClick={() => setShow(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"
              >
                <PiXBold className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              {SHORTCUTS.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-100"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    {s.action}
                  </span>
                  <div className="flex gap-1">
                    {s.keys.map((key) => (
                      <kbd
                        key={key}
                        className="rounded-md border border-muted bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-200"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-muted pt-3">
              <Text className="text-[10px] text-gray-400">
                Press <kbd className="rounded border border-muted bg-gray-100 px-1 text-[9px] dark:bg-gray-200">?</kbd> anytime to see this
              </Text>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
