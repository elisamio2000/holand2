'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Input, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { LlmModel, LlmPool, LlmPoolPolicy } from '@/types/pipeline-admin.types';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import SectionCard from '../components/section-card';
import EmptyState from '../components/empty-state';
import { PiShareNetworkBold } from 'react-icons/pi';
import { findModelsForLogicalId } from '../helpers/logical-model-options';
import { buildPipelineUrl } from '../helpers/pipeline-tab-url';

interface PoolsPanelProps {
  pools: LlmPool[];
  models: LlmModel[];
}

export default function PoolsPanel({ pools, models }: PoolsPanelProps) {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<LlmPoolPolicy[]>([]);
  const [policyDraft, setPolicyDraft] = useState({ logical_id: '', strategy: 'round_robin', prefer_external: false });
  const [policySaving, setPolicySaving] = useState(false);
  const [policiesReadOnly, setPoliciesReadOnly] = useState(false);

  const reloadPolicies = () => {
    pipelineAdminService.listPoolPolicies().then(setPolicies).catch(() => setPolicies([]));
  };

  useEffect(() => {
    reloadPolicies();
  }, []);

  if (pools.length === 0) {
    return (
      <EmptyState
        icon={<PiShareNetworkBold className="h-full w-full" />}
        message={t('pipeline.models.noPools', 'No logical pools yet')}
      />
    );
  }

  const policyFor = (logicalId: string) =>
    policies.find((p) => p.logical_id === logicalId);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-muted p-3">
        <Text className="mb-2 text-xs font-semibold">
          {t('pipeline.models.poolPolicyAdd', 'Add pool policy')}
        </Text>
        {policiesReadOnly ? (
          <Text className="text-xs text-gray-500">{t('pipeline.models.poolPoliciesHint')}</Text>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              size="sm"
              label={t('pipeline.models.logicalId')}
              value={policyDraft.logical_id}
              list="pool-policy-logical-ids"
              onChange={(e) => setPolicyDraft((d) => ({ ...d, logical_id: e.target.value }))}
            />
            <datalist id="pool-policy-logical-ids">
              {pools.map((p) => (
                <option key={p.logical_id} value={p.logical_id} />
              ))}
            </datalist>
            <Input
              size="sm"
              label={t('pipeline.models.poolPolicyStrategy', 'Strategy')}
              value={policyDraft.strategy}
              onChange={(e) => setPolicyDraft((d) => ({ ...d, strategy: e.target.value }))}
            />
            <Button
              size="sm"
              disabled={policySaving || !policyDraft.logical_id.trim()}
              onClick={async () => {
                setPolicySaving(true);
                const created = await pipelineAdminService.createPoolPolicy({
                  logical_id: policyDraft.logical_id.trim(),
                  strategy: policyDraft.strategy,
                  prefer_external: policyDraft.prefer_external,
                });
                setPolicySaving(false);
                if (created) {
                  reloadPolicies();
                  setPolicyDraft({ logical_id: '', strategy: 'round_robin', prefer_external: false });
                } else {
                  setPoliciesReadOnly(true);
                }
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        )}
      </div>
      {pools.map((pool) => {
        const replicas = pool.replicas ?? [];
        const memberModels = findModelsForLogicalId(models, pool.logical_id);
        const topologyUrl = buildPipelineUrl('topology', {
          view: 'board',
          focus: `model:${pool.logical_id}`,
        });
        const policy = policyFor(pool.logical_id);

        return (
          <SectionCard
            key={pool.logical_id}
            title={pool.logical_id}
            icon={<PiShareNetworkBold className="h-4 w-4 text-primary" />}
            badge={
              <Badge variant="flat" size="sm">
                {replicas.length || memberModels.length}{' '}
                {t('pipeline.models.replicas', 'replicas')}
              </Badge>
            }
            headerActions={
              <Link href={topologyUrl}>
                <Button size="sm" variant="outline" className="text-xs">
                  {t('pipeline.models.showTopology', 'Show in Topology')}
                </Button>
              </Link>
            }
          >
            {policy && (
              <div className="mb-3 rounded-lg border border-dashed border-muted px-3 py-2 text-xs text-gray-600">
                <div className="flex items-center justify-between gap-2">
                  <Text className="font-medium">
                    {t('pipeline.models.poolPolicy', 'Pool policy')}
                  </Text>
                  {!policiesReadOnly && (
                    <Button
                      size="sm"
                      variant="text"
                      color="danger"
                      onClick={async () => {
                        const ok = await pipelineAdminService.deletePoolPolicy(pool.logical_id);
                        if (ok) reloadPolicies();
                      }}
                    >
                      {t('common.delete')}
                    </Button>
                  )}
                </div>
                <Text className="font-mono text-[10px]">
                  {policy.strategy ?? t('pipeline.models.poolPolicyDefault', 'default')}
                  {policy.prefer_external != null
                    ? ` · prefer_external=${String(policy.prefer_external)}`
                    : ''}
                </Text>
              </div>
            )}
            <div className="space-y-2">
              {(replicas.length > 0
                ? replicas.map((r) => ({
                    key: r.name ?? `${r.node_id}`,
                    name: r.name ?? r.node_id,
                    node: r.node_id,
                    active: r.is_active,
                    inference_url: r.inference_url,
                    priority: r.priority,
                  }))
                : memberModels.map((m) => ({
                    key: m.name,
                    name: m.name,
                    node: m.node_id ?? m.origin ?? '—',
                    active: m.is_active,
                    inference_url: null as string | null | undefined,
                    priority: null as number | null | undefined,
                  }))
              ).map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-muted px-3 py-2"
                >
                  <div className="min-w-0">
                    <Text className="font-mono text-xs">{row.name}</Text>
                    {row.inference_url && (
                      <Text className="truncate font-mono text-[10px] text-gray-400">
                        {row.inference_url}
                      </Text>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.priority != null && (
                      <Badge variant="outline" size="sm">
                        P{row.priority}
                      </Badge>
                    )}
                    {row.node && row.node !== '—' ? (
                      <Link href={`/admin/nodes?node=${encodeURIComponent(String(row.node))}`}>
                        <Badge variant="outline" size="sm" className="cursor-pointer hover:border-primary">
                          {String(row.node)}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="outline" size="sm">
                        {String(row.node)}
                      </Badge>
                    )}
                    <Badge
                      variant="flat"
                      size="sm"
                      color={row.active ? 'success' : 'secondary'}
                    >
                      {row.active
                        ? t('pipeline.models.active')
                        : t('pipeline.models.inactive')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
