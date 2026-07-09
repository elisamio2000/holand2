'use client';

import { Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiXBold } from 'react-icons/pi';

interface WorkspaceSettingsStickyFooterProps {
  hint: string;
  onCancel?: () => void;
  onSave?: () => void;
  cancelLabel?: string;
  saveLabel?: string;
  dirty?: boolean;
  saving?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Flush sticky action bar — spans full card width with no bottom gap.
 */
export default function WorkspaceSettingsStickyFooter({
  hint,
  onCancel,
  onSave,
  cancelLabel,
  saveLabel,
  dirty = false,
  saving = false,
  className,
  children,
}: WorkspaceSettingsStickyFooterProps) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 border-t border-muted bg-gray-0 px-5 py-4',
        'shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.15)] dark:bg-gray-50',
        '@xl:-mx-6 @xl:-mb-6 @xl:px-6',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text className="text-xs text-gray-500">{hint}</Text>
        {children ?? (
          <div className="flex gap-2">
            {onCancel && cancelLabel && (
              <Button variant="outline" onClick={onCancel} disabled={!dirty || saving}>
                <PiXBold className="me-1 h-4 w-4" />
                {cancelLabel}
              </Button>
            )}
            {onSave && saveLabel && (
              <Button onClick={onSave} isLoading={saving} disabled={!dirty}>
                {saveLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
