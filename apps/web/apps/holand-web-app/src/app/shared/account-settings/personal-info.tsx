'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { SubmitHandler } from 'react-hook-form';
import { PiEnvelopeSimple } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { Form } from '@core/ui/form';
import { Text, Input, Badge, Loader } from 'rizzui';
import FormGroup from '@/app/shared/form-group';
import FormFooter, { profileFormFooterClassName } from '@core/components/form-footer';
import {
  personalInfoFormSchema,
  PersonalInfoFormTypes,
} from '@/validators/personal-info.schema';
import { adminService } from '@/services/admin.service';
import type { UserResponse } from '@/types/auth.types';

/**
 * DEV NOTE: Backend fields mapping
 * ✅ Available from backend: username, email, display_name, avatar_url, role, is_active
 * ❌ NOT available from backend: first_name/last_name (split), country, timezone, bio, portfolios
 *    → These are template placeholders. If needed, request backend to add them to UserUpdate schema.
 */

export default function PersonalInfoView() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current user data from backend
  useEffect(() => {
    async function fetchUser() {
      if (!session?.user?.id) return;
      try {
        const user = await adminService.getUserById(session.user.id);
        setUserData(user);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || t('account.personalInfo.loadError'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchUser();
  }, [session?.user?.id, t]);

  const onSubmit: SubmitHandler<PersonalInfoFormTypes> = async (data) => {
    if (!session?.user?.id) return;
    setIsSaving(true);
    try {
      const updated = await adminService.updateUser(session.user.id, {
        display_name: [data.first_name, data.last_name]
          .filter(Boolean)
          .join(' '),
        email: data.email,
      });
      setUserData(updated);
      toast.success(<Text as="b">{t('account.personalInfo.saveSuccess')}</Text>);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('account.personalInfo.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  // Split display_name into first/last for the form
  const nameParts = (userData?.display_name || '').split(' ');
  const firstName = nameParts[0] || userData?.username || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return (
    <Form<PersonalInfoFormTypes>
      validationSchema={personalInfoFormSchema}
      onSubmit={onSubmit}
      className="@container"
      useFormProps={{
        mode: 'onChange',
        defaultValues: {
          first_name: firstName,
          last_name: lastName,
          email: userData?.email || '',
        },
      }}
    >
      {({ register, formState: { errors } }) => {
        return (
          <>
            <FormGroup
              title={t('account.personalInfo.title')}
              description={t('account.personalInfo.description')}
              className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
            />

            <div className="mb-10 grid gap-7 divide-y divide-dashed divide-gray-200 @2xl:gap-9 @3xl:gap-11">
              {/* ---- Name (maps to display_name) ---- */}
              <FormGroup
                title={t('account.personalInfo.firstName')}
                className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
              >
                <Input
                  placeholder={t('account.personalInfo.firstNamePlaceholder')}
                  {...register('first_name')}
                  error={errors.first_name?.message}
                  className="flex-grow"
                />
                <Input
                  placeholder={t('account.personalInfo.lastNamePlaceholder')}
                  {...register('last_name')}
                  error={errors.last_name?.message}
                  className="flex-grow"
                />
              </FormGroup>

              {/* ---- Email ---- */}
              <FormGroup
                title={t('account.personalInfo.emailAddress')}
                className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
              >
                <Input
                  className="col-span-full"
                  prefix={
                    <PiEnvelopeSimple className="h-6 w-6 text-gray-500" />
                  }
                  type="email"
                  placeholder="user@example.com"
                  {...register('email')}
                  error={errors.email?.message}
                />
              </FormGroup>

              {/* ---- Role (read-only from Keycloak) ---- */}
              <FormGroup
                title={t('account.personalInfo.role')}
                description={t('account.personalInfo.roleDesc')}
                className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
              >
                <div className="col-span-full flex flex-wrap items-center gap-2">
                  {session?.user?.roles?.length ? (
                    session.user.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="flat"
                        color={
                          role === 'super-admin'
                            ? 'danger'
                            : role === 'admin'
                              ? 'warning'
                              : role === 'analyst'
                                ? 'info'
                                : 'success'
                        }
                        className="text-sm"
                      >
                        {role}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="flat" color="secondary">
                      user
                    </Badge>
                  )}
                </div>
              </FormGroup>

              {/* ---- Sections Access (read-only from RBAC) ---- */}
              <FormGroup
                title={t('account.personalInfo.allowedSections')}
                description={t('account.personalInfo.allowedSectionsDesc')}
                className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
              >
                <div className="col-span-full flex flex-wrap items-center gap-2">
                  {session?.user?.allowedSections?.length ? (
                    session.user.allowedSections.map((section) => (
                      <Badge
                        key={section}
                        variant="outline"
                        className="text-sm"
                      >
                        {section}
                      </Badge>
                    ))
                  ) : (
                    <Text className="text-gray-400">{t('common.noSectionsAssigned')}</Text>
                  )}
                </div>
              </FormGroup>

              {/* ---- Account Status ---- */}
              <FormGroup
                title={t('account.personalInfo.accountStatus')}
                className="pt-7 @2xl:pt-9 @3xl:grid-cols-12 @3xl:pt-11"
              >
                <div className="col-span-full flex items-center gap-3">
                  <Badge
                    variant="flat"
                    color={userData?.is_active !== false ? 'success' : 'danger'}
                  >
                    {userData?.is_active !== false ? t('account.personalInfo.enabled') : t('account.personalInfo.disabled')}
                  </Badge>
                  {session?.user?.isAdmin && (
                    <Badge variant="flat" color="warning">
                      Admin
                    </Badge>
                  )}
                  {session?.user?.isSuperAdmin && (
                    <Badge variant="flat" color="danger">
                      Super Admin
                    </Badge>
                  )}
                </div>
              </FormGroup>
            </div>

            <FormFooter
              isLoading={isSaving}
              altBtnText={t('account.personalInfo.cancelBtn')}
              submitBtnText={t('account.personalInfo.saveBtn')}
              sticky={false}
              className={profileFormFooterClassName}
            />
          </>
        );
      }}
    </Form>
  );
}
