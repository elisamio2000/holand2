// ============================================
// WorkflowToolbar — Top toolbar for workflow editor
// Save, Run, Validate, Export, Import, Layout, Zoom controls
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useRef } from 'react';
import { Badge, Button, Input, Text, ActionIcon } from 'rizzui';
import {
  PiFloppyDiskBold,
  PiPlayBold,
  PiCheckCircleBold,
  PiExportBold,
  PiDownloadBold,
  PiArrowsOutBold,
  PiMagnifyingGlassPlusBold,
  PiMagnifyingGlassMinusBold,
  PiTreeStructureBold,
  PiCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useReactFlow } from '@xyflow/react';

import { useWorkflowStore } from '../store/workflow-store';
import { workflowService } from '@/services/workflow.service';

interface WorkflowToolbarProps {
  onValidate: () => void;
  onRun: () => void;
  onAutoLayout: () => void;
}

export default function WorkflowToolbar({
  onValidate,
  onRun,
  onAutoLayout,
}: WorkflowToolbarProps) {
  const { t } = useTranslation();
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    workflowId,
    workflowName,
    isDirty,
    runStatus,
    setWorkflowName,
    markClean,
    toDefinition,
    loadWorkflow,
  } = useWorkflowStore();

  const handleSave = useCallback(async () => {
    const def = toDefinition();
    try {
      if (workflowId) {
        await workflowService.updateWorkflow(workflowId, def);
      } else {
        const created = await workflowService.createWorkflow(def);
        useWorkflowStore.setState({ workflowId: created.id });
      }
      markClean();
      toast.success(t('workflow.editor.saveSuccess'));
    } catch (err) {
      console.error('[WorkflowToolbar] Save failed:', err);
      toast.error(t('workflow.editor.saveFailed'));
    }
  }, [workflowId, toDefinition, markClean, t]);

  const handleExport = useCallback(() => {
    const def = toDefinition();
    const json = workflowService.exportToJson(def);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${def.name.replace(/\s+/g, '_')}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('workflow.editor.export') + ' ✓');
  }, [toDefinition, t]);

  const handleImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = workflowService.importFromJson(
            e.target?.result as string
          );
          loadWorkflow(imported);
          toast.success(t('workflow.editor.import') + ' ✓');
        } catch {
          toast.error('Invalid workflow JSON');
        }
      };
      reader.readAsText(file);
      event.target.value = '';
    },
    [loadWorkflow, t]
  );

  return (
    <div className="flex items-center gap-2 bg-white px-3 py-2 dark:bg-gray-50">
      {/* Workflow Name */}
      <Input
        size="sm"
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        placeholder={t('workflow.editor.untitled')}
        className="w-48 lg:w-64"
        inputClassName="text-sm font-semibold border-transparent hover:border-muted focus:border-primary"
      />

      {/* Dirty indicator */}
      {isDirty && (
        <Badge variant="flat" size="sm" color="warning" className="gap-1">
          <PiCircleBold className="h-2 w-2" />
          <span className="hidden sm:inline">
            {t('workflow.editor.unsavedChanges')}
          </span>
        </Badge>
      )}

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Tooltip content={t('workflow.editor.validate')}>
          <ActionIcon variant="outline" size="sm" onClick={onValidate}>
            <PiCheckCircleBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <Tooltip content={t('workflow.editor.autoLayout')}>
          <ActionIcon variant="outline" size="sm" onClick={onAutoLayout}>
            <PiTreeStructureBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <div className="mx-1 h-5 w-px bg-muted" />

        <Tooltip content={t('workflow.editor.zoomIn')}>
          <ActionIcon variant="outline" size="sm" onClick={() => zoomIn()}>
            <PiMagnifyingGlassPlusBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('workflow.editor.zoomOut')}>
          <ActionIcon variant="outline" size="sm" onClick={() => zoomOut()}>
            <PiMagnifyingGlassMinusBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <Tooltip content={t('workflow.editor.fitView')}>
          <ActionIcon variant="outline" size="sm" onClick={() => fitView()}>
            <PiArrowsOutBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <div className="mx-1 h-5 w-px bg-muted" />

        <Tooltip content={t('workflow.editor.export')}>
          <ActionIcon variant="outline" size="sm" onClick={handleExport}>
            <PiExportBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>

        <Tooltip content={t('workflow.editor.import')}>
          <ActionIcon
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <PiDownloadBold className="h-4 w-4" />
          </ActionIcon>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />

        <div className="mx-1 h-5 w-px bg-muted" />

        <Button
          variant="outline"
          size="sm"
          onClick={onRun}
          disabled={runStatus === 'running'}
          className="gap-1"
        >
          <PiPlayBold className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('workflow.editor.run')}</span>
        </Button>

        <Button
          size="sm"
          onClick={handleSave}
          className="gap-1"
        >
          <PiFloppyDiskBold className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t('workflow.editor.save')}</span>
        </Button>
      </div>
    </div>
  );
}
