'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SubmitHandler } from 'react-hook-form';
import { Password, Checkbox, Button, Input, Text } from 'rizzui';
import toast from 'react-hot-toast';
import { useMedia } from '@core/hooks/use-media';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { loginSchema, LoginSchema } from '@/validators/login.schema';

const initialValues: LoginSchema = {
  username: '',
  password: '',
  rememberMe: false,
};

export default function SignInForm() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const isMedium = useMedia('(max-width: 1200px)', false);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    console.info('[SignInForm] Attempting login:', { username: data.username });
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        redirect: false,
      });

      console.info('[SignInForm] SignIn result:', { 
        ok: result?.ok, 
        error: result?.error, 
        status: result?.status,
        url: result?.url 
      });

      if (result?.error) {
        console.error('[SignInForm] Login failed:', { error: result.error });
        const errRaw = String(result.error);
        const err = errRaw.toLowerCase();
        const isNetwork =
          err.includes('fetch failed') ||
          err.includes('network') ||
          err.includes('unreachable') ||
          err.includes('cannot reach');
        const isPendingAccount =
          err.includes('disabled') ||
          err.includes('not enabled') ||
          err.includes('account is not active') ||
          err.includes('pending');
        if (err.includes('auth_dev_bypass')) {
          toast.error(errRaw);
        } else if (isPendingAccount) {
          toast.error(t('authPages.signIn.accountPendingApproval'));
        } else {
          toast.error(
            isNetwork
              ? t('authPages.signIn.loginServiceUnavailable')
              : t('authPages.signIn.loginFailed')
          );
        }
        return;
      }

      if (!result?.ok) {
        console.error('[SignInForm] Login not OK but no error:', result);
        toast.error(t('authPages.signIn.loginFailed'));
        return;
      }

      console.info('[SignInForm] Login successful, redirecting...');
      toast.success(t('authPages.signIn.loginSuccess'));
      // WHY window.location.href instead of router.push:
      // router.push does a soft client-side navigation that reuses the root
      // layout (server-rendered with session=null). The SessionProvider never
      // receives the updated server session, so protected pages still see an
      // unauthenticated state and the middleware redirects back to sign-in.
      // A full page reload ensures getServerSession() runs fresh in the root
      // layout with the newly set JWT cookie.
      const callbackUrl = searchParams.get('callbackUrl') || '/';
      console.info('[SignInForm] Redirecting to:', callbackUrl);
      
      // Add small delay to ensure cookie is set
      setTimeout(() => {
        window.location.href = callbackUrl;
      }, 100);
    } catch (error) {
      console.error('[SignInForm] Unexpected error during login:', error);
      toast.error(t('authPages.signIn.loginFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form<LoginSchema>
        validationSchema={loginSchema}
        onSubmit={onSubmit}
        useFormProps={{
          mode: 'onChange',
          defaultValues: initialValues,
        }}
      >
        {({ register, formState: { errors } }) => (
          <div className="space-y-5 lg:space-y-6">
            <Input
              type="text"
              size={isMedium ? 'lg' : 'xl'}
              label={t('authPages.signIn.usernameLabel')}
              placeholder={t('authPages.signIn.usernamePlaceholder')}
              className="[&>label>span]:font-medium"
              {...register('username')}
              error={errors.username?.message}
            />
            <Password
              label={t('authPages.signIn.passwordLabel')}
              placeholder={t('authPages.signIn.passwordPlaceholder')}
              size={isMedium ? 'lg' : 'xl'}
              className="[&>label>span]:font-medium"
              {...register('password')}
              error={errors.password?.message}
            />
            <div className="flex items-center justify-between pb-1">
              <Checkbox
                {...register('rememberMe')}
                label={t('authPages.signIn.rememberMe')}
                className="[&>label>span]:font-medium"
              />
              <Link
                href={routes.auth.forgotPassword}
                className="h-auto p-0 text-sm font-semibold text-gray-700 underline transition-colors hover:text-primary hover:no-underline"
              >
                {t('authPages.signIn.forgotPassword')}
              </Link>
            </div>

            <Button
              className="w-full"
              type="submit"
              size={isMedium ? 'lg' : 'xl'}
              isLoading={isLoading}
              disabled={isLoading}
            >
              {t('authPages.signIn.signInBtn')}
            </Button>
          </div>
        )}
      </Form>
      <Text className="mt-6 text-center text-[15px] leading-loose text-gray-500 md:mt-7 lg:mt-9 lg:text-base">
        {t('authPages.signIn.noAccount')}{' '}
        <Link
          href={routes.auth.signUp}
          className="font-semibold text-gray-700 transition-colors hover:text-primary"
        >
          {t('authPages.signIn.signUpLink')}
        </Link>
      </Text>
    </>
  );
}
