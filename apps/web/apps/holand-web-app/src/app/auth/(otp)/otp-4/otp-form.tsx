// ============================================
// OtpForm — OTP verification form
// Used on the otp-4 auth page
// ============================================
'use client';

import { useTranslation } from 'react-i18next';
import { PinCode, Button } from 'rizzui';
import { Form } from '@core/ui/form';
import { SubmitHandler } from 'react-hook-form';

type FormValues = {
  otp: string;
};

/**
 * OtpForm — Renders OTP pin code input with resend/verify buttons.
 *
 * @requires authPages.otp translation keys
 *
 * @example
 * ```tsx
 * <OtpForm />
 * ```
 */
export default function OtpForm() {
  const { t } = useTranslation();
  const onSubmit: SubmitHandler<FormValues> = (data) => {
    console.log(data);
  };
  return (
    <Form<FormValues> onSubmit={onSubmit}>
      {({ setValue }) => (
        <div className="space-y-5 lg:space-y-8">
          <PinCode
            variant="outline"
            setValue={(value) => setValue('otp', String(value))}
            className="pb-2"
            size="lg"
          />

          <Button
            className="w-full text-base font-medium"
            type="submit"
            size="xl"
            variant="outline"
            rounded="lg"
          >
            {t('authPages.otp.resendOtp')}
          </Button>
          <Button
            className="w-full text-base font-medium"
            type="submit"
            size="xl"
            rounded="lg"
          >
            {t('authPages.otp.verifyOtp')}
          </Button>
        </div>
      )}
    </Form>
  );
}
