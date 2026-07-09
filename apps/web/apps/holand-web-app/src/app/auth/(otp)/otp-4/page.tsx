'use client';

import { useTranslation } from 'react-i18next';
import { Text } from 'rizzui';
import AuthWrapperFour from '@/app/shared/auth-layout/auth-wrapper-four';
import OtpForm from '@/app/auth/(otp)/otp-4/otp-form';

/**
 * OtpPage — OTP verification page.
 *
 * @requires authPages.otp translation keys
 */
export default function OtpPage() {
  const { t } = useTranslation();

  return (
    <AuthWrapperFour titleKey="authPages.otp.welcomeTitle" className="md:px-14 lg:px-20">
      <Text className="pb-7 text-center text-[15px] leading-[1.85] text-gray-700 md:text-base md:!leading-loose lg:-mt-5">
        {t('authPages.otp.otpSentTo')}
      </Text>
      <OtpForm />
    </AuthWrapperFour>
  );
}
