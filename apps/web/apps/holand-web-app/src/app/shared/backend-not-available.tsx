// ============================================
// BackendNotAvailable — Standardized banner for missing endpoints
// Shows required API endpoints with structured layout
// ============================================
'use client';

import { Title, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCloudSlashBold } from 'react-icons/pi';

/**
 * Endpoint definition for the "Backend Not Available" banner.
 */
interface EndpointInfo {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Endpoint path */
  path: string;
  /** Brief description */
  description: string;
}

interface BackendNotAvailableProps {
  /** Title of the section */
  title?: string;
  /** Description text */
  description?: string;
  /** List of required endpoints */
  endpoints?: EndpointInfo[];
  /** Additional CSS classes */
  className?: string;
  /** Version tag */
  version?: string;
}

/**
 * BackendNotAvailable — Orange-bordered banner indicating missing backend endpoints.
 *
 * Displays a list of required API endpoints that have not been
 * implemented yet. Follows the project's established pattern from
 * roles-permissions page.
 *
 * @param title - Banner title (default: "Backend Not Available")
 * @param description - Explanation text
 * @param endpoints - Array of required endpoints with method, path, description
 * @param className - Additional CSS classes
 * @param version - Version tag
 *
 * @example
 * ```tsx
 * <BackendNotAvailable
 *   title="Cases API"
 *   endpoints={[
 *     { method: 'GET', path: '/cases/', description: 'List all cases' },
 *     { method: 'POST', path: '/cases/', description: 'Create a new case' },
 *   ]}
 * />
 * ```
 */
export default function BackendNotAvailable({
  title = 'Backend Not Available',
  description = 'The backend endpoints required for this page have not been implemented yet.',
  endpoints = [],
  className,
  version,
}: BackendNotAvailableProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6',
        'dark:border-orange-800 dark:bg-orange-950/30',
        className
      )}
    >
      <div className="flex flex-col items-center text-center">
        <PiCloudSlashBold className="h-10 w-10 text-orange-500" />
        <Title as="h3" className="mt-3 text-lg font-semibold text-orange-700 dark:text-orange-400">
          {title}
        </Title>
        <Text className="mt-1 max-w-lg text-sm text-orange-600 dark:text-orange-300/80">
          {description}
        </Text>
        {version && (
          <Text className="mt-1 text-xs text-orange-400 dark:text-orange-500">
            v{version}
          </Text>
        )}
      </div>

      {endpoints.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-md border border-orange-200 dark:border-orange-800/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-orange-100 dark:bg-orange-900/30">
                <th className="px-4 py-2 text-start font-medium text-orange-700 dark:text-orange-400">
                  Method
                </th>
                <th className="px-4 py-2 text-start font-medium text-orange-700 dark:text-orange-400">
                  Endpoint
                </th>
                <th className="px-4 py-2 text-start font-medium text-orange-700 dark:text-orange-400">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, idx) => (
                <tr
                  key={`${ep.method}-${ep.path}`}
                  className={cn(
                    'border-t border-orange-200 dark:border-orange-800/50',
                    idx % 2 === 0
                      ? 'bg-white dark:bg-gray-100/50'
                      : 'bg-orange-50/50 dark:bg-orange-950/20'
                  )}
                >
                  <td className="px-4 py-2">
                    <span
                      className={cn(
                        'inline-block rounded px-2 py-0.5 text-xs font-bold',
                        ep.method === 'GET' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                        ep.method === 'POST' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                        ep.method === 'PUT' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                        ep.method === 'PATCH' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        ep.method === 'DELETE' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      )}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {ep.path}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {ep.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
