'use client';

import { useCallback, useState } from 'react';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { LlmEndpoint } from '@/types/pipeline-admin.types';
import {
  DEFAULT_CONNECT,
  buildImportSpec,
  isBlockedHost,
  rowsFromDiscovered,
  type ConnectFormState,
  type EndpointWizardState,
  type ImportRowState,
  type WizardStep,
} from '../wizards/external-endpoint-wizard.types';

const INITIAL: EndpointWizardState = {
  step: 'connect',
  connect: DEFAULT_CONNECT,
  discoverResult: null,
  importRows: [],
  registeredEndpoint: null,
  importResult: null,
  existingEndpointId: null,
};

export function useEndpointWizard(initialEndpoint?: LlmEndpoint | null) {
  const [state, setState] = useState<EndpointWizardState>(() =>
    initialEndpoint
      ? {
          ...INITIAL,
          existingEndpointId: initialEndpoint.id,
          connect: {
            ...DEFAULT_CONNECT,
            name: initialEndpoint.name,
            host: initialEndpoint.host,
            port: initialEndpoint.port,
            scheme:
              typeof initialEndpoint.scheme === 'string'
                ? initialEndpoint.scheme
                : 'http',
            base_path:
              typeof initialEndpoint.base_path === 'string'
                ? initialEndpoint.base_path
                : '',
          },
        }
      : INITIAL
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setStep = useCallback((step: WizardStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const setConnect = useCallback((patch: Partial<ConnectFormState>) => {
    setState((s) => ({ ...s, connect: { ...s.connect, ...patch } }));
  }, []);

  const setImportRow = useCallback((index: number, patch: Partial<ImportRowState>) => {
    setState((s) => {
      const rows = [...s.importRows];
      rows[index] = { ...rows[index], ...patch };
      return { ...s, importRows: rows };
    });
  }, []);

  const setAllImportSelected = useCallback((selected: boolean) => {
    setState((s) => ({
      ...s,
      importRows: s.importRows.map((row) => ({ ...row, selected })),
    }));
  }, []);

  const runDiscover = useCallback(async () => {
    const { connect } = state;
    if (!connect.name.trim() || !connect.host.trim()) {
      setError('missing_fields');
      return false;
    }
    if (isBlockedHost(connect.host)) {
      setError('discovery_blocked_host');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const [result, taxonomy] = await Promise.all([
        pipelineAdminService.discoverEndpoint({
          name: connect.name.trim(),
          host: connect.host.trim(),
          port: connect.port,
          scheme: connect.scheme || 'http',
          base_path: connect.base_path ?? '',
          bearer_token: connect.bearer_token.trim() || null,
          timeout_s: connect.timeout_s,
        }),
        pipelineAdminService.getTaxonomy(),
      ]);
      const taxDefaults = taxonomy[0];
      const rows = rowsFromDiscovered(result.models ?? []).map((row) => ({
        ...row,
        pipeline_tag: taxDefaults?.pipeline_tag ?? row.pipeline_tag,
        input_modalities:
          (taxDefaults?.modalities as string[] | undefined) ?? row.input_modalities,
        output_modalities:
          (taxDefaults?.modalities as string[] | undefined) ?? row.output_modalities,
      }));
      setState((s) => ({
        ...s,
        discoverResult: result,
        importRows: rows,
        step: 'import',
      }));
      return true;
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setBusy(false);
    }
  }, [state]);

  const runRegisterAndImport = useCallback(async () => {
    const selected = state.importRows.filter((r) => r.selected);
    if (selected.length === 0) {
      setError('no_models_to_import');
      return null;
    }
    if (selected.some((r) => !r.logical_id.trim())) {
      setError('missing_logical_id');
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      let endpointId = state.existingEndpointId;
      let endpoint = state.registeredEndpoint;

      if (!endpointId) {
        const probe = state.discoverResult;
        endpoint = await pipelineAdminService.createEndpoint({
          name: state.connect.name.trim(),
          host: state.connect.host.trim(),
          port: state.connect.port,
          scheme: state.connect.scheme || 'http',
          base_path: state.connect.base_path ?? '',
          auth: state.connect.bearer_token.trim()
            ? { type: 'bearer', token: state.connect.bearer_token.trim() }
            : undefined,
          capabilities: { openai_compat: probe?.openai_compat ?? true },
          last_probe: probe
            ? {
                healthy: probe.healthy,
                latency_ms: probe.latency_ms ?? undefined,
                models_count: probe.models?.length ?? 0,
              }
            : undefined,
          is_active: true,
        });
        endpointId = endpoint.id;
      }

      const importResult = await pipelineAdminService.importEndpointModels(
        endpointId!,
        selected.map(buildImportSpec)
      );

      setState((s) => ({
        ...s,
        registeredEndpoint: endpoint ?? s.registeredEndpoint,
        existingEndpointId: endpointId,
        importResult,
        step: 'success',
      }));
      return importResult;
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [state]);

  const reset = useCallback(() => {
    setState(initialEndpoint ? { ...INITIAL, existingEndpointId: initialEndpoint.id, connect: { ...DEFAULT_CONNECT, name: initialEndpoint.name, host: initialEndpoint.host, port: initialEndpoint.port } } : INITIAL);
    setError(null);
  }, [initialEndpoint]);

  return {
    state,
    busy,
    error,
    setStep,
    setConnect,
    setImportRow,
    setAllImportSelected,
    runDiscover,
    runRegisterAndImport,
    reset,
  };
}
