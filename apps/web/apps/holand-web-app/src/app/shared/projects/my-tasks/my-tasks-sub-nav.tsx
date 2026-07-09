'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { useTranslation } from 'react-i18next';

const tabs = [
  { key: 'assigned', href: routes.projects.myTasksAssigned, labelKey: 'projects.myTasks.assigned' },
  { key: 'today', href: routes.projects.myTasksToday, labelKey: 'projects.myTasks.todayOverdue' },
  { key: 'personal', href: routes.projects.myTasksPersonal, labelKey: 'projects.myTasks.personal' },
] as const;

export default function MyTasksSubNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="flex gap-1 border-b border-muted">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.key === 'assigned' && pathname === routes.projects.myTasks);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
