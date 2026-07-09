'use client';

import { Badge, Button, Select, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { LlmModel, LlmRole } from '@/types/pipeline-admin.types';
import { candidateModelName, formatModelLabel } from '../utils/format-model-label';

interface RoleQuickAssignCardsProps {
  roles: LlmRole[];
  models: LlmModel[];
  savingRole: string | null;
  onAssign: (role: LlmRole, modelName: string) => void;
}

function isHealthyAssignable(model: LlmModel): boolean {
  if (!model.is_active) return false;
  if (model.health == null) return true;
  return model.health.healthy === true;
}

export default function RoleQuickAssignCards({
  roles,
  models,
  savingRole,
  onAssign,
}: RoleQuickAssignCardsProps) {
  const { t } = useTranslation();

  const healthyNames = new Set(
    models.filter(isHealthyAssignable).map((m) => m.name)
  );

  const dropdownOptions = models
    .filter(isHealthyAssignable)
    .map((m) => ({ label: m.name, value: m.name }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {roles.map((role) => (
        <div
          key={role.route_key}
          className="rounded-xl border border-muted bg-gray-0 p-4 dark:bg-gray-50"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <Text className="font-semibold">{role.title_fa ?? role.route_key}</Text>
              <Text className="mt-0.5 text-xs text-gray-500">{role.description_fa}</Text>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge size="sm" variant="flat" color={role.required ? 'danger' : 'secondary'}>
                  {role.modality}
                </Badge>
                {role.is_assigned ? (
                  <Badge size="sm" color="success">
                    {t('llmPage.roles.active')}
                  </Badge>
                ) : (
                  <Badge size="sm" color="warning">
                    {t('llmPage.roles.noModel')}
                  </Badge>
                )}
              </div>
            </div>
            <Text className="text-xs text-gray-400">{role.route_key}</Text>
          </div>
          <Text className="mt-3 text-sm">
            {t('llmPage.roles.currentModel')}{' '}
            <span className="font-mono text-primary">
              {formatModelLabel(role.current_model) !== '—'
                ? formatModelLabel(role.current_model)
                : formatModelLabel(role.fallback_model_name)}
            </span>
          </Text>
          <div className="mt-3 flex flex-wrap gap-2">
            {(role.candidate_models ?? []).slice(0, 4).map((m, idx) => {
              const modelName = candidateModelName(m);
              const healthy = healthyNames.has(modelName);
              return (
                <Button
                  key={`${role.route_key}-${modelName}-${idx}`}
                  size="sm"
                    variant="outline"
                    disabled={savingRole === role.route_key || !healthy}
                  onClick={() => onAssign(role, modelName)}
                >
                  {modelName}
                </Button>
              );
            })}
          </div>
          {dropdownOptions.length > 0 && (
            <div className="mt-3">
              <Select
                size="sm"
                placeholder={t('pipeline.roles.selectModel')}
                options={dropdownOptions}
                value={role.current_model || undefined}
                onChange={(opt: { value: string } | null) => {
                  if (opt?.value) onAssign(role, opt.value);
                }}
                disabled={savingRole === role.route_key}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
