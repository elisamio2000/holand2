'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Title, Button } from 'rizzui';
import { PiHouseLineBold } from 'react-icons/pi';
import SocialItems from '@core/ui/social-shares';
import {
  BRAND_LOGO_HEIGHT,
  BRAND_LOGO_WIDTH,
  siteConfig,
} from '@/config/site.config';
import NotFoundImg from '@public/not-found.png';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <div className="sticky top-0 z-40 flex justify-center py-5 backdrop-blur-lg lg:backdrop-blur-none xl:py-10">
        <Link href="/">
          <Image
            src={siteConfig.logo}
            alt={siteConfig.title}
            width={BRAND_LOGO_WIDTH}
            height={BRAND_LOGO_HEIGHT}
            className="h-auto w-auto max-w-[200px] dark:invert"
            priority
          />
        </Link>
      </div>

      <div className="flex grow items-center px-6 xl:px-10">
        <div className="mx-auto text-center">
          <Image
            src={NotFoundImg}
            alt="not found"
            className="mx-auto mb-8 aspect-[360/326] max-w-[256px] xs:max-w-[370px] lg:mb-12 2xl:mb-16"
          />
          <Title
            as="h1"
            className="text-[22px] font-bold leading-normal text-gray-1000 lg:text-3xl"
          >
            {t('systemPages.notFound.title')}
          </Title>
          <p className="mt-3 text-sm leading-loose text-gray-500 lg:mt-6 lg:text-base lg:leading-loose">
            {t('systemPages.notFound.subtitle')}
          </p>
          <Link href={'/'}>
            <Button
              as="span"
              size="xl"
              color="primary"
              className="mt-8 h-12 px-4 xl:h-14 xl:px-6"
            >
              <PiHouseLineBold className="mr-1.5 text-lg" />
              {t('systemPages.notFound.goHome')}
            </Button>
          </Link>
        </div>
      </div>
      <SocialItems />
    </div>
  );
}
