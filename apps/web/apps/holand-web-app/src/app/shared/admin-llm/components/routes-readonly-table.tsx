'use client';

import { Badge, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { LlmRoute } from '@/types/pipeline-admin.types';
import { formatModelLabel } from '../utils/format-model-label';

interface RoutesReadOnlyTableProps {
  routes: LlmRoute[];
  parseConstraints?: (route: LlmRoute) => Record<string, unknown> | null;
}

export default function RoutesReadOnlyTable({
  routes,
  parseConstraints,
}: RoutesReadOnlyTableProps) {
  const { t } = useTranslation();
  const toolRoutes = routes.filter((r) => r.route_key.startsWith('tool.'));

  return (
    <div className="space-y-3">
      <Text className="text-sm text-gray-500">
        {t('llmPage.routes.toolRoutes', {
          count: toolRoutes.length,
          total: routes.length,
        })}
      </Text>
      <div className="overflow-x-auto rounded-xl border border-muted">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-gray-600 dark:bg-gray-100/50">
            <tr>
              <th className="px-3 py-2 text-start">route_key</th>
              <th className="px-3 py-2 text-start">model</th>
              <th className="px-3 py-2 text-start">fallback</th>
              <th className="px-3 py-2 text-start">api</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const c = parseConstraints?.(r);
              const api = (c?.api as string) ?? (c?.purpose as string) ?? '—';
              return (
                <tr key={r.id ?? r.route_key} className="border-t border-muted">
                  <td className="px-3 py-2 font-mono text-xs">{r.route_key}</td>
                  <td className="px-3 py-2">{formatModelLabel(r.model_name)}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatModelLabel(r.fallback_model_name)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge size="sm" variant="flat">
                      {api}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
