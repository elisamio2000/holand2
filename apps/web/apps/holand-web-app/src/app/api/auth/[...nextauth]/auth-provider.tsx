'use client';

import { SessionProvider } from 'next-auth/react';
import DashboardPreferencesMigrator from '@/app/shared/admin-dashboard/components/dashboard-preferences-migrator';

export default function AuthProvider({
  children,
  session,
}: {
  children: React.ReactNode;
  session: any;
}): React.ReactNode {
  return (
    <SessionProvider
      session={session}
      refetchInterval={4 * 60}
      refetchOnWindowFocus
    >
      <DashboardPreferencesMigrator />
      {children}
    </SessionProvider>
  );
}
