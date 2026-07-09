'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Input,
  Loader,
  Select,
  Switch,
  Text,
  Title,
} from 'rizzui';
import {
  PiFloppyDiskBold,
  PiArrowCounterClockwiseBold,
  PiWarningBold,
  PiShieldCheckBold,
  PiUsersBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { adminService } from '@/services/admin.service';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import type { RegistrationSettingsResponse } from '@/types/auth.types';

const POLICY_OPTIONS = [
  'pending_admin_approval',
  'inactive_pending',
  'active_restricted',
  'legacy_active_user',
] as const;

/**
 * Admin registration policy settings (self-register behavior, roles, expiry).
 */
export default function RegistrationSettingsSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<{ label: string; value: string }[]>([]);
  const [values, setValues] = useState<RegistrationSettingsResponse | null>(null);

  const load = useCallback(async () => {
    console.info('[RegistrationSettingsSection] Loading registration settings...');
    setLoading(true);
    setError(null);
    try {
      const [settings, roleList] = await Promise.all([
        adminService.getRegistrationSettings(),
        adminService.getRoles(),
      ]);
      setValues(settings);
      setRoles(
        roleList.map((r) => ({
          value: r.name,
          label: t(roleDisplayNameKey(r.name), { defaultValue: r.name }),
        }))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('adminSettings.loadError');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const policyOptions = useMemo(
    () =>
      POLICY_OPTIONS.map((p) => ({
        value: p,
        label: t(`adminSettings.policy.${p}.label`),
      })),
    [t]
  );

  const handleSave = async () => {
    if (!values) return;
    setSaving(true);
    try {
      await adminService.updateRegistrationSettings(values);
      toast.success(t('adminSettings.saveSuccess'));
      await load();
    } catch (err: unknown) {
      console.error('[RegistrationSettingsSection] Save failed:', err);
      toast.error(t('adminSettings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-muted p-6">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (error || !values) {
    return (
      <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
        <div className="flex items-center gap-2">
          <PiWarningBold className="h-5 w-5 text-orange-500" />
          <Text className="text-sm text-orange-700 dark:text-orange-400">
            {error ?? t('adminSettings.loadError')}
          </Text>
        </div>
        <Button variant="outline" size="sm" className="mt-3" onClick={load}>
          <PiArrowCounterClockwiseBold className="me-1 h-4 w-4" />
          {t('settingsPage.retry')}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-muted p-6">
      <div>
        <Title as="h4" className="font-semibold">
          {t('adminSettings.registrationTitle')}
        </Title>
        <Text className="text-sm text-gray-500">{t('adminSettings.registrationDesc')}</Text>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-muted px-4 py-3">
        <div>
          <Text className="text-sm font-medium">{t('adminSettings.registrationEnabled')}</Text>
          <Text className="text-xs text-gray-500">{t('adminSettings.registrationEnabledHint')}</Text>
        </div>
        <Switch
          checked={values.registration_enabled}
          onChange={(e) =>
            setValues((prev) =>
              prev ? { ...prev, registration_enabled: e.target.checked } : prev
            )
          }
        />
      </div>

      <Select
        label={t('adminSettings.registrationPolicy')}
        helperText={t(`adminSettings.policy.${values.registration_policy}.desc`)}
        options={policyOptions}
        value={values.registration_policy}
        onChange={(val: string) =>
          setValues((prev) => (prev ? { ...prev, registration_policy: val } : prev))
        }
        getOptionValue={(o: { value: string }) => o.value}
        displayValue={(selected: string) =>
          t(`adminSettings.policy.${selected}.label`, { defaultValue: selected })
        }
      />

      <div className="grid gap-4 @lg:grid-cols-2">
        <Select
          label={t('adminSettings.defaultRole')}
          helperText={t('adminSettings.defaultRoleHint')}
          options={roles}
          value={values.registration_default_role}
          onChange={(val: string) =>
            setValues((prev) => (prev ? { ...prev, registration_default_role: val } : prev))
          }
          getOptionValue={(o: { value: string }) => o.value}
          displayValue={(selected: string) =>
            roles.find((r) => r.value === selected)?.label ?? selected
          }
        />
        <Select
          label={t('adminSettings.postApprovalRole')}
          helperText={t('adminSettings.postApprovalRoleHint')}
          options={roles}
          value={values.registration_post_approval_role}
          onChange={(val: string) =>
            setValues((prev) =>
              prev ? { ...prev, registration_post_approval_role: val } : prev
            )
          }
          getOptionValue={(o: { value: string }) => o.value}
          displayValue={(selected: string) =>
            roles.find((r) => r.value === selected)?.label ?? selected
          }
        />
      </div>

      <Input
        label={t('adminSettings.activationDeadlineDays')}
        helperText={t('adminSettings.activationDeadlineDaysHint')}
        type="number"
        min={1}
        value={
          values.registration_activation_deadline_days != null
            ? String(values.registration_activation_deadline_days)
            : ''
        }
        onChange={(e) => {
          const raw = e.target.value.trim();
          setValues((prev) =>
            prev
              ? {
                  ...prev,
                  registration_activation_deadline_days: raw
                    ? parseInt(raw, 10) || null
                    : null,
                }
              : prev
          );
        }}
      />

      <div className="grid gap-4 @lg:grid-cols-2">
        <Input
          label={t('adminSettings.termsVersion')}
          value={values.registration_terms_version}
          onChange={(e) =>
            setValues((prev) =>
              prev ? { ...prev, registration_terms_version: e.target.value } : prev
            )
          }
        />
        <div className="flex items-center justify-between rounded-lg border border-muted px-4 py-3">
          <Text className="text-sm font-medium">{t('adminSettings.requireTerms')}</Text>
          <Switch
            checked={values.registration_require_terms}
            onChange={(e) =>
              setValues((prev) =>
                prev ? { ...prev, registration_require_terms: e.target.checked } : prev
              )
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-dashed border-muted p-4">
        <Text className="w-full text-sm font-medium">{t('adminSettings.accessLinksTitle')}</Text>
        <Link
          href={`${routes.rolesPermissions}/users`}
          className="inline-flex items-center gap-2 text-sm text-primary underline"
        >
          <PiUsersBold className="h-4 w-4" />
          {t('adminSettings.linkUsers')}
        </Link>
        <Link
          href={`${routes.rolesPermissions}/permissions/matrix`}
          className="inline-flex items-center gap-2 text-sm text-primary underline"
        >
          <PiShieldCheckBold className="h-4 w-4" />
          {t('adminSettings.linkPermissions')}
        </Link>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          <PiFloppyDiskBold className="me-1.5 h-4 w-4" />
          {t('adminSettings.save')}
        </Button>
      </div>
    </section>
  );
}
