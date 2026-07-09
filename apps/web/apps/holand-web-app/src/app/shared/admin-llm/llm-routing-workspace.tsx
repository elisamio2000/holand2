'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type {
  LlmModel,
  LlmRole,
  LlmRoute,
  ToolRegistryEntry,
} from '@/types/pipeline-admin.types';
import LlmRoutingHero from './components/llm-routing-hero';
import LlmSegmentTabs, { type LlmRoutingTabKey } from './components/llm-segment-tabs';
import RoleQuickAssignCards from './components/role-quick-assign-cards';
import RoutesReadOnlyTable from './components/routes-readonly-table';
import ToolBindingMasterDetail from './components/tool-binding-master-detail';
import ToolBindingsConnectionList from './components/tool-bindings-connection-list';

interface LlmRoutingWorkspaceProps {
  initialTab?: LlmRoutingTabKey;
  initialToolId?: string | null;
}

export default function LlmRoutingWorkspace({
  initialTab = 'roles',
  initialToolId = null,
}: LlmRoutingWorkspaceProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<LlmRoutingTabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<LlmRole[]>([]);
  const [routes, setRoutes] = useState<LlmRoute[]>([]);
  const [models, setModels] = useState<LlmModel[]>([]);
  const [tools, setTools] = useState<ToolRegistryEntry[]>([]);
  const [bindingsList, setBindingsList] = useState<
    Array<{ tool_id: string; model?: string; fallback_model?: string | null }>
  >([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pipelineAdminService.loadAll();
      setRoles(data.roles);
      setRoutes(data.routes);
      setModels(data.models);
      setTools(data.tools);
      try {
        const bindings = await pipelineAdminService.listToolBindings();
        setBindingsList(bindings);
      } catch {
        setBindingsList([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('llmPage.tools.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const bindingsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of bindingsList) {
      if (b.tool_id && b.model) map[b.tool_id] = b.model;
    }
    return map;
  }, [bindingsList]);

  const assignRole = async (role: LlmRole, modelName: string) => {
    setSavingRole(role.route_key);
    try {
      await pipelineAdminService.assignRoleModel(role.route_key, modelName);
      toast.success(
        t('llmPage.roles.assignSuccess', {
          model: modelName,
          role: role.title_fa ?? role.route_key,
        })
      );
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('llmPage.roles.assignFailed'));
    } finally {
      setSavingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <LlmRoutingHero onRefresh={loadAll} />
      <LlmSegmentTabs tab={tab} onTabChange={setTab} />

      {tab === 'roles' && (
        <RoleQuickAssignCards
          roles={roles}
          models={models}
          savingRole={savingRole}
          onAssign={assignRole}
        />
      )}

      {tab === 'routes' && (
        <RoutesReadOnlyTable
          routes={routes}
          parseConstraints={(r) => pipelineAdminService.parseRouteConstraints(r)}
        />
      )}

      {tab === 'tools' && (
        <div className="space-y-6">
          <ToolBindingsConnectionList bindings={bindingsList} />
          <ToolBindingMasterDetail
            tools={tools}
            models={models}
            bindingsMap={bindingsMap}
            initialToolId={initialToolId}
            showPatchPanelDefault
            onSaved={async () => {
              toast.success(t('llmPage.tools.bindingSaved'));
              await loadAll();
            }}
          />
        </div>
      )}
    </div>
  );
}
