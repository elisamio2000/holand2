'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { SubmitHandler } from 'react-hook-form';
import { PiArrowRightBold } from 'react-icons/pi';
import { Checkbox, Password, Button, Input, Text } from 'rizzui';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { loginSchema, LoginSchema } from '@/validators/login.schema';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const initialValues: LoginSchema = {
  username: '',
  password: '',
  rememberMe: true,
};

export default function SignInForm() {
  const { t } = useTranslation();
  const [reset, setReset] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(result.error || t('authPages.signIn.loginFailed'));
      } else {
        toast.success(t('toast.signInSuccess'));
        window.location.href = '/';
      }
    } catch (error: any) {
      toast.error(t('toast.signInError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Form<LoginSchema>
        validationSchema={loginSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{
          defaultValues: initialValues,
        }}
      >
        {({ register, formState: { errors } }) => (
          <div className="space-y-5">
            <Input
              type="text"
              size="lg"
              label={t('authPages.signIn.usernameLabel')}
              placeholder={t('ui.placeholders.enterUsername')}
              className="[&>label>span]:font-medium"
              inputClassName="text-sm"
              {...register('username')}
              error={errors.username?.message}
            />
            <Password
              label={t('authPages.signIn.passwordLabel')}
              placeholder={t('ui.placeholders.enterPassword')}
              size="lg"
              className="[&>label>span]:font-medium"
              inputClassName="text-sm"
              {...register('password')}
              error={errors.password?.message}
            />
            <div className="flex items-center justify-between pb-2">
              <Checkbox
                {...register('rememberMe')}
                label={t('authPages.signIn.rememberMe')}
                className="[&>label>span]:font-medium"
              />
              <Link
                href={routes.auth.forgotPassword1}
                className="h-auto p-0 text-sm font-semibold text-blue underline transition-colors hover:text-gray-900 hover:no-underline"
              >
                {t('authPages.signIn.forgotPassword')}
              </Link>
            </div>
            <Button
              className="w-full"
              type="submit"
              size="lg"
              isLoading={isLoading}
              disabled={isLoading}
            >
              <span>{t('authPages.signIn.signInBtn')}</span>{' '}
              <PiArrowRightBold className="ms-2 mt-0.5 h-5 w-5" />
            </Button>
          </div>
        )}
      </Form>
      <Text className="mt-6 text-center leading-loose text-gray-500 lg:mt-8 lg:text-start">
        {t('authPages.signIn.noAccount')}{' '}
        <Link
          href={routes.auth.signUp1}
          className="font-semibold text-gray-700 transition-colors hover:text-blue"
        >
          {t('authPages.signIn.signUpLink')}
        </Link>
      </Text>
    </>
  );
}
