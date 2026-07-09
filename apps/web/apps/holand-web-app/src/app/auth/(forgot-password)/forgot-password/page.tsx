import AuthWrapperFour from '@/app/shared/auth-layout/auth-wrapper-four';
import ForgetPasswordForm from './forgot-password-form';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Forgot Password'),
};

export default function ForgotPasswordPage() {
  return (
    <AuthWrapperFour titleKey="authPages.forgotPassword.welcomeTitle">
      <ForgetPasswordForm />
    </AuthWrapperFour>
  );
}
