'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiXBold } from 'react-icons/pi';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Input, Button, ActionIcon, Title, Select, Switch, Text, Badge } from 'rizzui';
import { IconTooltip } from '@/components/tooltip';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { adminService } from '@/services/admin.service';
import type { RoleResponse, UserInfo } from '@/types/auth.types';
import {
  getAllowedInternalEmailDomains,
  getDefaultEmailPlaceholder,
  isValidPlatformEmail,
} from '@/config/platform-email';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

/**
 * Edit User Modal — Update user email, role, active status
 *
 * ✅ PATCH /admin/users/:id (Gateway) — Update email, is_active, role_name
 * ✅ GET /roles/ — List available roles
 * ✅ Quick approve — is_active=true + role_name=user for pending registrations
 */

interface EditUserProps {
  user: UserInfo;
  /** Called after a successful save; receives the updated user from PATCH. */
  onUpdated?: (updated: UserInfo) => void;
}

export default function EditUser({ user, onUpdated }: EditUserProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [isLoading, setLoading] = useState(false);
  const [roles, setRoles] = useState<{ label: string; value: string }[]>([]);

  const allowedEmailDomains = useMemo(() => getAllowedInternalEmailDomains(), []);
  const emailPlaceholder = useMemo(() => getDefaultEmailPlaceholder(), []);

  // Create schema with translations
  // NOTE: Only email, role_name, is_active are supported by the API Gateway UserUpdate schema.
  // display_name and bio are NOT in the API spec and will cause 422 if sent.
  const editUserSchema = useMemo(() => z.object({
    email: z
      .string()
      .refine(
        (value) => value === '' || isValidPlatformEmail(value, allowedEmailDomains),
        t('editUser.validation.invalidEmail')
      )
      .optional()
      .or(z.literal('')),
    role_name: z.string().min(1, t('editUser.validation.roleRequired')),
    is_active: z.boolean(),
  }), [t, allowedEmailDomains]);
  type EditUserFormData = z.infer<typeof editUserSchema>;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: user.email || '',
      role_name: user.role || 'user',
      is_active: user.is_active,
    },
  });

  const isActive = watch('is_active');

  useEffect(() => {
    async function fetchRoles() {
      try {
        const data = await adminService.getRoles();
        setRoles(
          data.map((r: RoleResponse) => ({
            label: t(roleDisplayNameKey(r.name), { defaultValue: r.name }),
            value: r.name,
          }))
        );
      } catch {
        setRoles(
          ['user', 'analyst', 'admin'].map((name) => ({
            label: t(roleDisplayNameKey(name), { defaultValue: name }),
            value: name,
          }))
        );
      }
    }
    fetchRoles();
  }, [t]);

  const onSubmit: SubmitHandler<EditUserFormData> = async (data) => {
    setLoading(true);
    try {
      const result = await adminService.updateAdminUser(user.id, {
        email: data.email || undefined,
        is_active: data.is_active,
        role_name: data.role_name !== user.role ? data.role_name : undefined,
      });

      if (
        data.is_active &&
        data.role_name === 'pending' &&
        user.role === 'pending'
      ) {
        toast.error(t('editUser.warnings.pendingRoleOnActivate'), { duration: 6000 });
      }

      const warnings = result._warnings ?? [];
      if (warnings.length > 0) {
        toast.success(t('editUser.toast.updateSuccess', { username: user.username }));
        warnings.forEach((w) => toast.error(w, { duration: 6000 }));
      } else {
        toast.success(t('editUser.toast.updateSuccessFull', { username: user.username }));
      }
      onUpdated?.({
        id: result.id,
        username: result.username,
        email: result.email,
        role: result.role,
        is_active: result.is_active,
        created_at: result.created_at,
        last_login: result.last_login,
      });
      closeModal();
    } catch (err: unknown) {
      console.error('[EditUser] Update failed:', err);
      // Extract the most descriptive message from the error:
      // 1. FastAPI detail (string or array of validation errors)
      // 2. Gateway-level message field
      // 3. 403/401 common messages
      // 4. Generic Axios message as last resort
      const axiosErr = err as { response?: { status?: number; data?: { detail?: unknown; message?: string } }; message?: string };
      const detail = axiosErr?.response?.data?.detail;
      let message: string;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('; ');
      } else if (axiosErr?.response?.data?.message) {
        message = axiosErr.response.data.message;
      } else if (axiosErr?.response?.status === 403) {
        message = t('editUser.toast.forbiddenError');
      } else if (axiosErr?.response?.status === 401) {
        message = t('editUser.toast.unauthorizedError');
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = t('editUser.toast.updateError');
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      await adminService.updateAdminUser(user.id, {
        is_active: true,
        role_name: 'user',
      });
      toast.success(t('editUser.toast.updateSuccessFull', { username: user.username }));
      onUpdated?.({
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'user',
        is_active: true,
        created_at: user.created_at,
        last_login: user.last_login,
      });
      closeModal();
    } catch (err: unknown) {
      console.error('[EditUser] Approve failed:', err);
      toast.error(t('editUser.toast.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const showApprove = user.role === 'pending';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Title as="h4" className="font-semibold">
            {t('editUser.title')}
          </Title>
          <Text className="text-sm text-gray-500 mt-0.5">
            {user.username}
          </Text>
        </div>
        <IconTooltip content={t('common.close')} preset="toolbar">
          <ActionIcon size="sm" variant="text" onClick={closeModal}>
            <PiXBold className="h-auto w-5" />
          </ActionIcon>
        </IconTooltip>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Username (read-only) */}
        <div>
          <Text className="mb-1 text-sm font-medium">{t('editUser.labels.username')}</Text>
          <div className="flex items-center gap-2 rounded-md border border-muted bg-gray-50 px-3 py-2.5 dark:bg-gray-100">
            <Text className="text-sm text-gray-600 dark:text-gray-700">{user.username}</Text>
            <Badge variant="flat" size="sm" color="warning" className="text-[10px]">
              {t('editUser.labels.readonlyBadge')}
            </Badge>
          </div>
        </div>

        {/* User ID (read-only) */}
        <div>
          <Text className="mb-1 text-sm font-medium">{t('editUser.labels.userId')}</Text>
          <div className="rounded-md border border-muted bg-gray-50 px-3 py-2.5 dark:bg-gray-100">
            <Text className="text-xs font-mono text-gray-500 dark:text-gray-700">{user.id}</Text>
          </div>
        </div>

        {/* Email */}
        <Input
          label={t('editUser.labels.email')}
          placeholder={emailPlaceholder}
          {...register('email')}
          error={errors.email?.message}
        />

        {/* Role — NOTE: display_name and bio removed (not in API UserUpdate schema) */}
        <Controller
          name="role_name"
          control={control}
          render={({ field: { name, onChange, value } }) => (
            <Select
              options={roles}
              value={value}
              onChange={onChange}
              name={name}
              label={t('editUser.labels.role')}
              error={errors?.role_name?.message}
              getOptionValue={(option: { value: string }) => option.value}
              displayValue={(selected: string) =>
                roles.find((option) => option.value === selected)?.label ?? selected
              }
              dropdownClassName="!z-[1]"
              inPortal={false}
            />
          )}
        />

        {/* Active status */}
        <div className="rounded-lg border border-muted px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <Text className="font-medium text-sm">{t('editUser.labels.activeStatus')}</Text>
              <Text className="text-xs text-gray-500">
                {isActive ? t('editUser.labels.activeDescription') : t('editUser.labels.inactiveDescription')}
              </Text>
            </div>
            <Switch
              checked={isActive}
              onChange={() => setValue('is_active', !isActive)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-end gap-3 pt-2">
          {showApprove ? (
            <Button
              type="button"
              variant="outline"
              isLoading={isLoading}
              onClick={handleApprove}
              className="me-auto"
            >
              {t('editUser.buttons.approveUser')}
            </Button>
          ) : null}
          <Button variant="outline" onClick={closeModal}>
            {t('editUser.buttons.cancel')}
          </Button>
          <Button type="submit" isLoading={isLoading}>
            {t('editUser.buttons.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
