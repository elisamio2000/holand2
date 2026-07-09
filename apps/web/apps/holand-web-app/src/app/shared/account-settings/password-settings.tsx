'use client';

import { useState } from 'react';
import { SubmitHandler, Controller } from 'react-hook-form';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { Form } from '@core/ui/form';
import { Button, Password } from 'rizzui';
import { ProfileHeader } from '@/app/shared/account-settings/profile-settings';
import HorizontalFormBlockWrapper from '@/app/shared/account-settings/horiozontal-block';
import {
  passwordFormSchema,
  PasswordFormTypes,
} from '@/validators/password-settings.schema';
import { authService } from '@/services/auth.service';

/**
 * DEV NOTE: Backend integration status
 * ✅ POST /auth/change-password — { current_password, new_password }
 * ❌ Active sessions / logged devices — No backend endpoint available
 *    → Removed LoggedDevices section. If needed, request backend to add:
 *       GET /auth/sessions → [{ device, ip, location, last_active, is_current }]
 */

export default function PasswordSettingsView({
  settings,
}: {
  settings?: PasswordFormTypes;
}) {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [isLoading, setLoading] = useState(false);
  const [reset, setReset] = useState({});

  const onSubmit: SubmitHandler<PasswordFormTypes> = async (data) => {
    setLoading(true);
    try {
      await authService.changePassword({
        current_password: data.currentPassword,
        new_password: data.newPassword,
      });
      toast.success(t('account.passwordSettings.updateSuccess'));
      setReset({
        currentPassword: '',
        newPassword: '',
        confirmedPassword: '',
      });
    } catch (err: any) {
      const message =
        err?.response?.data?.detail || t('account.passwordSettings.updateError');
      toast.error(typeof message === 'string' ? message : t('account.passwordSettings.updateError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Form<PasswordFormTypes>
        validationSchema={passwordFormSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        className="@container"
        useFormProps={{
          mode: 'onChange',
          defaultValues: {
            ...settings,
          },
        }}
      >
        {({ register, control, formState: { errors }, getValues }) => {
          return (
            <>
              <ProfileHeader
                title={session?.user?.displayName || session?.user?.name || t('account.profileSettings.user')}
                description={session?.user?.email || ''}
              />

              <div className="mx-auto w-full max-w-screen-2xl">
                <HorizontalFormBlockWrapper
                  title={t('account.passwordSettings.currentPassword')}
                  titleClassName="text-base font-medium"
                >
                  <Password
                    {...register('currentPassword')}
                    placeholder={t('account.passwordSettings.currentPasswordPlaceholder')}
                    error={errors.currentPassword?.message}
                  />
                </HorizontalFormBlockWrapper>

                <HorizontalFormBlockWrapper
                  title={t('account.passwordSettings.newPassword')}
                  titleClassName="text-base font-medium"
                >
                  <Controller
                    control={control}
                    name="newPassword"
                    render={({ field: { onChange, value } }) => (
                      <Password
                        placeholder={t('account.passwordSettings.newPasswordPlaceholder')}
                        helperText={
                          (getValues().newPassword?.length ?? 0) < 8 &&
                          t('account.passwordSettings.newPasswordHelper')
                        }
                        onChange={onChange}
                        error={errors.newPassword?.message}
                      />
                    )}
                  />
                </HorizontalFormBlockWrapper>

                <HorizontalFormBlockWrapper
                  title={t('account.passwordSettings.confirmPassword')}
                  titleClassName="text-base font-medium"
                >
                  <Controller
                    control={control}
                    name="confirmedPassword"
                    render={({ field: { onChange, value } }) => (
                      <Password
                        placeholder={t('account.passwordSettings.confirmPasswordPlaceholder')}
                        onChange={onChange}
                        error={errors.confirmedPassword?.message}
                      />
                    )}
                  />
                </HorizontalFormBlockWrapper>

                <div className="mt-6 flex w-auto items-center justify-end gap-3">
                  <Button type="button" variant="outline">
                    {t('account.passwordSettings.cancelBtn')}
                  </Button>
                  <Button type="submit" variant="solid" isLoading={isLoading}>
                    {t('account.passwordSettings.updateBtn')}
                  </Button>
                </div>
              </div>
            </>
          );
        }}
      </Form>
    </>
  );
}
