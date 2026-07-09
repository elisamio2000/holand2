'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretDownBold, PiCaretUpBold } from 'react-icons/pi';
import { Badge, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PROFILE_BACKEND_CAPABILITY_GAPS,
  profileGapI18nKey,
  type ProfileBackendCapabilityGap,
  type ProfileBackendGapPriority,
} from '@/app/shared/account-settings/config/profile-backend-capability-gaps';
import { PROFILE_API_REQUIREMENTS } from '@/app/shared/account-settings/config/profile-api-requirements';

const showDevPanel =
  process.env.NEXT_PUBLIC_PROFILE_DEV_PANEL === 'true' ||
  process.env.NODE_ENV === 'development';

function priorityColor(p: ProfileBackendGapPriority): 'danger' | 'warning' | 'secondary' {
  if (p === 'P0') return 'danger';
  if (p === 'P1') return 'warning';
  return 'secondary';
}

function apiStatusBadgeColor(
  status: string
): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'live') return 'success';
  if (status === 'partial') return 'warning';
  return 'danger';
}

function GapRow({ gap }: { gap: ProfileBackendCapabilityGap }) {
  const { t } = useTranslation();
  const baseKey = profileGapI18nKey(gap.id);
  const capability = t(`${baseKey}.capability`, gap.capability);
  const acceptance = t(`${baseKey}.acceptance`, gap.acceptance);

  return (
    <tr className="border-b border-muted/60 last:border-0">
      <td className="px-2 py-2 align-top text-[11px] font-medium">{capability}</td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">{gap.feWorkaround}</td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {gap.feRequest}
      </td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {gap.expectedResponse}
      </td>
      <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-primary">
        {gap.requiredApi}
      </td>
      <td className="px-2 py-2 align-top">
        {gap.resolved ? (
          <Badge color="success" rounded="md" className="text-[10px]">
            {t('account.devRequirements.resolved')}
          </Badge>
        ) : (
          <Badge color={priorityColor(gap.priority)} rounded="md" className="text-[10px]">
            {t(`account.devRequirements.priority.${gap.priority}`)}
          </Badge>
        )}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">
        {t(`account.devRequirements.surfaces.${gap.uiSurface}`)}
      </td>
      <td className="px-2 py-2 align-top text-[10px] text-gray-500">{acceptance}</td>
    </tr>
  );
}

export default function ProfileDevRequirementsPanel() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!showDevPanel) return null;

  const cols = t('account.devRequirements.columns', { returnObjects: true }) as Record<
    string,
    string
  >;
  const liveCols = t('account.devRequirements.liveApis.columns', {
    returnObjects: true,
  }) as Record<string, string>;

  return (
    <div
      id="profile-dev-requirements-panel"
      className="mx-auto mt-6 w-full max-w-screen-2xl rounded-lg border border-dashed border-muted bg-gray-0/80 p-3 dark:bg-gray-50/80"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left text-xs font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-100/5 dark:hover:text-gray-300"
      >
        <span>{t('account.devRequirements.toggle')}</span>
        {open ? (
          <PiCaretUpBold className="size-3.5 shrink-0" />
        ) : (
          <PiCaretDownBold className="size-3.5 shrink-0" />
        )}
      </button>
      {open && (
        <div className="mt-2 max-h-[40vh] overflow-y-auto rounded-lg border border-muted p-3">
          <Title as="h3" className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {t('account.devRequirements.title')}
          </Title>
          <Text className="mb-3 text-xs text-gray-500">{t('account.devRequirements.subtitle')}</Text>

          <Title as="h4" className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
            {t('account.devRequirements.liveApisTitle')}
          </Title>
          <div className="mb-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="border-b border-muted bg-gray-50/80 dark:bg-gray-100/40">
                  {[liveCols.id, liveCols.endpoint, liveCols.status].map((label) => (
                    <th
                      key={label}
                      className="px-2 py-2 font-medium text-gray-600 dark:text-gray-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROFILE_API_REQUIREMENTS.map((req) => (
                  <tr key={req.id} className="border-b border-muted/60 last:border-0">
                    <td className="px-2 py-2 align-top text-[11px] font-medium">{req.id}</td>
                    <td className="px-2 py-2 align-top font-mono text-[10px] break-all text-gray-600 dark:text-gray-400">
                      {req.endpoint}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Badge
                        color={apiStatusBadgeColor(req.status)}
                        rounded="md"
                        className="text-[10px]"
                      >
                        {t(`account.devRequirements.liveApis.status.${req.status}`)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead>
                <tr className="border-b border-muted bg-gray-50/80 dark:bg-gray-100/40">
                  {[
                    cols.capability,
                    cols.workaround,
                    cols.feRequest,
                    cols.expectedResponse,
                    cols.api,
                    cols.priority,
                    cols.surface,
                    cols.acceptance,
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-2 py-2 font-medium text-gray-600 dark:text-gray-400"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROFILE_BACKEND_CAPABILITY_GAPS.map((gap) => (
                  <GapRow key={gap.id} gap={gap} />
                ))}
              </tbody>
            </table>
          </div>
          <Text className={cn('mt-2 text-[10px] text-gray-400')}>
            {t('account.devRequirements.footer')}
          </Text>
        </div>
      )}
    </div>
  );
}
