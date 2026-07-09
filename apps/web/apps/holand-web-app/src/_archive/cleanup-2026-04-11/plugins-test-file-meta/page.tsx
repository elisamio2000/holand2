import TranslatedPageHeader from '@/app/shared/translated-page-header';
import PluginViewer from '@/app/shared/plugins/plugin-viewer';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Plugin Test - file.meta'),
};

/**
 * PluginTestPage — Test page for file.meta plugin integration.
 * 
 * Demonstrates how to use PluginViewer to display standalone plugin UIs
 * within Next.js application.
 * 
 * @version 0.29.0
 */
export default function PluginTestPage() {
  // Sample data for testing file.meta plugin
  const sampleData = {
    result: {
      data: {
        filename: 'sample_image.jpg',
        filepath: '/uploads/cases/case_001/sample_image.jpg',
        parent_dir: '/uploads/cases/case_001',
        extension: '.jpg',
        kind: 'image',
        mime_type: 'image/jpeg',
        mime_description: 'JPEG image data, JFIF standard 1.01',
        encoding: 'binary',
        stats: {
          size_bytes: 2457600,
          size_formatted: '2.3 MB',
          modified_at: '2026-04-06T10:30:00Z',
          created_at: '2026-04-05T14:20:00Z',
          accessed_at: '2026-04-06T11:15:00Z',
          is_symlink: false,
        },
      },
      channels: {
        ui: {
          file: {
            filename: 'sample_image.jpg',
            filepath: '/uploads/cases/case_001/sample_image.jpg',
            size: 2457600,
            size_formatted: '2.3 MB',
            modified_at: '2026-04-06T10:30:00Z',
          },
          type: {
            mime_type: 'image/jpeg',
            kind: 'image',
            extension: '.jpg',
            description: 'JPEG image data',
          },
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          location: {
            latitude: 35.6892,
            longitude: 51.3890,
            altitude: 1200,
            source: 'EXIF GPS',
          },
        },
        metadata: {
          has_exiftool: true,
          exiftool_tags_count: 42,
          lens_model: 'EF 50mm f/1.8 STM',
          serial_number: '0123456789',
          shutter_count: 12345,
          focus_mode: 'AF-S',
          image: {
            width: 3840,
            height: 2160,
            format: 'JPEG',
            mode: 'RGB',
            has_exif: true,
            camera: {
              make: 'Canon',
              model: 'EOS 5D Mark IV',
              lens: 'EF 50mm f/1.8 STM',
              software: 'Adobe Photoshop CC 2021',
            },
            capture: {
              datetime: '2026:04:05 14:20:00',
              iso: 100,
              shutter_speed: '1/125',
              aperture: 'f/1.8',
              focal_length: '50mm',
              flash: 'Off',
            },
            gps: {
              latitude: 35.6892,
              longitude: 51.3890,
              altitude: 1200,
            },
          },
        },
      },
    },
  };

  return (
    <>
      <TranslatedPageHeader
        titleKey="pages.pluginsAndApps"
        breadcrumb={[
          { nameKey: 'pages.dashboard', href: '/' },
          { nameKey: 'pages.plugins', href: '/plugins' },
          { nameKey: 'Plugin Test: file.meta', href: '#' },
        ]}
      />

      <div className="space-y-6">
        {/* Instructions Card */}
        <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
          <h3 className="mb-4 text-lg font-semibold">
            🔌 Plugin Integration Test
          </h3>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            این صفحه نمایش‌دهنده نحوه استفاده از پلاگین‌های standalone در Next.js است.
            پلاگین file.meta در یک iframe بارگذاری شده و داده‌های نمونه به آن ارسال می‌شود.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-medium">✅ موارد پیاده‌سازی شده:</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>کامپوننت PluginViewer</li>
                <li>ارتباط با postMessage</li>
                <li>Theme sync با parent</li>
                <li>Loading و error handling</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium">📋 مراحل بعدی:</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>اتصال به API واقعی</li>
                <li>آپلود فایل و دریافت متادیتا</li>
                <li>ذخیره نتایج در دیتابیس</li>
                <li>Integration با case management</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Plugin Viewer */}
        <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
          <PluginViewer 
            pluginId="file.meta" 
            data={sampleData}
            height="1000px"
          />
        </div>
      </div>
    </>
  );
}
