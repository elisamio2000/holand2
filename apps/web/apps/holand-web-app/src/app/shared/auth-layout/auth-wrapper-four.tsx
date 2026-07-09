// ============================================
// AuthWrapperFour — Auth page layout wrapper
// Shared layout for sign-in, sign-up, forgot-password, OTP pages
// ============================================
'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { routes } from '@/config/routes';
import Logo from '@core/components/logo';
import { usePathname } from 'next/navigation';
import cn from '@core/utils/class-names';
import { PiArrowLineRight, PiUserCirclePlus } from 'react-icons/pi';
import { siteConfig } from '@/config/site.config';
import LanguageSwitcher from '@/app/shared/language-switcher';

/**
 * AuthNavLink — Navigation link for auth header with active state.
 */
function AuthNavLink({
  href,
  children,
}: React.PropsWithChildren<{
  href: string;
}>) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-x-1 rounded-3xl p-2 py-1 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 md:px-4 md:py-2.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-gray-500',
        pathname === href ? 'bg-gray-100 text-gray-900 [&>svg]:text-gray-900' : ''
      )}
    >
      {children}
    </Link>
  );
}

/**
 * AuthWelcomeTitle — Two-line welcome heading (primary + secondary).
 */
function AuthWelcomeTitle({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  const primary = t(`${titleKey}.primary`, { defaultValue: '' });
  const secondary = t(`${titleKey}.secondary`, { defaultValue: '' });

  if (primary && secondary) {
    return (
      <div className="mb-7 text-center lg:mb-10">
        <p className="text-[28px] font-bold leading-snug text-gray-900 md:text-3xl md:leading-normal lg:text-4xl">
          {primary}
        </p>
        <p className="mt-2 text-xl font-bold leading-snug text-gray-600 md:text-2xl lg:text-[28px]">
          {secondary}
        </p>
      </div>
    );
  }

  const legacy = t(titleKey);
  return (
    <p className="mb-7 text-center text-[28px] font-bold leading-snug text-gray-900 md:text-3xl md:leading-normal lg:mb-10 lg:text-4xl">
      {legacy.split('\n').map((line, index, lines) => (
        <span key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </p>
  );
}

/**
 * AuthWrapperFour — Auth page layout with header, footer, and optional welcome title.
 */
export default function AuthWrapperFour({
  children,
  title,
  titleKey,
  isSocialLoginActive: _isSocialLoginActive = false,
  isSignIn: _isSignIn = false,
  layout = 'form',
  className = '',
}: {
  children: React.ReactNode;
  title?: React.ReactNode;
  titleKey?: string;
  isSocialLoginActive?: boolean;
  isSignIn?: boolean;
  /** `document` — legal/help pages with compact logo */
  layout?: 'form' | 'document';
  className?: string;
}) {
  const showHeading = Boolean(titleKey) || title != null;
  const isDocumentLayout = layout === 'document';

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-gray-50/40">
      <AuthHeader />

      <div className="flex w-full flex-col justify-center px-5">
        <div
          className={cn(
            'mx-auto w-full py-12 2xl:pb-8 2xl:pt-2',
            isDocumentLayout ? 'max-w-6xl' : 'max-w-md md:max-w-lg lg:max-w-xl',
            className
          )}
        >
          {!isDocumentLayout && (
            <div className="flex flex-col items-center">
              <Link
                href="/"
                className={cn(
                  'inline-flex max-w-[min(100%,420px)] text-gray-900 dark:text-white',
                  showHeading ? 'mb-7 lg:mb-9' : 'mb-10 lg:mb-12'
                )}
                aria-label={siteConfig.title}
              >
                <Logo className="h-24 w-auto md:h-28 lg:h-32" />
              </Link>
              {titleKey && <AuthWelcomeTitle titleKey={titleKey} />}
              {!titleKey && title != null && (
                <div className="mb-7 text-center lg:mb-10">{title}</div>
              )}
            </div>
          )}

          {isDocumentLayout && (
            <div className="mb-6 flex justify-center md:mb-8">
              <Link
                href="/"
                className="inline-flex text-gray-900 dark:text-white"
                aria-label={siteConfig.title}
              >
                <Logo className="h-10 w-auto md:h-11" />
              </Link>
            </div>
          )}

          {children}
        </div>
      </div>

      <AuthFooter />
    </div>
  );
}

function AuthHeader() {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between bg-white p-4 lg:px-16 lg:py-6 2xl:px-24">
      <AuthNavLink href={routes.auth.signIn}>
        <PiArrowLineRight className="h-4 w-4" />
        <span>{t('authPages.login')}</span>
      </AuthNavLink>
      <div className="flex items-center gap-x-2 md:gap-x-4">
        <LanguageSwitcher appearance="authNav" />
        <AuthNavLink href={routes.auth.signUp}>
          <PiUserCirclePlus className="h-4 w-4" />
          <span>{t('authPages.signUp.title')}</span>
        </AuthNavLink>
      </div>
    </header>
  );
}

function AuthFooter() {
  const { t } = useTranslation();

  const footerMenu = [
    { nameKey: 'authPages.footer.help', href: routes.legal.help },
    { nameKey: 'authPages.footer.privacy', href: routes.legal.privacy },
    { nameKey: 'authPages.footer.terms', href: routes.legal.terms },
  ] as const;

  return (
    <footer className="flex flex-col-reverse items-center justify-between border-t border-gray-100 bg-white px-4 py-5 lg:flex-row lg:px-16 lg:py-6 2xl:px-24 2xl:py-10">
      <div className="text-center text-sm leading-relaxed text-gray-500 lg:text-start">
        {t('authPages.footer.copyright')}
      </div>
      <nav
        className="-mx-2.5 flex flex-wrap items-center justify-center gap-1 pb-3 font-medium text-gray-700 lg:w-1/2 lg:justify-end lg:pb-0"
        aria-label={t('authPages.footer.navLabel')}
      >
        {footerMenu.map((item) => (
          <Link
            key={item.nameKey}
            href={item.href}
            className="rounded-lg px-2.5 py-1.5 transition-colors hover:bg-gray-100 hover:text-primary"
          >
            {t(item.nameKey)}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
