'use client';



import { useCallback, useEffect, useMemo } from 'react';

import { Badge, Button, Text } from 'rizzui';

import { useTranslation } from 'react-i18next';

import toast from 'react-hot-toast';

import { useTopologyBoardStore } from '../store/topology-board-store';

import { buildEdgeStyle, edgeLabel } from '../helpers/edge-styles';

import { resolveEdgeSemantics } from '../helpers/edge-semantics';

import type { TopologyEdgeKind } from '../helpers/topology-board-types';

import { getEntitySchema } from '../../entity-settings/get-entity-schema';

import { buildEdgeFieldValues } from '../../entity-settings/build-entity-values';

import FieldRenderer from '../../entity-settings/field-renderer/field-renderer';



interface Props {

  onRefresh: () => Promise<void>;

}



export default function TopologyEdgeInspector({ onRefresh: _onRefresh }: Props) {

  const { t } = useTranslation();

  const selectedEdgeId = useTopologyBoardStore((s) => s.selectedEdgeId);

  const edges = useTopologyBoardStore((s) => s.edges);

  const nodes = useTopologyBoardStore((s) => s.nodes);

  const pipelineData = useTopologyBoardStore((s) => s.pipelineData);

  const removeEdge = useTopologyBoardStore((s) => s.removeEdge);

  const updateEdgeData = useTopologyBoardStore((s) => s.updateEdgeData);



  const edge = edges.find((e) => e.id === selectedEdgeId);

  const sourceNode = nodes.find((n) => n.id === edge?.source);

  const targetNode = nodes.find((n) => n.id === edge?.target);

  const models = useMemo(() => pipelineData?.models ?? [], [pipelineData?.models]);

  const semantics = edge

    ? resolveEdgeSemantics(edge, sourceNode, targetNode, models, edges, nodes)

    : null;



  const schema = getEntitySchema('edge');

  const values = useMemo(

    () =>

      edge

        ? buildEdgeFieldValues(edge, sourceNode, targetNode, models, edges, nodes)

        : {},

    [edge, sourceNode, targetNode, models, edges, nodes]

  );



  const handleFieldChange = useCallback(

    (key: string, value: unknown) => {

      if (!edge) return;

      if (key === 'edgeKind') {

        const nextKind = value as TopologyEdgeKind;

        const target = nodes.find((n) => n.id === edge.target);

        const name = target?.data.kind === 'model' ? target.data.entityId : '';

        const visual = buildEdgeStyle(nextKind, name, pipelineData?.models ?? []);

        useTopologyBoardStore.getState().setGraph(

          nodes,

          edges.map((e) =>

            e.id === edge.id

              ? ({

                  ...e,

                  data: { ...e.data, edgeKind: nextKind },

                  label: edgeLabel(nextKind),

                  ...visual,

                } as typeof e)

              : e

          )

        );

      } else if (key === 'active') {

        updateEdgeData(edge.id, { active: Boolean(value) });

      }

    },

    [edge, nodes, edges, pipelineData, updateEdgeData]

  );



  useEffect(() => {
    if (edge?.data?.invalid && semantics) {
      toast.error(
        t('pipeline.topology.board.invalidEdge', 'Invalid connection: {{label}}', {
          label: semantics.label,
        }),
        { id: `edge-invalid-${edge.id}` }
      );
    }
  }, [edge?.id, edge?.data?.invalid, semantics, t]);



  if (!edge || !schema) return null;



  return (

    <div className="flex h-full flex-col overflow-y-auto">

      <div className="border-b border-muted p-2">

        <Text className="text-sm font-semibold">

          {t('pipeline.topology.board.edgeInspector', 'Connection')}

        </Text>

        <Badge variant="flat" size="sm" className="mt-1 font-mono capitalize">

          {semantics?.label ?? edgeLabel(edge.data?.edgeKind ?? 'primary')}

        </Badge>

        <div className="mt-1 flex gap-1 text-[10px] text-gray-500">

          <span className="capitalize">{sourceNode?.data.kind}</span>

          <span>→</span>

          <span className="capitalize">{targetNode?.data.kind}</span>

        </div>

      </div>



      {schema.sections.map((sec) => (

        <div key={sec.id} className="border-b border-muted px-3 py-2 space-y-2">

          <Text className="text-xs font-semibold text-gray-600">{sec.label}</Text>

          {sec.fields.map((field) => (

            <FieldRenderer

              key={field.key}

              field={field}

              value={values[field.key]}

              onChange={handleFieldChange}

            />

          ))}

        </div>

      ))}



      <div className="mt-auto border-t border-muted p-3">

        <Button

          size="sm"

          variant="outline"

          color="danger"

          className="w-full"

          onClick={() => removeEdge(edge.id)}

        >

          {t('common.delete', 'Delete')}

        </Button>

      </div>

    </div>

  );

}

