'use client';

import { Modal, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { TopologyNode, TopologyPipelineData } from '../topology-board/helpers/topology-board-types';
import NodeSettingsPanel from './node-settings-panel';

interface NodeSettingsModalProps {
  open: boolean;
  node: TopologyNode | null;
  pipelineData: TopologyPipelineData | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function NodeSettingsModal({
  open,
  node,
  pipelineData,
  onClose,
  onRefresh,
}: NodeSettingsModalProps) {
  const { t } = useTranslation();
  if (!node) return null;

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="flex max-h-[80vh] flex-col overflow-hidden">
        <Title as="h4" className="border-b border-muted px-6 py-4">
          {t('pipeline.settings.advancedTitle', 'Node Settings')} — {node.data.label}
        </Title>
        <div className="flex-1 overflow-y-auto">
          <NodeSettingsPanel
            node={node}
            pipelineData={pipelineData}
            mode="advanced"
            onRefresh={onRefresh}
            showConnections={false}
          />
        </div>
      </div>
    </Modal>
  );
}
