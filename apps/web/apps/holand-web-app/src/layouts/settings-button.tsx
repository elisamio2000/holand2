'use client';

import { useEffect } from 'react';
import { useDirection } from '@core/hooks/use-direction';
import { PiGearBold } from 'react-icons/pi';
import { ActionIcon } from 'rizzui';
import cn from '@core/utils/class-names';
import { headerActionIconClass } from '@/layouts/header-action-icon-styles';
import { usePresets } from '@/config/color-presets';
import {
  useApplyColorPreset,
  useColorPresets,
} from '@/layouts/settings/use-theme-color';
import { useOpenSettingsDrawer } from '@/layouts/use-open-settings-drawer';

export default function SettingsButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const COLOR_PRESETS = usePresets();
  const openSettings = useOpenSettingsDrawer();
  const { direction } = useDirection();
  const { colorPresets } = useColorPresets();

  useApplyColorPreset<any>(colorPresets ?? COLOR_PRESETS[0].colors);

  useEffect(() => {
    document.documentElement.dir = direction ?? 'ltr';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  return (
    <ActionIcon
      aria-label="Settings"
      variant="text"
      className={cn(headerActionIconClass(), 'p-1', className)}
      onClick={openSettings}
    >
      {children ?? (
        <PiGearBold className="h-[18px] w-[18px] animate-spin-slow" aria-hidden />
      )}
    </ActionIcon>
  );
}
