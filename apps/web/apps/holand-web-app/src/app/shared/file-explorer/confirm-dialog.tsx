// ============================================
// ConfirmDialog — Modal-based confirmation prompt (v0.44.0)
// Returns a Promise<boolean> resolved by the user's choice.
// Uses RizzUI Modal + jotai-backed useModal store from /shared/modal-views.
// ============================================

'use client';

import { Button, Title, Text, ActionIcon } from 'rizzui';
import { PiWarningBold, PiXBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import { useModal } from '@/app/shared/modal-views/use-modal';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true → use red destructive styling on the confirm button. */
  destructive?: boolean;
  onResolve: (confirmed: boolean) => void;
}

/**
 * Internal view rendered inside the global modal slot.
 * Calls `onResolve(true|false)` then closes the modal.
 */
function ConfirmDialogView({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onResolve,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');
  const { closeModal } = useModal();

  const handle = (value: boolean) => {
    onResolve(value);
    closeModal();
  };

  return (
    <div className="m-auto p-5">
      {/* Header */}
      <div className="mb-3 flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            destructive
              ? 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
              : 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
          )}
        >
          <PiWarningBold className="h-5 w-5" />
        </div>
        <div className="flex-1 pt-0.5">
          <Title as="h4" className="text-base font-semibold text-gray-900 dark:text-gray-700">
            {title}
          </Title>
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">{message}</Text>
        </div>
        <ActionIcon
          variant="text"
          size="sm"
          onClick={() => handle(false)}
          aria-label={t('common.close')}
        >
          <PiXBold className="h-4 w-4" />
        </ActionIcon>
      </div>

      {/* Footer actions */}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => handle(false)}>
          {resolvedCancelLabel}
        </Button>
        <Button
          size="sm"
          color={destructive ? 'danger' : 'primary'}
          onClick={() => handle(true)}
        >
          {resolvedConfirmLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * useConfirmDialog — returns an async `confirm()` helper.
 *
 * @example
 * ```tsx
 * const confirm = useConfirmDialog();
 * if (await confirm({ title: 'Delete?', message: 'This action is irreversible' })) {
 *   await doDelete();
 * }
 * ```
 */
export function useConfirmDialog() {
  const { openModal } = useModal();

  /**
   * Open a confirmation dialog and resolve with the user's choice.
   * @returns Promise resolving to `true` for confirm and `false` for cancel.
   */
  return (opts: Omit<ConfirmDialogProps, 'onResolve'>): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      openModal({
        size: 'sm',
        view: <ConfirmDialogView {...opts} onResolve={resolve} />,
      });
    });
}
