import { metaObject } from '@/config/site.config';
import { AssessmentAuthoringDashboard } from '@/app/shared/assessment-authoring';

export const metadata = {
  ...metaObject('Assessment Authoring Console'),
};

export default function ExpertLabPage() {
  return <AssessmentAuthoringDashboard />;
}
