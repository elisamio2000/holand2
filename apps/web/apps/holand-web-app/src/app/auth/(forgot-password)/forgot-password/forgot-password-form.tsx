'use client';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubmitHandler } from 'react-hook-form';
import { Button, Input, Text } from 'rizzui';
import { useMedia } from '@core/hooks/use-media';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import {
  forgetPasswordSchema,
  ForgetPasswordSchema,
} from '@/validators/forget-password.schema';

const initialValues = {
  email: '',
};

export default function ForgetPasswordForm() {
  const { t } = useTranslation();
  const isMedium = useMedia('(max-width: 1200px)', false);
  const [reset, setReset] = useState({});
  const onSubmit: SubmitHandler<ForgetPasswordSchema> = (data) => {
    console.log('forgot password form', data);
    toast.success(
      <Text>
        {t('authPages.forgotPassword.resetLinkSent')}{' '}
        <Text as="b" className="font-semibold">
          {data.email}
        </Text>
      </Text>
    );
    setReset(initialValues);
  };

  return (
    <>
      <Form<ForgetPasswordSchema>
        validationSchema={forgetPasswordSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{
          defaultValues: initialValues,
        }}
      >
        {({ register, formState: { errors } }) => (
          <div className="space-y-6">
            <Input
              type="email"
              size={isMedium ? 'lg' : 'xl'}
              label={t('authPages.forgotPassword.emailLabel')}
              placeholder={t('authPages.forgotPassword.emailPlaceholder')}
              className="[&>label>span]:font-medium"
              {...register('email')}
              error={errors.email?.message}
            />
            <Button
              className="w-full"
              type="submit"
              size={isMedium ? 'lg' : 'xl'}
            >
              {t('authPages.forgotPassword.resetPasswordBtn')}
            </Button>
          </div>
        )}
      </Form>
      <Text className="mt-6 text-center text-[15px] leading-loose text-gray-500 md:mt-7 lg:mt-9 lg:text-base">
        {t('authPages.forgotPassword.dontWantReset')}{' '}
        <Link
          href={routes.auth.signIn}
          className="font-semibold text-gray-700 transition-colors hover:text-primary"
        >
          {t('authPages.forgotPassword.signInLink')}
        </Link>
      </Text>
    </>
  );
}
