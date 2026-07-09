'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { PiCopy, PiEyedropper, PiPlus } from 'react-icons/pi';
import { ActionIcon, Button, Modal, Popover, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { useColorEyedropper } from './color-eyedropper-provider';
import { isEyeDropperSupported, pickColorWithFallback } from './lib/color-eyedropper';
import { COLOR_PRESETS, normalizeHexColor, resolveDisplayHex } from './lib/color-utils';

export interface AppColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  placeholder?: string;
  presets?: readonly string[];
  className?: string;
  allowClear?: boolean;
  onClear?: () => void;
  layout?: 'stacked' | 'inline';
}

export interface AppColorPickerCompactProps {
  value: string;
  onChange: (color: string) => void;
  presets?: readonly string[];
  disabled?: boolean;
  className?: string;
}

function useCompactViewport() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

function SwatchButton({
  display,
  ariaLabel,
  onClick,
  className,
}: {
  display: string;
  ariaLabel: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'h-5 w-5 shrink-0 rounded-sm border border-muted shadow-sm transition hover:ring-1 hover:ring-primary/30',
        className
      )}
      style={{ backgroundColor: display }}
      aria-label={ariaLabel}
      onClick={onClick}
    />
  );
}

function useColorPickerCommit(
  value: string,
  onChange: (color: string) => void,
  placeholder?: string
) {
  const display = resolveDisplayHex(value, placeholder ?? '#94a3b8');
  const [hexDraft, setHexDraft] = useState(value || '');
  const [pickerColor, setPickerColor] = useState(display);

  useEffect(() => {
    setHexDraft(value || '');
    setPickerColor(resolveDisplayHex(value, placeholder ?? '#94a3b8'));
  }, [value, placeholder]);

  const commit = useCallback(
    (raw: string) => {
      const n = normalizeHexColor(raw);
      if (n) {
        onChange(n);
        setHexDraft(n);
        setPickerColor(n);
      }
    },
    [onChange]
  );

  return { display, hexDraft, setHexDraft, pickerColor, setPickerColor, commit };
}

function ColorPickerPanel({
  label,
  value,
  onChange,
  placeholder,
  presets,
  onClose,
}: {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  placeholder?: string;
  presets: readonly string[];
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  const compactViewport = useCompactViewport();
  const startCustomEyedropper = useColorEyedropper();
  const { hexDraft, setHexDraft, pickerColor, setPickerColor, commit } = useColorPickerCommit(
    value,
    onChange,
    placeholder
  );

  const handleCopyHex = useCallback(async () => {
    const hex = normalizeHexColor(hexDraft) ?? normalizeHexColor(pickerColor) ?? pickerColor;
    try {
      await navigator.clipboard.writeText(hex);
      toast.success(t('colorPicker.copied'));
    } catch {
      toast.error(t('colorPicker.copyFailed'));
    }
  }, [hexDraft, pickerColor, t]);

  const handleEyedropper = useCallback(async () => {
    onClose?.();
    const hex = await pickColorWithFallback(startCustomEyedropper, {
      overlayDelayMs: compactViewport ? 360 : 220,
      preferNative: false,
    });
    if (hex) {
      commit(hex);
      return;
    }
    if (!startCustomEyedropper && !isEyeDropperSupported()) {
      toast.error(t('colorPicker.eyedropperUnsupported'));
    }
  }, [commit, compactViewport, onClose, startCustomEyedropper, t]);

  return (
    <div className="space-y-3">
      {label ? <Text className="text-sm font-medium">{label}</Text> : null}
      <HexColorPicker
        color={pickerColor}
        onChange={(c) => {
          setPickerColor(c);
          commit(c);
        }}
        className="!w-full max-w-[240px]"
      />
      <div className="flex items-end gap-1">
        <label className="board-field-group group min-w-0 flex-1 flex-col">
          <input
            type="text"
            className="board-field-input font-mono"
            value={hexDraft}
            placeholder={placeholder ?? '#000000'}
            onChange={(e) => {
              const raw = e.target.value;
              setHexDraft(raw);
              const n = normalizeHexColor(raw);
              if (n) {
                setPickerColor(n);
                onChange(n);
              }
            }}
            onBlur={() => {
              const n = normalizeHexColor(hexDraft);
              if (n) commit(n);
              else setHexDraft(value || '');
            }}
            aria-label={t('colorPicker.hex')}
          />
          <span className="board-field-underline" aria-hidden />
        </label>
        <Tooltip content={t('colorPicker.copy')} placement="top">
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label={t('colorPicker.copy')}
            onClick={() => void handleCopyHex()}
          >
            <PiCopy className="size-3.5" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('colorPicker.eyedropper')} placement="top">
          <ActionIcon
            size="sm"
            variant="outline"
            aria-label={t('colorPicker.eyedropper')}
            onClick={() => void handleEyedropper()}
          >
            <PiEyedropper className="size-3.5" />
          </ActionIcon>
        </Tooltip>
      </div>
      <div className="flex flex-wrap gap-1">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            className={cn(
              'size-5 rounded-full border-2 transition-transform hover:scale-110',
              pickerColor === c ? 'border-primary' : 'border-transparent'
            )}
            style={{ backgroundColor: c }}
            onClick={() => commit(c)}
            aria-label={c}
          />
        ))}
      </div>
    </div>
  );
}

export function AppColorPicker({
  label,
  value,
  onChange,
  placeholder,
  presets = COLOR_PRESETS,
  className,
  allowClear,
  onClear,
  layout = 'inline',
}: AppColorPickerProps) {
  const { t } = useTranslation();
  const compactViewport = useCompactViewport();
  const [open, setOpen] = useState(false);
  const { display } = useColorPickerCommit(value, onChange, placeholder);
  const swatchLabel = label ?? t('colorPicker.open');

  const pickerPanel = (
    <ColorPickerPanel
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      presets={presets}
      onClose={() => setOpen(false)}
    />
  );

  const swatchPicker = compactViewport ? (
    <>
      <SwatchButton display={display} ariaLabel={swatchLabel} onClick={() => setOpen(true)} />
      <Modal isOpen={open} onClose={() => setOpen(false)} size="sm">
        <div className="p-5">{pickerPanel}</div>
      </Modal>
    </>
  ) : (
    <Popover isOpen={open} setIsOpen={setOpen} placement="bottom-end">
      <Popover.Trigger>
        <SwatchButton display={display} ariaLabel={swatchLabel} />
      </Popover.Trigger>
      <Popover.Content className="z-[10060] w-auto p-3 shadow-lg">{pickerPanel}</Popover.Content>
    </Popover>
  );

  const clearBtn =
    allowClear && onClear ? (
      <Button size="sm" variant="text" className="shrink-0 px-0.5 text-[9px]" onClick={onClear}>
        {t('colorPicker.clear')}
      </Button>
    ) : null;

  if (layout === 'inline') {
    return (
      <div className={cn('flex items-center justify-between gap-2', className)}>
        {label ? <span className="min-w-0 shrink text-xs text-gray-500">{label}</span> : null}
        <div className="flex shrink-0 items-center gap-1.5">
          {swatchPicker}
          {clearBtn}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label ? <Text className="mb-1 text-xs text-gray-500">{label}</Text> : null}
      <div className="flex items-center gap-2">
        {swatchPicker}
        {clearBtn}
      </div>
    </div>
  );
}

/** Inline preset swatches + full picker popover (toolbars, folder rows). */
export function AppColorPickerCompact({
  value,
  onChange,
  presets = COLOR_PRESETS.slice(0, 6),
  disabled,
  className,
}: AppColorPickerCompactProps) {
  const { t } = useTranslation();
  const compactViewport = useCompactViewport();
  const [open, setOpen] = useState(false);
  const display = resolveDisplayHex(value);
  const isCustom = !presets.some(
    (p) => normalizeHexColor(p) === normalizeHexColor(value)
  );

  const commit = (raw: string) => {
    const n = normalizeHexColor(raw);
    if (n) onChange(n);
  };

  const customPicker = compactViewport ? (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'relative flex size-7 items-center justify-center rounded-full border-2 border-dashed border-muted transition hover:scale-105',
          isCustom && 'border-primary',
          disabled && 'opacity-40'
        )}
        style={isCustom ? { backgroundColor: display } : undefined}
        title={t('colorPicker.custom')}
        aria-label={t('colorPicker.custom')}
      >
        {!isCustom && (
          <span className="flex size-5 items-center justify-center rounded-full bg-gray-0/90 dark:bg-gray-50/90">
            <PiPlus className="h-3 w-3 text-gray-500" />
          </span>
        )}
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} size="sm">
        <div className="p-5">
          <ColorPickerPanel
            label={t('colorPicker.custom')}
            value={value}
            onChange={onChange}
            presets={presets}
            onClose={() => setOpen(false)}
          />
        </div>
      </Modal>
    </>
  ) : (
    <Popover isOpen={open} setIsOpen={setOpen} placement="bottom">
      <Popover.Trigger>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'relative flex size-7 items-center justify-center rounded-full border-2 border-dashed border-muted transition hover:scale-105',
            isCustom && 'border-primary',
            disabled && 'opacity-40'
          )}
          style={isCustom ? { backgroundColor: display } : undefined}
          title={t('colorPicker.custom')}
          aria-label={t('colorPicker.custom')}
        >
          {!isCustom && (
            <span className="flex size-5 items-center justify-center rounded-full bg-gray-0/90 dark:bg-gray-50/90">
              <PiPlus className="h-3 w-3 text-gray-500" />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Content className="z-[10060] p-3 shadow-lg">
        <ColorPickerPanel
          value={value}
          onChange={(c) => {
            commit(c);
          }}
          presets={presets}
          onClose={() => setOpen(false)}
        />
      </Popover.Content>
    </Popover>
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {presets.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          className={cn(
            'size-7 rounded-full border-2 transition-transform hover:scale-105',
            value === c ? 'scale-110 border-primary' : 'border-transparent',
            disabled && 'opacity-40'
          )}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
          aria-label={c}
          aria-pressed={value === c}
        />
      ))}
      {customPicker}
    </div>
  );
}
