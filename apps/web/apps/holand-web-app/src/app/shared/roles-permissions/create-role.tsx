'use client';

import { useState } from 'react';
import { PiXBold } from 'react-icons/pi';
import { SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form } from '@core/ui/form';
import { Input, Button, ActionIcon, Title, Textarea } from 'rizzui';
import { IconTooltip } from '@/components/tooltip';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { adminService } from '@/services/admin.service';
import toast from 'react-hot-toast';
import { z } from 'zod';

/**
 * DEV NOTE: Create Role — Backend integration
 * ✅ POST /roles/ — { name, description, permissions }
 */

interface CreateRoleProps {
  onCreated?: () => void;
}

export default function CreateRole({ onCreated }: CreateRoleProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [isLoading, setLoading] = useState(false);

  const createRoleSchema = z.object({
    name: z
      .string()
      .min(2, t('createRoleForm.nameMinLength'))
      .max(50, t('createRoleForm.nameMaxLength'))
      .regex(/^[a-z0-9-]+$/, t('createRoleForm.namePattern')),
    description: z.string().optional(),
    permissions: z.string().optional(),
  });
  type CreateRoleFormData = z.infer<typeof createRoleSchema>;

  const onSubmit: SubmitHandler<CreateRoleFormData> = async (data) => {
    setLoading(true);
    try {
      const permissionsList = data.permissions
        ? data.permissions.split(',').map((p) => p.trim()).filter(Boolean)
        : [];

      await adminService.createRole({
        name: data.name,
        description: data.description || null,
        permissions: permissionsList.length > 0 ? permissionsList : undefined,
      });

      toast.success(t('createRoleForm.createSuccess', { name: data.name }));
      onCreated?.();
      closeModal();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('createRoleForm.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form<CreateRoleFormData>
      onSubmit={onSubmit}
      validationSchema={createRoleSchema}
      className="flex flex-grow flex-col gap-6 p-6 @container [&_.rizzui-input-label]:font-medium [&_.rizzui-input-label]:text-gray-900"
    >
      {({ register, formState: { errors } }) => (
        <>
          <div className="flex items-center justify-between">
            <Title as="h4" className="font-semibold">
              {t('createRoleForm.title')}
            </Title>
            <IconTooltip content={t('common.close')} preset="toolbar">
              <ActionIcon size="sm" variant="text" onClick={closeModal}>
                <PiXBold className="h-auto w-5" />
              </ActionIcon>
            </IconTooltip>
          </div>

          <Input
            label={t('createRoleForm.nameLabel')}
            placeholder={t('createRoleForm.namePlaceholder')}
            {...register('name')}
            error={errors.name?.message}
            helperText={t('createRoleForm.nameHelper')}
          />

          <Textarea
            label={t('createRoleForm.descriptionLabel')}
            placeholder={t('createRoleForm.descriptionPlaceholder')}
            {...register('description')}
            error={errors.description?.message}
          />

          <Input
            label={t('createRoleForm.permissionsLabel')}
            placeholder={t('createRoleForm.permissionsPlaceholder')}
            {...register('permissions')}
            error={errors.permissions?.message}
            helperText={t('createRoleForm.permissionsHelper')}
          />

          <div className="flex items-center justify-end gap-4">
            <Button variant="outline" onClick={closeModal} className="w-full @xl:w-auto">
              {t('createRoleForm.cancel')}
            </Button>
            <Button type="submit" isLoading={isLoading} className="w-full @xl:w-auto">
              {t('createRoleForm.submit')}
            </Button>
          </div>
        </>
      )}
    </Form>
  );
}
