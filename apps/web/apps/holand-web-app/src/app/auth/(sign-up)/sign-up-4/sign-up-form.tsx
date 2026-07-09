'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SubmitHandler } from 'react-hook-form';
import { Password, Checkbox, Button, Input, Text } from 'rizzui';
import { useMedia } from '@core/hooks/use-media';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { SignUpSchema, signUpSchema } from '@/validators/signup.schema';

const initialValues = {
  email: '',
  password: '',
  isAgreed: false,
};

export default function SignUpForm() {
  const { t } = useTranslation();
  const isMedium = useMedia('(max-width: 1200px)', false);
  const [reset, setReset] = useState({});
  const onSubmit: SubmitHandler<SignUpSchema> = (data) => {
    console.log(data);
    setReset({ ...initialValues, isAgreed: false });
  };

  return (
    <>
      <Form<SignUpSchema>
        validationSchema={signUpSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{
          defaultValues: initialValues,
        }}
      >
        {({ register, formState: { errors } }) => (
          <div className="space-y-5 lg:space-y-6">
            <Input
              type="email"
              size={isMedium ? 'lg' : 'xl'}
              label={t('authPages.signUp.emailLabel')}
              placeholder={t('authPages.signUp.emailPlaceholder')}
              className="[&>label>span]:font-medium"
              {...register('email')}
              error={errors.email?.message}
            />
            <Password
              label={t('authPages.signUp.passwordLabel')}
              placeholder={t('authPages.signUp.passwordPlaceholder')}
              size={isMedium ? 'lg' : 'xl'}
              {...register('password')}
              className="[&>label>span]:font-medium"
              error={errors.password?.message}
            />
            <div className="col-span-2 flex items-start text-gray-700">
              <Checkbox
                {...register('isAgreed')}
                className="[&>label.items-center]:items-start [&>label>div.leading-none]:mt-0.5 [&>label>div.leading-none]:sm:mt-0 [&>label>span]:font-medium"
                label={
                  <Text as="span" className="ps-1 text-gray-500">
                    {t('authPages.signUp.agreeText')}{' '}
                    <Link
                      href="/"
                      className="font-semibold text-gray-700 transition-colors hover:text-primary"
                    >
                      {t('authPages.signUp.termsLink')}
                    </Link>{' '}
                    &{' '}
                    <Link
                      href="/"
                      className="font-semibold text-gray-700 transition-colors hover:text-primary"
                    >
                      {t('authPages.signUp.privacyLink')}
                    </Link>
                  </Text>
                }
              />
            </div>
            <Button
              className="w-full"
              type="submit"
              size={isMedium ? 'lg' : 'xl'}
            >
              {t('authPages.signUp.createAccountBtn')}
            </Button>
          </div>
        )}
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
