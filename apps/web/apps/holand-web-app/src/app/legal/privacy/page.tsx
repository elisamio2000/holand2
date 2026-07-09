import AuthWrapperFour from '@/app/shared/auth-layout/auth-wrapper-four';
import LegalDocumentView from '@/app/shared/legal/legal-document-view';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Privacy Policy'),
};

export default function PrivacyPage() {
  return (
    <AuthWrapperFour layout="document">
      <LegalDocumentView type="privacy" />
    </AuthWrapperFour>
  );
}
