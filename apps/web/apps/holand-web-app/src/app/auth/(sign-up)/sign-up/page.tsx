import AuthWrapperFour from '@/app/shared/auth-layout/auth-wrapper-four';
import SignUpForm from './sign-up-form';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sign Up'),
};

export default function SignUpPage() {
  return (
    <AuthWrapperFour titleKey="authPages.signUp.welcomeTitle">
      <SignUpForm />
    </AuthWrapperFour>
  );
}
