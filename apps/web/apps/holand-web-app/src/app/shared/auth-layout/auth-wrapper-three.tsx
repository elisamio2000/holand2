'use client';

import Logo from '@core/components/logo';
import Link from 'next/link';
import { Button, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiArrowLeftBold } from 'react-icons/pi';
import { FcGoogle } from 'react-icons/fc';
import { BsFacebook } from 'react-icons/bs';
import OrSeparation from '@/app/shared/auth-layout/or-separation';
import LanguageSwitcher from '@/app/shared/language-switcher';

export default function AuthWrapperThree({
  children,
  title,
  isSocialLoginActive = false,
  isSignIn = false,
  className = '',
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  isSocialLoginActive?: boolean;
  isSignIn?: boolean;
  className?: string;
}) {
  return (
    <>
      <div className="relative flex min-h-screen w-full flex-col justify-center bg-gradient-to-tr from-[#136A8A] to-[#267871] p-4 md:p-12 lg:p-28">
        <div className="absolute start-4 top-4 z-10 flex items-center gap-4">
          <Link
            href={'/'}
            className="flex items-center justify-center text-sm font-medium text-white/80 hover:text-white"
          >
            <PiArrowLeftBold />
            <span className="-mt-px ms-1 font-lexend">Back to home</span>
          </Link>
          <LanguageSwitcher variant="outline" size="sm" className="border-white/30 text-white hover:border-white hover:text-white" />
        </div>
        <div
          className={cn(
            'mx-auto w-full max-w-md rounded-xl bg-white px-4 py-9 dark:bg-gray-50 sm:px-6 md:max-w-xl md:px-10 md:py-12 lg:max-w-[700px] lg:px-16 xl:rounded-2xl 3xl:rounded-3xl',
            className
          )}
        >
          <div className="flex flex-col items-center">
            <Link href={'/'} className="mb-7 inline-block max-w-[64px] lg:mb-9">
              <Logo iconOnly alt="ERMINE" className="h-10 w-auto" />
            </Link>
            <Title
              as="h2"
              className="mb-7 text-center text-[26px] leading-snug md:text-3xl md:!leading-normal lg:mb-10 lg:text-4xl lg:leading-normal"
            >
              {title}
            </Title>
          </div>
          {isSocialLoginActive && (
            <>
              <div className="flex flex-col gap-4 pb-6 md:flex-row md:gap-6 md:pb-7">
                <Button className="h-11 w-full" variant="outline">
                  <BsFacebook className="me-2 h-5 w-5 shrink-0 text-primary" />
                  <span className="truncate">Signin With Facebook</span>
                </Button>
                <Button variant="outline" className="h-11 w-full">
                  <FcGoogle className="me-2 h-5 w-5 shrink-0" />
                  <span className="truncate">Signin With Google</span>
                </Button>
              </div>
              <OrSeparation
                title={`Or, Sign ${isSignIn ? 'in' : 'up'} with your email`}
                isCenter
                className="mb-4"
              />
            </>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
