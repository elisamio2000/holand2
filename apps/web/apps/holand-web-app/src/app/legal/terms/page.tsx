import AuthWrapperFour from '@/app/shared/auth-layout/auth-wrapper-four';
import LegalDocumentView from '@/app/shared/legal/legal-document-view';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Terms of Service'),
};

export default function TermsPage() {
  return (
    <AuthWrapperFour layout="document">
      <LegalDocumentView type="terms" />
    </AuthWrapperFour>
  );
}
