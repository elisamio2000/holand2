import { metaObject } from '@/config/site.config';
import { ExpertLabDashboard } from '@/app/shared/expert-lab';

export const metadata = {
  ...metaObject('Expert Analyst Lab'),
};

export default function ExpertLabPage() {
  return <ExpertLabDashboard />;
}

