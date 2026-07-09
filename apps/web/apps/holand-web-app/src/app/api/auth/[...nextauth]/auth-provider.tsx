'use client';

import { SessionProvider } from 'next-auth/react';

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
      {children}
    </SessionProvider>
  );
}
