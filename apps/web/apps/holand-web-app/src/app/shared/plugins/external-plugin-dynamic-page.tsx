// ============================================
// External plugin dynamic route — shared by:
//   /plugins/external/[pluginId]  (legacy; prefer external-plugins)
//   /plugins/external-plugins/[pluginId]  (canonical)
// ============================================
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options';
import { metaObject } from '@/config/site.config';
import PluginDetailView from '@/app/shared/plugins/plugin-detail-view';
import ExternalPluginLegacyPreview from '@/app/(hydrogen)/plugins/external/[pluginId]/legacy-preview';

function normalizeSlug(raw: string): string {
  return raw.replace(/\./g, '-').toLowerCase();
}

/** Static tools with dedicated pages under /plugins/external-plugins/… */
const DEDICATED_ROUTES: Record<string, string> = {
  'file-meta': '/plugins/external-plugins/file-meta',
  'image-ocr': '/plugins/external-plugins/image-ocr',
  'geo-location': '/plugins/external-plugins/geo-location',
  'offline-map': '/plugins/external-plugins/offline-map',
  tts: '/plugins/external-plugins/TTS',
  'text-to-speech': '/plugins/external-plugins/TTS',
  'geo-location-old': '/plugins/external-plugins/geo-location-old',
  'offline-map-old': '/plugins/external-plugins/offline-map-old',
};

/** Legacy external slugs → canonical external URLs */
const LEGACY_EXTERNAL_CANONICAL: Record<string, string> = {
  'analysis-geo_location': '/plugins/external-plugins/geo-location',
};

const PLUGIN_TITLES: Record<string, string> = {
  'analysis-geo_location': 'تحلیل موقعیت جغرافیایی',
  'geo-location': 'تحلیل موقعیت جغرافیایی',
  'offline-map': 'نقشه آفلاین',
  tts: 'تبدیل متن به گفتار',
  'text-to-speech': 'تبدیل متن به گفتار',
  'image-ocr': 'تشخیص متن از تصویر',
  'file-meta': 'استخراج متادیتای فایل',
  'file-secure': 'تحلیل امنیتی فایل',
  'image-describe': 'توصیف تصویر با AI',
  'image-faces': 'تشخیص چهره',
  'audio-transcribe': 'تبدیل صدا به متن',
  'text-search': 'جستجوی متن',
};

export async function generateMetadata({
  params,
}: {
  params: { pluginId: string };
}): Promise<Metadata> {
  const slug = normalizeSlug(params.pluginId);
  return {
    ...metaObject(PLUGIN_TITLES[slug] ?? `Plugin: ${params.pluginId}`),
  };
}

export default async function ExternalPluginDynamicPage({
  params,
}: {
  params: { pluginId: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    console.warn('[ExternalPluginDynamicPage] Unauthorized:', {
      pluginId: params.pluginId,
    });
    redirect('/signin');
  }

  console.info('[ExternalPluginDynamicPage] Authorized:', {
    pluginId: params.pluginId,
    userId: session.user.id,
  });

  const slug = normalizeSlug(params.pluginId);

  const legacyCanonical = LEGACY_EXTERNAL_CANONICAL[slug];
  if (legacyCanonical) {
    redirect(legacyCanonical);
  }

  const dedicatedRoute = DEDICATED_ROUTES[slug];
  if (dedicatedRoute) {
    redirect(dedicatedRoute);
  }

  const backendPluginId = params.pluginId.replace(/-/g, '.');

  return (
    <div className="@container/main flex flex-col gap-4 p-4 lg:p-6">
      <PluginDetailView pluginId={backendPluginId} />
      <ExternalPluginLegacyPreview pluginId={backendPluginId} />
    </div>
  );
}
