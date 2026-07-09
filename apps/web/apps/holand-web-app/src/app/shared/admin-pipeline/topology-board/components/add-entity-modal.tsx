'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal, Title, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import { TopologyEntityKind, TopologyPipelineData } from '../helpers/topology-board-types';
import { getEntitySchema } from '../../entity-settings/get-entity-schema';
import FieldRenderer from '../../entity-settings/field-renderer/field-renderer';
import { buildCatalogEntityValues, type EntityValues } from '../../entity-settings/build-entity-values';

export interface AddEntityModalConfig {
  kind: TopologyEntityKind;
  entityId: string;
  label: string;
}

interface AddEntityModalProps {
  open: boolean;
  config: AddEntityModalConfig | null;
  pipelineData: TopologyPipelineData | null;
  onConfirm: (config: AddEntityModalConfig, values: EntityValues) => void;
  onClose: () => void;
}

export default function AddEntityModal({
  open,
  config,
  pipelineData,
  onConfirm,
  onClose,
}: AddEntityModalProps) {
  const { t } = useTranslation();
  const schema = config ? getEntitySchema(config.kind) : null;
  const [values, setValues] = useState<EntityValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!config || !pipelineData) {
      setValues({});
      setErrors({});
      return;
    }
    const base = buildCatalogEntityValues(config.kind, config.entityId, pipelineData);
    setValues(base);
    setErrors({});

    if (config.kind === 'tool') {
      pipelineAdminService
        .suggestToolModel(config.entityId)
        .then((suggestion) => {
          const suggested = suggestion?.suggested;
          if (!suggested) return;
          setValues((prev) => ({
            ...prev,
            model: suggested.model || prev.model,
            fallback_model: suggested.fallback_model || prev.fallback_model,
            api: suggested.api ?? prev.api,
            purpose: suggested.purpose ?? prev.purpose,
            pipeline_tag: suggested.pipeline_tag ?? prev.pipeline_tag,
          }));
        })
        .catch(() => {
          /* suggestion optional */
        });
    }
  }, [config, pipelineData]);

  const requiredMissing = useMemo(() => {
    if (!schema) return false;
    return schema.sections.some((sec) =>
      sec.fields.some((f) => f.required && !values[f.key])
    );
  }, [schema, values]);

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleConfirm = () => {
    if (!config || !schema) return;
    const nextErrors: Record<string, string> = {};
    schema.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        if (f.required && !values[f.key]) {
          nextErrors[f.key] = t('pipeline.settings.required', 'Required');
        }
      });
    });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    onConfirm(config, values);
    onClose();
  };

  if (!config) return null;

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="flex max-h-[80vh] flex-col overflow-hidden">
        <Title as="h4" className="border-b border-muted px-6 py-4">
          {t('pipeline.settings.addTitle', 'Configure before add')} — {config.label}
        </Title>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {!schema && (
            <Text className="text-sm text-gray-500">
              {t('pipeline.settings.noSchema', 'No schema — entity will be added with defaults.')}
            </Text>
          )}
          {schema?.sections.map((sec) => (
            <div key={sec.id} className="space-y-3">
              <Text className="text-xs font-semibold uppercase text-gray-500">
                {t(sec.labelKey ?? sec.id, sec.label)}
              </Text>
              {sec.fields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  models={pipelineData?.models ?? []}
                  error={errors[field.key]}
                  onChange={handleChange}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-muted px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={requiredMissing && !!schema}>
            {t('pipeline.topology.board.addToCanvas', 'Add to canvas')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
