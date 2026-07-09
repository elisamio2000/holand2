import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { metaObject } from '@/config/site.config';

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, '-');
}

const PAGE_TITLES: Record<string, string> = {
  'geo-location': 'تحلیل موقعیت مکانی',
  'offline-map': 'نقشه آفلاین',
  tts: 'تبدیل متن به گفتار',
  'text-to-speech': 'تبدیل متن به گفتار',
};

export async function generateMetadata({
  params,
}: {
  params: { pluginId: string };
}): Promise<Metadata> {
  const slug = normalizeSlug(params.pluginId);
  return {
    ...metaObject(PAGE_TITLES[slug] ?? `Plugin: ${params.pluginId}`),
  };
}

export default async function InternalNativePluginDynamicPage({
  params,
}: {
  params: { pluginId: string };
}) {
  const slug = normalizeSlug(params.pluginId);

  switch (slug) {
    case 'geo-location':
      redirect('/plugins/external-plugins/geo-location');
      break;

    case 'offline-map':
      redirect('/plugins/external-plugins/offline-map');
      break;

    case 'tts':
    case 'text-to-speech':
      redirect('/plugins/external-plugins/TTS');
      break;

    default:
      notFound();
  }
}
