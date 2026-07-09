import { Metadata } from 'next';
import { LAYOUT_OPTIONS } from '@/config/enums';
import {
  BRAND_LOGO_HEIGHT,
  BRAND_LOGO_SRC,
  BRAND_LOGO_WIDTH,
  BRAND_MARK_HEIGHT,
  BRAND_MARK_SRC,
  BRAND_MARK_WIDTH,
} from '@core/components/logo';
import { OpenGraph } from 'next/dist/lib/metadata/types/opengraph-types';

enum MODE {
  DARK = 'dark',
  LIGHT = 'light',
}

export {
  BRAND_LOGO_HEIGHT,
  BRAND_LOGO_WIDTH,
  BRAND_MARK_HEIGHT,
  BRAND_MARK_WIDTH,
} from '@core/components/logo';

/** Local static favicons — served from /public (no Google Fonts / no dynamic metadata routes). */
export const APP_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/brand/brand-mark-4x.png', sizes: '512x512', type: 'image/png' },
    { url: '/brand/browser-tab.svg', type: 'image/svg+xml' },
  ],
  apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  shortcut: ['/brand/brand-mark-4x.png'],
};

export const siteConfig = {
  title: 'Holand Platform',
  description: `Holand Platform — Holland (RIASEC) and MBTI assessments with actionable career and education guidance.`,
  logo: BRAND_LOGO_SRC,
  icon: BRAND_MARK_SRC,
  mode: MODE.LIGHT,
  layout: LAYOUT_OPTIONS.HYDROGEN,
};

export const metaObject = (
  title?: string,
  openGraph?: OpenGraph,
  description: string = siteConfig.description
): Metadata => {
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';

  return {
    title: title ? `${title} · ${siteConfig.title}` : siteConfig.title,
    description,
    openGraph: openGraph ?? {
      title: title ? `${title} · ${siteConfig.title}` : siteConfig.title,
      description,
      url: siteUrl,
      siteName: siteConfig.title,
      images: {
        url: `${siteUrl}${BRAND_LOGO_SRC}`,
        width: BRAND_LOGO_WIDTH,
        height: BRAND_LOGO_HEIGHT,
      },
      locale: 'en_US',
      type: 'website',
    },
  };
};
