'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiXBold } from 'react-icons/pi';
import { Controller, SubmitHandler } from 'react-hook-form';
import { Form } from '@core/ui/form';
import { Input, Button, ActionIcon, Title, Select, Password } from 'rizzui';
import { IconTooltip } from '@/components/tooltip';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { adminService } from '@/services/admin.service';
import type { RoleResponse } from '@/types/auth.types';
import {
  getAllowedInternalEmailDomains,
  getDefaultEmailPlaceholder,
  isValidPlatformEmail,
} from '@/config/platform-email';
import toast from 'react-hot-toast';
import { z } from 'zod';

/**
 * DEV NOTE: Create User — Backend integration
 * ✅ POST /admin/users — { username, email, password, role_name }
 * ✅ GET /roles/ — Fetches available roles for the select dropdown
 * ❌ Full Name — Backend does not have first_name/last_name fields
 *    → Using 'username' as the primary identifier
 * ❌ Status select — Backend auto-sets is_active=true on creation
 * ❌ Permissions select — Backend assigns permissions via roles, not directly per user
 *    → Use Permission Overrides (POST /overrides/permissions) for individual user overrides
 */

interface CreateUserProps {
  onCreated?: () => void;
}

export default function CreateUser({ onCreated }: CreateUserProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [isLoading, setLoading] = useState(false);
  const [roles, setRoles] = useState<{ label: string; value: string }[]>([]);

  const allowedEmailDomains = useMemo(() => getAllowedInternalEmailDomains(), []);
  const emailPlaceholder = useMemo(() => getDefaultEmailPlaceholder(), []);

  // Create schema with translations
  const createUserSchema = useMemo(() => z.object({
    username: z
      .string()
      .min(3, t('createUser.validation.usernameMinLength'))
      .max(50, t('createUser.validation.usernameMaxLength')),
    email: z.string().refine(
      (value) => isValidPlatformEmail(value, allowedEmailDomains),
      t('createUser.validation.invalidEmail')
    ),
    password: z.string().min(8, t('createUser.validation.passwordMinLength')),
    role_name: z.string().min(1, t('createUser.validation.roleRequired')),
  }), [t, allowedEmailDomains]);
  
  type CreateUserFormData = z.infer<typeof createUserSchema>;

  // Fetch roles for select dropdown
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
        // Fallback to system defaults
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

  const onSubmit: SubmitHandler<CreateUserFormData> = async (data) => {
    setLoading(true);
    try {
      await adminService.createUser({
        username: data.username,
        email: data.email,
        password: data.password,
        role_name: data.role_name,
      });
      toast.success(t('createUser.toast.createSuccess', { username: data.username }));
      onCreated?.();
      closeModal();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      let message = t('createUser.toast.createError');
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors: [{loc, msg, type}]
        message = detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('; ');
      } else if (typeof detail === 'object' && detail !== null) {
        message = detail.message || detail.msg || JSON.stringify(detail);
      } else if (err?.response?.data?.message) {
        message = err.response.data.message;
      } else if (err instanceof Error && err.message) {
        // Plain Error thrown by adminService (e.g., empty response from backend)
        message = err.message;
      }
      console.error('[CreateUser] Error:', { response: err?.response?.data, message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<CreateUserFormData>
      onSubmit={onSubmit}
      validationSchema={createUserSchema}
      useFormProps={{
        defaultValues: {
          username: '',
          email: '',
          password: '',
          role_name: '',
        },
      }}
      className="grid grid-cols-1 gap-6 p-6 @container md:grid-cols-2 [&_.rizzui-input-label]:font-medium [&_.rizzui-input-label]:text-gray-900"
    >
      {({ register, control, formState: { errors } }) => (
        <>
          <div className="col-span-full flex items-center justify-between">
            <Title as="h4" className="font-semibold">
              {t('createUser.title')}
            </Title>
            <IconTooltip content={t('common.close')} preset="toolbar">
              <ActionIcon size="sm" variant="text" onClick={closeModal}>
                <PiXBold className="h-auto w-5" />
              </ActionIcon>
            </IconTooltip>
          </div>

          <Input
            label={t('createUser.labels.username')}
            placeholder={t('createUser.placeholders.username')}
            {...register('username')}
            className="col-span-full"
            error={errors.username?.message}
          />

          <Input
            label={t('createUser.labels.email')}
            placeholder={emailPlaceholder}
            className="col-span-full"
            {...register('email')}
            error={errors.email?.message}
          />

          <Password
            label={t('createUser.labels.password')}
            placeholder={t('createUser.placeholders.password')}
            className="col-span-full"
            {...register('password')}
            error={errors.password?.message}
          />

          <Controller
            name="role_name"
            control={control}
            render={({ field: { name, onChange, value } }) => (
              <Select
                options={roles}
                value={value}
                onChange={onChange}
                name={name}
                label={t('createUser.labels.role')}
                className="col-span-full"
                error={errors?.role_name?.message}
                getOptionValue={(option: { value: string }) => option.value}
                displayValue={(selected: string) =>
                  roles.find((option) => option.value === selected)?.label ??
                  selected
                }
                dropdownClassName="!z-[1]"
                inPortal={false}
              />
            )}
          />

          <div className="col-span-full flex items-center justify-end gap-4">
            <Button
              variant="outline"
              onClick={closeModal}
              className="w-full @xl:w-auto"
            >
              {t('createUser.buttons.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={isLoading}
              className="w-full @xl:w-auto"
            >
              {t('createUser.buttons.create')}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
