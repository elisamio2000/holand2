'use client';

import { ActionIcon, Button } from 'rizzui';
import { PiUserCircle } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { LabSection } from '@/platform/lab/lab-section';
import { Tooltip, PopoverTooltip, IconTooltip } from '@/components/tooltip';
import { useLanguage } from '@/providers/language-provider';

/**
 * SmartTooltip Lab — edge placement, RTL, and viewport scenarios.
 */
export function SmartTooltipLabPage() {
  const { t } = useTranslation();
  const { currentLanguage, changeLanguage, direction } = useLanguage();

  return (
    <div className="space-y-8 pb-10">
      <LabSection
        title="Language / RTL"
        description="Switch language — tooltips mirror placement and arrow tracks the trigger after layout flip."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => changeLanguage(currentLanguage === 'fa' ? 'en' : 'fa')}
          >
            {currentLanguage === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
          </Button>
          <span className="text-sm text-gray-500">
            Current: {currentLanguage} · dir={direction}
          </span>
        </div>
      </LabSection>

      <LabSection
        title="Header edge (preset=header-edge)"
        description="Simulates profile/notification cluster at viewport edge — arrow should point at trigger."
      >
        <div className="flex justify-end rounded-lg border border-dashed border-muted p-4">
          <PopoverTooltip label={t('header.profile.openMenu', 'Account menu')}>
            <ActionIcon aria-label="Account" variant="outline" className="rounded-full">
              <PiUserCircle className="h-5 w-5" />
            </ActionIcon>
          </PopoverTooltip>
        </div>
      </LabSection>

      <LabSection
        title="Placement matrix"
        description="All sides — verify flip/shift near viewport edges."
      >
        <div className="relative min-h-[280px] rounded-lg border border-muted p-6">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Tooltip content="Center bottom" placement="bottom">
              <Button size="sm" variant="outline">
                Center
              </Button>
            </Tooltip>
          </div>
          <div className="absolute left-4 top-4">
            <Tooltip content="Top start" placement="top-start">
              <Button size="sm" variant="outline">
                TL
              </Button>
            </Tooltip>
          </div>
          <div className="absolute right-4 top-4">
            <Tooltip content="Top end" placement="top-end" preset="header-edge">
              <Button size="sm" variant="outline">
                TR
              </Button>
            </Tooltip>
          </div>
          <div className="absolute bottom-4 left-4">
            <Tooltip content="Bottom start" placement="bottom-start">
              <Button size="sm" variant="outline">
                BL
              </Button>
            </Tooltip>
          </div>
          <div className="absolute bottom-4 right-4">
            <Tooltip content="Bottom end" placement="bottom-end" preset="header-edge">
              <Button size="sm" variant="outline">
                BR
              </Button>
            </Tooltip>
          </div>
        </div>
      </LabSection>

      <LabSection
        title="Icon toolbar preset"
        description="IconTooltip with toolbar preset and invert variant."
      >
        <IconTooltip content="Notifications" preset="toolbar">
          <ActionIcon aria-label="Notifications" variant="text">
            <PiUserCircle className="h-5 w-5" />
          </ActionIcon>
        </IconTooltip>
        <Tooltip content="Invert variant" color="invert" placement="bottom">
          <Button size="sm" variant="outline" className="ms-2">
            Invert
          </Button>
        </Tooltip>
      </LabSection>
    </div>
  );
}
