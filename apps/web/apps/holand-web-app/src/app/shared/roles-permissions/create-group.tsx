'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button, Input, Textarea, Switch, Title } from 'rizzui';
import { adminService } from '@/services/admin.service';
import type { GroupResponse } from '@/types/auth.types';
import { useModal } from '@/app/shared/modal-views/use-modal';

interface CreateGroupProps {
  group?: GroupResponse;
  onCreated?: () => void;
}

export default function CreateGroup({ group, onCreated }: CreateGroupProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!group;

  const groupSchema = z.object({
    name: z
      .string()
      .min(2, t('createGroup.nameMinLength'))
      .max(50, t('createGroup.nameTooLong')),
    description: z.string().optional(),
    is_active: z.boolean().optional(),
  });

  type GroupFormValues = z.infer<typeof groupSchema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name || '',
      description: group?.description || '',
      is_active: group?.is_active ?? true,
    },
  });

  const isActive = watch('is_active');

  const onSubmit = async (data: GroupFormValues) => {
    setIsSubmitting(true);
    try {
      if (isEdit && group) {
        await adminService.updateGroup(group.id, {
          name: data.name,
          description: data.description || null,
          is_active: data.is_active,
        });
        toast.success(t('createGroup.updateSuccess', { name: data.name }));
      } else {
        await adminService.createGroup({
          name: data.name,
          description: data.description || null,
        });
        toast.success(t('createGroup.createSuccess', { name: data.name }));
      }
      onCreated?.();
      closeModal();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(
        axiosErr?.response?.data?.detail ||
          (isEdit ? t('createGroup.updateError') : t('createGroup.createError'))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="m-auto p-6">
      <Title as="h4" className="mb-6 font-semibold">
        {isEdit
          ? t('createGroup.titleEdit', { name: group?.name })
          : t('createGroup.titleCreate')}
      </Title>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label={t('createGroup.nameLabel')}
          placeholder={t('createGroup.namePlaceholder')}
          {...register('name')}
          error={errors.name?.message}
        />

        <Textarea
          label={t('createGroup.descriptionLabel')}
          placeholder={t('createGroup.descriptionPlaceholder')}
          {...register('description')}
          error={errors.description?.message}
          textareaClassName="min-h-[80px]"
        />

        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-muted px-4 py-3">
            <div>
              <p className="font-medium text-sm">{t('createGroup.activeStatusTitle')}</p>
              <p className="text-xs text-gray-500">{t('createGroup.activeStatusHint')}</p>
            </div>
            <Switch checked={isActive} onChange={() => setValue('is_active', !isActive)} />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={closeModal}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEdit ? t('createGroup.submitUpdate') : t('createGroup.submitCreate')}
          </Button>
        </div>
      </form>
    </div>
  );
}
