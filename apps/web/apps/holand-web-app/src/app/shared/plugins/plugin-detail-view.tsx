// ============================================
// PluginDetailView — Plugin detail and execution view
// Shows plugin info, arguments form, and execution results
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Title, Text, Badge, Loader, Button, Input, Textarea, ActionIcon } from 'rizzui';
import {
  PiArrowLeftBold,
  PiPlayBold,
  PiInfoBold,
  PiGearSixBold,
  PiCheckCircleBold,
  PiXCircleBold,
  PiWarningBold,
  PiCubeBold,
  PiCodeBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { pluginsService } from '@/services/plugins.service';
import { routes } from '@/config/routes';
import PageHeader from '@/app/shared/page-header';
import type { PluginInfo, PluginRunResult } from '@/types/plugins.types';

/**
 * PluginDetailView — View and execute a specific plugin.
 *
 * Features:
 * - Fetches plugin info from GET /tools/{tool_id}
 * - Dynamic form based on plugin args schema
 * - Executes plugin via POST /tools/{tool_id}/run
 * - Displays results in structured format
 * - Shows UI channel if available (iframe)
 *
 * @requires pluginsService
 * @version 0.27.0
 */
export default function PluginDetailView({ pluginId }: { pluginId: string }) {
  const router = useRouter();
  const [plugin, setPlugin] = useState<PluginInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<PluginRunResult | null>(null);
  const [args, setArgs] = useState<Record<string, unknown>>({});

  // ==========================================
  // Data Fetching
  // ==========================================

  /**
   * Fetch plugin information.
   * @endpoint GET /tools/{tool_id}
   */
  const fetchPlugin = useCallback(async () => {
    console.info('[PluginDetailView] Fetching plugin:', { pluginId });
    setLoading(true);
    setError(null);
    try {
      const data = await pluginsService.getToolInfo(pluginId);
      console.info('[PluginDetailView] Plugin loaded:', {
        pluginId,
        name: data.name,
      });
      setPlugin(data);

      // Initialize args with defaults
      const initialArgs: Record<string, unknown> = {};
      if (data.args) {
        Object.keys(data.args).forEach((key) => {
          initialArgs[key] = '';
        });
      }
      setArgs(initialArgs);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load plugin info';
      console.error('[PluginDetailView] Fetch failed:', { pluginId, err });
      setError(errorMsg);
      toast.error('Failed to load plugin');
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    fetchPlugin();
  }, [fetchPlugin]);

  // ==========================================
  // Plugin Execution
  // ==========================================

  /**
   * Execute the plugin with current args.
   * @endpoint POST /tools/{tool_id}/run
   */
  const handleRun = async () => {
    console.info('[PluginDetailView] Executing plugin:', { pluginId, args });
    setExecuting(true);
    setResult(null);
    try {
      const data = await pluginsService.runTool(pluginId, args);
      console.info('[PluginDetailView] Plugin executed:', {
        pluginId,
        status: data.status,
      });
      setResult(data);
      
      if (data.status === 'success' || data.status === 'completed') {
        toast.success('Plugin executed successfully');
      } else if (data.status === 'error') {
        toast.error(data.error || 'Plugin execution failed');
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Plugin execution failed';
      console.error('[PluginDetailView] Execution failed:', {
        pluginId,
        args,
        err,
      });
      toast.error(errorMsg);
      setResult({
        tool_id: pluginId,
        status: 'error',
        error: errorMsg,
      });
    } finally {
      setExecuting(false);
    }
  };

  // ==========================================
  // Helpers
  // ==========================================

  const getCategoryColor = pluginsService.getCategoryColor;

  const updateArg = (key: string, value: unknown) => {
    setArgs((prev) => ({ ...prev, [key]: value }));
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !plugin) {
    return (
      <div>
        <PageHeader
          title="Plugin Not Found"
          breadcrumb={[
            { name: 'Dashboard', href: routes.eCommerce.dashboard },
            { name: 'Plugins', href: routes.plugins.dashboard },
            { name: pluginId },
          ]}
        />
        <div className="mt-6 rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <PiXCircleBold className="mx-auto h-12 w-12 text-red-500" />
          <Title as="h5" className="mt-4 text-red-600 dark:text-red-400">
            {error || 'Plugin not found'}
          </Title>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(routes.plugins.dashboard)}
          >
            <PiArrowLeftBold className="me-2 h-4 w-4" />
            Back to Plugins
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={plugin.name || plugin.tool_id}
        breadcrumb={[
          { name: 'Dashboard', href: routes.eCommerce.dashboard },
          { name: 'Plugins', href: routes.plugins.dashboard },
          { name: plugin.name || plugin.tool_id },
        ]}
      >
        <Button
          variant="outline"
          onClick={() => router.push(routes.plugins.dashboard)}
          className="mt-4 w-full @lg:mt-0 @lg:w-auto"
        >
          <PiArrowLeftBold className="me-2 h-4 w-4" />
          Back
        </Button>
      </PageHeader>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Plugin Info */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <PiCubeBold className="h-8 w-8 text-primary" />
            </div>

            <Title as="h5" className="mb-2 font-semibold">
              {plugin.name || plugin.tool_id}
            </Title>
            <Text className="mb-1 font-mono text-xs text-gray-400">
              {plugin.tool_id}
            </Text>

            {plugin.category && (
              <Badge
                variant="flat"
                color={getCategoryColor(plugin.category)}
                className="mb-4 capitalize"
              >
                {plugin.category}
              </Badge>
            )}

            {plugin.description && (
              <Text className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                {plugin.description}
              </Text>
            )}

            {/* Plugin Metadata */}
            <div className="space-y-2 border-t border-muted pt-4 text-sm">
              {plugin.version && (
                <div className="flex justify-between">
                  <Text className="text-gray-500">Version</Text>
                  <Text className="font-medium">{plugin.version}</Text>
                </div>
              )}
              {plugin.updated_at && (
                <div className="flex justify-between">
                  <Text className="text-gray-500">Updated</Text>
                  <Text className="font-medium">{plugin.updated_at}</Text>
                </div>
              )}
              {plugin.timeout_sec && (
                <div className="flex justify-between">
                  <Text className="text-gray-500">Timeout</Text>
                  <Text className="font-medium">{plugin.timeout_sec}s</Text>
                </div>
              )}
            </div>

            {/* Capabilities */}
            {plugin.capabilities && plugin.capabilities.length > 0 && (
              <div className="mt-4 border-t border-muted pt-4">
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Capabilities
                </Text>
                <div className="flex flex-wrap gap-1">
                  {plugin.capabilities.map((cap) => (
                    <Badge key={cap} variant="outline" size="sm">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* MIME Types */}
            {plugin.mime_types && plugin.mime_types.length > 0 && (
              <div className="mt-4 border-t border-muted pt-4">
                <Text className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  MIME Types
                </Text>
                <div className="flex flex-wrap gap-1">
                  {plugin.mime_types.map((mime) => (
                    <Badge key={String(mime)} variant="outline" size="sm">
                      {String(mime)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Args Form + Results */}
        <div className="lg:col-span-2">
          {/* Arguments Form */}
          <div className="mb-6 rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
            <div className="mb-4 flex items-center gap-2">
              <PiGearSixBold className="h-5 w-5 text-primary" />
              <Title as="h6" className="font-semibold">
                Arguments
              </Title>
            </div>

            {plugin.args && Object.keys(plugin.args).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(plugin.args).map(([key, schema]) => {
                  const isRequired = String(schema).includes('required');
                  const description = String(schema).replace(/^string|required|optional/gi, '').replace(/[-—]/g, '').trim();
                  
                  return (
                    <div key={key}>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {key}
                        {isRequired && (
                          <span className="ms-1 text-red-500">*</span>
                        )}
                      </label>
                      {description && (
                        <Text className="mb-1 text-xs text-gray-500">
                          {description}
                        </Text>
                      )}
                      {key === 'path' || key.includes('file') ? (
                        <Input
                          type="text"
                          placeholder={`Enter ${key}...`}
                          value={String(args[key] || '')}
                          onChange={(e) => updateArg(key, e.target.value)}
                        />
                      ) : (
                        <Input
                          type="text"
                          placeholder={`Enter ${key}...`}
                          value={String(args[key] || '')}
                          onChange={(e) => updateArg(key, e.target.value)}
                        />
                      )}
                    </div>
                  );
                })}

                <Button
                  onClick={handleRun}
                  disabled={executing}
                  className="w-full gap-2"
                >
                  {executing ? (
                    <>
                      <Loader size="sm" variant="spinner" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <PiPlayBold className="h-4 w-4" />
                      Run Plugin
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-500">
                <PiInfoBold className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <Text>This plugin has no configurable arguments.</Text>
                <Button onClick={handleRun} disabled={executing} className="mt-4">
                  {executing ? (
                    <>
                      <Loader size="sm" variant="spinner" />
                      Executing...
                    </>
                  ) : (
                    <>
                      <PiPlayBold className="me-2 h-4 w-4" />
                      Run Plugin
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Execution Results */}
          {result && (
            <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiCodeBold className="h-5 w-5 text-primary" />
                  <Title as="h6" className="font-semibold">
                    Result
                  </Title>
                </div>
                {result.status === 'success' || result.status === 'completed' ? (
                  <Badge variant="flat" color="success" className="gap-1">
                    <PiCheckCircleBold className="h-3.5 w-3.5" />
                    Success
                  </Badge>
                ) : result.status === 'error' ? (
                  <Badge variant="flat" color="danger" className="gap-1">
                    <PiXCircleBold className="h-3.5 w-3.5" />
                    Error
                  </Badge>
                ) : (
                  <Badge variant="flat" color="warning" className="gap-1">
                    <PiWarningBold className="h-3.5 w-3.5" />
                    {result.status}
                  </Badge>
                )}
              </div>

              {/* Error Message */}
              {result.error && (
                <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
                  <Text className="text-sm text-red-600 dark:text-red-400">
                    {result.error}
                  </Text>
                </div>
              )}

              {/* Warnings */}
              {result.warnings && result.warnings.length > 0 && (
                <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
                  {result.warnings.map((warning, idx) => (
                    <Text
                      key={idx}
                      className="text-sm text-orange-600 dark:text-orange-400"
                    >
                      ⚠️ {warning}
                    </Text>
                  ))}
                </div>
              )}

              {/* UI Channel (iframe) */}
              {result.channels?.ui && plugin.ui?.path && (
                <div className="mb-4">
                  <Text className="mb-2 text-sm font-medium">UI Preview</Text>
                  <div className="overflow-hidden rounded-lg border border-muted">
                    <iframe
                      srcDoc={generateUIHTML(plugin, result)}
                      className="h-96 w-full"
                      title={`${plugin.tool_id} UI`}
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show Raw JSON
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-gray-100 p-4 text-xs dark:bg-gray-200">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Generate HTML for plugin UI iframe.
 * Injects the plugin's UI JavaScript and CSS with the result data.
 */
function generateUIHTML(plugin: PluginInfo, result: PluginRunResult): string {
  // This is a simplified version — in production, you'd load the actual UI files
  // from the plugin's ui/ directory via the API or static serving
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plugin.name || plugin.tool_id} UI</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
      margin: 0;
      background: var(--bg, #fff);
      color: var(--text, #000);
    }
    pre {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <h2>${plugin.name || plugin.tool_id}</h2>
  <p>Result from plugin execution:</p>
  <pre>${JSON.stringify(result, null, 2)}</pre>
  
  <script>
    // Plugin-specific UI rendering would go here
    // For now, we just show the raw JSON
    console.log('Plugin result:', ${JSON.stringify(result)});
  </script>
</body>
</html>
  `.trim();
}

