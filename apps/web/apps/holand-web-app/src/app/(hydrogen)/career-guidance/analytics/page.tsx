import { metaObject } from '@/config/site.config';
import { AssessmentFunnelDashboard } from '@/app/shared/assessment-funnel';

export const metadata = {
  ...metaObject('Assessment Funnel Analytics'),
};

export default function AssessmentFunnelPage() {
  return <AssessmentFunnelDashboard />;
}
