import { Toaster } from 'react-hot-toast';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import AuthProvider from '@/app/api/auth/[...nextauth]/auth-provider';
import BugReporterRoot from '@/app/shared/bug-reporter/bug-reporter-root';
import GlobalDrawer from '@/app/shared/drawer-views/container';
import GlobalModal from '@/app/shared/modal-views/container';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { JotaiProvider, ThemeProvider } from '@/app/shared/theme-provider';
import PlatformDefaultsApplier from '@/hooks/use-platform-defaults';
import { LanguageProvider } from '@/providers/language-provider';
import { siteConfig, APP_ICONS } from '@/config/site.config';
import { inter, lexendDeca, vazirmatn } from '@/app/fonts';
import cn from '@core/utils/class-names';
import NextProgress from '@core/components/next-progress';

// styles
import 'swiper/css';
import 'swiper/css/navigation';
import '@/app/globals.css';

export const metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  icons: APP_ICONS,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  return (
    <html
      lang="en"
      dir="ltr"
      // required this one for next-themes, remove it if you are not using next-theme
      suppressHydrationWarning
    >
      <body
        // to prevent any warning that is caused by third party extensions like Grammarly
        suppressHydrationWarning
        className={cn(inter.variable, lexendDeca.variable, vazirmatn.variable, 'font-inter')}
      >
        <AuthProvider session={session}>
          <WorkspaceProvider>
            <ThemeProvider>
              <NextProgress />
              <JotaiProvider>
                <LanguageProvider>
                  <PlatformDefaultsApplier />
                  <BugReporterRoot>
                    {children}
                    <Toaster />
                    <GlobalDrawer />
                    <GlobalModal />
                  </BugReporterRoot>
                </LanguageProvider>
              </JotaiProvider>
            </ThemeProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
