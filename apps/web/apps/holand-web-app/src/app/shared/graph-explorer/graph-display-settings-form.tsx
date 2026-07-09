'use client';

import { Tooltip } from '@/components/tooltip';
import cn from '@core/utils/class-names';

import {
  PiTagBold,
  PiLinkBold,
  PiCirclesFourBold,
  PiLightningBold,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import type { GraphSettings, PhysicsPreset } from '@/types/graph-explorer.types';

export function GraphSettingsToggle({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between group">
      <span className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        {icon}
        {label}
      </span>
      <div
        className={cn(
          'relative h-4 w-8 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-500'
        )}
        onClick={onChange}
      >
        <div
          className={cn(
            'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-4'
          )}
        />
      </div>
    </label>
  );
}

export function GraphSettingsSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-mono text-gray-500">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary dark:bg-gray-300"
      />
    </div>
  );
}

const PHYSICS_PRESETS: { value: PhysicsPreset; label: string; hint: string }[] = [
  { value: 'gentle', label: 'Stable', hint: 'High damping, weaker repulsion — best while dragging nodes' },
  { value: 'standard', label: 'Balanced', hint: 'Default force strength and cooldown' },
  { value: 'energetic', label: 'Dynamic', hint: 'Stronger motion for layout exploration' },
];

export interface GraphDisplaySettingsFormProps {
  settings: GraphSettings;
  onSettingsChange: (settings: GraphSettings) => void;
  className?: string;
}

export function GraphDisplaySettingsForm({
  settings,
  onSettingsChange,
  className,
}: GraphDisplaySettingsFormProps) {
  const { t } = useTranslation();

  const toggle = (key: keyof GraphSettings) => {
    onSettingsChange({ ...settings, [key]: !settings[key] });
  };

  const slider = (key: keyof GraphSettings, value: number) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className={cn('space-y-3', className)}>
      <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {t('graphExplorer.toolbar.display', { defaultValue: 'Display' })}
      </p>

      <GraphSettingsToggle
        label={t('graphExplorer.toolbar.nodeLabels', { defaultValue: 'Node Labels' })}
        icon={<PiTagBold className="h-3.5 w-3.5" />}
        checked={settings.showLabels}
        onChange={() => toggle('showLabels')}
      />
      <GraphSettingsToggle
        label={t('graphExplorer.toolbar.relationLabels', { defaultValue: 'Relation Labels' })}
        icon={<PiLinkBold className="h-3.5 w-3.5" />}
        checked={settings.showRelationLabels}
        onChange={() => toggle('showRelationLabels')}
      />
      <GraphSettingsToggle
        label={t('graphExplorer.toolbar.clusterHulls', { defaultValue: 'Cluster Hulls' })}
        icon={<PiCirclesFourBold className="h-3.5 w-3.5" />}
        checked={settings.showClusterHulls}
        onChange={() => toggle('showClusterHulls')}
      />
      <GraphSettingsToggle
        label={t('graphExplorer.toolbar.physicsAuto', { defaultValue: 'Physics (auto motion)' })}
        icon={<PiLightningBold className="h-3.5 w-3.5" />}
        checked={settings.enablePhysics}
        onChange={() => toggle('enablePhysics')}
      />
      <p className="-mt-1 mb-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
        {t('graphExplorer.toolbar.physicsHintOff', {
          defaultValue:
            'Off: forces and the large-graph worker stop so nodes stay still unless you drag them or run a layout. Toolbar pause only pauses animation.',
        })}
      </p>

      <p className="mb-1 mt-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {t('graphExplorer.toolbar.motionPreset', { defaultValue: 'Motion preset' })}
      </p>
      <p className="mb-1.5 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
        {t('graphExplorer.toolbar.motionPresetHint', {
          defaultValue:
            'When physics is on, pick how aggressively nodes move. Stable reduces runaway motion after drags.',
        })}
      </p>
      <div className="flex overflow-hidden rounded-md border border-muted">
        {PHYSICS_PRESETS.map(({ value, label, hint }) => (
          <Tooltip key={value} content={hint} placement="bottom">
            <button
              type="button"
              disabled={!settings.enablePhysics}
              onClick={() => onSettingsChange({ ...settings, physicsPreset: value })}
              title={hint}
              className={cn(
                'flex-1 border-r border-muted px-1.5 py-1.5 text-[10px] font-medium transition-colors last:border-r-0',
                settings.physicsPreset === value
                  ? 'bg-primary text-white'
                  : 'bg-gray-0 text-gray-600 hover:bg-gray-100 dark:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-200',
                !settings.enablePhysics && 'cursor-not-allowed opacity-40 hover:bg-gray-0 dark:hover:bg-gray-50'
              )}
            >
              {label}
            </button>
          </Tooltip>
        ))}
      </div>

      <div className="my-2 h-px bg-muted" />
      <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {t('graphExplorer.toolbar.appearance', { defaultValue: 'Appearance' })}
      </p>

      <GraphSettingsSlider
        label={t('graphExplorer.toolbar.nodeSize', { defaultValue: 'Node Size' })}
        value={settings.nodeSize}
        min={2}
        max={20}
        onChange={(v) => slider('nodeSize', v)}
      />
      <GraphSettingsSlider
        label={t('graphExplorer.toolbar.linkWidth', { defaultValue: 'Link Width' })}
        value={settings.linkWidth}
        min={0.5}
        max={5}
        step={0.5}
        onChange={(v) => slider('linkWidth', v)}
      />
      <GraphSettingsSlider
        label={t('graphExplorer.toolbar.chargeForce', { defaultValue: 'Charge Force' })}
        value={settings.chargeStrength}
        min={-500}
        max={-10}
        step={10}
        onChange={(v) => slider('chargeStrength', v)}
      />
      <GraphSettingsSlider
        label={t('graphExplorer.toolbar.linkDistance', { defaultValue: 'Link Distance' })}
        value={settings.linkDistance}
        min={20}
        max={200}
        step={10}
        onChange={(v) => slider('linkDistance', v)}
      />
    </div>
  );
}
