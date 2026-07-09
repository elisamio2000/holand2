'use client';

import { useMemo } from 'react';
import { Input, Select, Text } from 'rizzui';
import type { LlmModel, LogicalCatalogEntry } from '@/types/pipeline-admin.types';
import StatusDot from '../components/status-dot';
import { modelHealthKind, statusDotColor } from '@/utils/model-health';
import {
  buildLogicalSelectOptions,
  findModelsForLogicalId,
  type LogicalModelOption,
} from '../helpers/logical-model-options';

interface LogicalModelSelectProps {
  label: string;
  value: string;
  models: LlmModel[];
  catalog?: LogicalCatalogEntry[];
  allowCustom?: boolean;
  includeEmpty?: boolean;
  disabled?: boolean;
  onChange: (logicalId: string) => void;
}

export default function LogicalModelSelect({
  label,
  value,
  models,
  catalog = [],
  allowCustom = true,
  includeEmpty = false,
  disabled,
  onChange,
}: LogicalModelSelectProps) {
  const options = useMemo(
    () => buildLogicalSelectOptions(models, catalog, { activeOnly: true }),
    [models, catalog]
  );

  const selectOptions = useMemo(() => {
    const opts: LogicalModelOption[] = includeEmpty
      ? [{ value: '', label: '—' }, ...options]
      : [...options];
    if (allowCustom && value && !opts.some((o) => o.value === value)) {
      opts.unshift({ value, label: value });
    }
    return opts.map((o) => ({ label: o.label, value: o.value }));
  }, [options, includeEmpty, allowCustom, value]);

  const selectedModels = useMemo(
    () => (value ? findModelsForLogicalId(models, value) : []),
    [models, value]
  );
  const healthModel = selectedModels[0];
  const kind = healthModel ? modelHealthKind(healthModel) : 'unknown';

  if (allowCustom && selectOptions.length === 0) {
    return (
      <Input
        size="sm"
        label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div>
      <Select
        size="sm"
        label={label}
        options={selectOptions}
        value={value || undefined}
        disabled={disabled}
        onChange={(opt: { value: string } | null) => onChange(opt?.value ?? '')}
      />
      {value && healthModel && (
        <div className="mt-1 flex items-center gap-1">
          <StatusDot color={statusDotColor(kind)} pulse={kind === 'healthy'} size="sm" />
          <Text className="text-[10px] text-gray-500">
            {healthModel.name}
          </Text>
        </div>
      )}
    </div>
  );
}
