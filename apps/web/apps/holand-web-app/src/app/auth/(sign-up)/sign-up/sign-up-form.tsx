'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SubmitHandler } from 'react-hook-form';
import { Password, Checkbox, Button, Input, Text } from 'rizzui';
import toast from 'react-hot-toast';
import { useMedia } from '@core/hooks/use-media';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { createSignUpSchema, PrimarySignUpSchema } from '@/validators/signup.schema';
import { authService } from '@/services/auth.service';
import { getApiErrorMessage } from '@/utils/api-error-message';
import { getDefaultEmailPlaceholder } from '@/config/platform-email';
import { roleDisplayNameKey } from '@/app/shared/roles-permissions/utils';
import type { RegistrationInfoResponse } from '@/types/auth.types';
import SignUpPasswordHints from './sign-up-password-hints';

const initialValues = {
  username: '',
  firstName: '',
  lastName: '',
  nationalId: '',
  mobileNumber: '',
  centerName: '',
  email: '',
  password: '',
  confirmPassword: '',
  isAgreed: false,
};

export default function SignUpForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const isMedium = useMedia('(max-width: 1200px)', false);
  const [isLoading, setIsLoading] = useState(false);
  const [reset, setReset] = useState({});
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [registrationInfo, setRegistrationInfo] = useState<RegistrationInfoResponse | null>(null);
  const emailPlaceholder = useMemo(() => getDefaultEmailPlaceholder(), []);
  const signUpSchema = useMemo(() => createSignUpSchema(t), [t]);

  useEffect(() => {
    let cancelled = false;
    authService
      .getRegistrationInfo()
      .then((info) => {
        if (!cancelled) setRegistrationInfo(info);
      })
      .catch((error: unknown) => {
        console.warn('[SignUpForm] Could not load registration info:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const defaultRoleLabel = useMemo(() => {
    if (!registrationInfo?.default_role) return null;
    return t(roleDisplayNameKey(registrationInfo.default_role), {
      defaultValue: registrationInfo.default_role,
    });
  }, [registrationInfo?.default_role, t]);

  const postApprovalRoleLabel = useMemo(() => {
    if (!registrationInfo?.post_approval_role_hint) return null;
    return t(roleDisplayNameKey(registrationInfo.post_approval_role_hint), {
      defaultValue: registrationInfo.post_approval_role_hint,
    });
  }, [registrationInfo?.post_approval_role_hint, t]);

  const onSubmit: SubmitHandler<PrimarySignUpSchema> = async (data) => {
    console.info('[SignUpForm] Submitting registration:', { username: data.username });
    setIsLoading(true);
    try {
      await authService.register({
        username: data.username,
        first_name: data.firstName,
        last_name: data.lastName,
        national_id: data.nationalId,
        mobile_number: data.mobileNumber,
        center_name: data.centerName,
        email: data.email,
        password: data.password,
      });

      if (registrationInfo?.requires_admin_activation) {
        toast.success(t('authPages.signUp.registerPendingApproval'));
      } else {
        toast.success(t('authPages.signUp.registerSuccess'));
      }

      setReset({ ...initialValues });
      router.push(routes.auth.signIn);
    } catch (error: unknown) {
      console.error('[SignUpForm] Registration failed:', error);
      toast.error(getApiErrorMessage(error, t('authPages.signUp.registerFailed')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form<PrimarySignUpSchema>
        validationSchema={signUpSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{
          defaultValues: initialValues,
          mode: 'onChange',
        }}
      >
        {({ register, watch, formState: { errors, touchedFields, isSubmitted } }) => {
          const isAgreed = watch('isAgreed');
          const password = watch('password') ?? '';
          const showPasswordRuleErrors =
            Boolean(touchedFields.password) || isSubmitted;
          const {
            ref: passwordRef,
            onBlur: onPasswordBlur,
            onChange: onPasswordChange,
            name: passwordName,
          } = register('password');
          return (
            <div className="space-y-5 lg:space-y-6">
              {defaultRoleLabel ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-300/40 dark:bg-amber-100/20">
                  <Text className="text-sm text-amber-900 dark:text-amber-900/90">
                    {t('authPages.signUp.registrationInfoPending', {
                      role: defaultRoleLabel,
                    })}
                  </Text>
                  {postApprovalRoleLabel ? (
                    <Text className="mt-1 text-xs text-amber-800/90 dark:text-amber-900/80">
                      {t('authPages.signUp.registrationInfoApprovalHint', {
                        role: postApprovalRoleLabel,
                      })}
                    </Text>
                  ) : null}
                </div>
              ) : null}
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.usernameLabel')}
                placeholder={t('authPages.signUp.usernamePlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('username')}
                error={errors.username?.message}
              />
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.firstNameLabel')}
                placeholder={t('authPages.signUp.firstNamePlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('firstName')}
                error={errors.firstName?.message}
              />
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.lastNameLabel')}
                placeholder={t('authPages.signUp.lastNamePlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('lastName')}
                error={errors.lastName?.message}
              />
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.nationalIdLabel')}
                placeholder={t('authPages.signUp.nationalIdPlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('nationalId')}
                error={errors.nationalId?.message}
              />
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.mobileNumberLabel')}
                placeholder={t('authPages.signUp.mobileNumberPlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('mobileNumber')}
                error={errors.mobileNumber?.message}
              />
              <Input
                type="text"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.centerNameLabel')}
                placeholder={t('authPages.signUp.centerNamePlaceholder')}
                className="[&>label>span]:font-medium"
                {...register('centerName')}
                error={errors.centerName?.message}
              />
              <Input
                type="email"
                size={isMedium ? 'lg' : 'xl'}
                label={t('authPages.signUp.emailLabel')}
                placeholder={emailPlaceholder}
                className="[&>label>span]:font-medium"
                {...register('email')}
                error={errors.email?.message}
              />
              <Password
                label={t('authPages.signUp.passwordLabel')}
                placeholder={t('authPages.signUp.passwordPlaceholder')}
                size={isMedium ? 'lg' : 'xl'}
                ref={passwordRef}
                name={passwordName}
                onChange={onPasswordChange}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={(event) => {
                  onPasswordBlur(event);
                  setIsPasswordFocused(false);
                }}
                className="[&>label>span]:font-medium"
                error={errors.password?.message}
              />
              {isPasswordFocused ? (
                <SignUpPasswordHints
                  password={password}
                  showErrors={showPasswordRuleErrors}
                />
              ) : null}
              <Password
                label={t('authPages.signUp.confirmPasswordLabel')}
                placeholder={t('authPages.signUp.confirmPasswordPlaceholder')}
                size={isMedium ? 'lg' : 'xl'}
                {...register('confirmPassword')}
                className="[&>label>span]:font-medium"
                error={errors.confirmPassword?.message}
              />
              <div className="col-span-2 flex items-start text-gray-700">
                <Checkbox
                  {...register('isAgreed')}
                  className="[&>label.items-center]:items-start [&>label>div.leading-none]:mt-0.5 [&>label>div.leading-none]:sm:mt-0 [&>label>span]:font-medium"
                  label={
                    <Text as="span" className="ps-1 text-gray-500">
                      {t('authPages.signUp.agreeText')}{' '}
                      <Link
                        href={routes.legal.terms}
                        className="font-semibold text-gray-700 transition-colors hover:text-primary"
                      >
                        {t('authPages.signUp.termsLink')}
                      </Link>{' '}
                      &{' '}
                      <Link
                        href={routes.legal.privacy}
                        className="font-semibold text-gray-700 transition-colors hover:text-primary"
                      >
                        {t('authPages.signUp.privacyLink')}
                      </Link>
                    </Text>
                  }
                />
              </div>
              {errors.isAgreed?.message ? (
                <Text className="text-sm text-red-500">{errors.isAgreed.message}</Text>
              ) : null}
              <Button
                className="w-full"
                type="submit"
                size={isMedium ? 'lg' : 'xl'}
                isLoading={isLoading}
                disabled={isLoading || !isAgreed}
              >
                {t('authPages.signUp.createAccountBtn')}
              </Button>
            </div>
          );
        }}
      </Form>
      <Text className="mt-6 text-center text-[15px] leading-loose text-gray-500 md:mt-7 lg:mt-9 lg:text-base">
        {t('authPages.signUp.hasAccount')}{' '}
        <Link
          href={routes.auth.signIn}
          className="font-semibold text-gray-700 transition-colors hover:text-primary"
        >
          {t('authPages.signUp.signInLink')}
        </Link>
      </Text>
    </>
  );
}
