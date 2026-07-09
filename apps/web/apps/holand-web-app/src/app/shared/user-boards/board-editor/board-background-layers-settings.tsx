'use client';

import { useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { useTranslation } from 'react-i18next';
import { Button, Input, Text } from 'rizzui';
import type { BoardBackgroundLayer } from '../lib/board-types';

interface BoardBackgroundLayersSettingsProps {
  layers: BoardBackgroundLayer[];
  gridBackgroundColor?: string;
  onChange: (layers: BoardBackgroundLayer[]) => void;
}

export function BoardBackgroundLayersSettings({
  layers,
  gridBackgroundColor,
  onChange,
}: BoardBackgroundLayersSettingsProps) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState('');
  const [artifactId, setArtifactId] = useState('');

  const addColorLayer = () => {
    onChange([
      ...layers,
      {
        id: createId(),
        type: 'color',
        color: gridBackgroundColor ?? '#ffffff',
        opacity: 1,
        zIndex: layers.length,
      },
    ]);
  };

  const addImageLayer = () => {
    if (!imageUrl.trim()) return;
    onChange([
      ...layers,
      {
        id: createId(),
        type: 'image',
        url: imageUrl.trim(),
        opacity: 0.85,
        fit: 'cover',
        zIndex: layers.length,
      },
    ]);
    setImageUrl('');
  };

  const addArtifactLayer = () => {
    if (!artifactId.trim()) return;
    onChange([
      ...layers,
      {
        id: createId(),
        type: 'artifact',
        artifactId: artifactId.trim(),
        opacity: 0.85,
        fit: 'cover',
        zIndex: layers.length,
      },
    ]);
    setArtifactId('');
  };

  const addMapLayer = () => {
    onChange([
      ...layers,
      {
        id: createId(),
        type: 'map',
        center: { lat: 35.6892, lng: 51.389 },
        zoom: 10,
        opacity: 0.9,
        zIndex: layers.length,
      },
    ]);
  };

  return (
    <div className="space-y-3 border-t border-muted pt-3">
      <Text className="text-xs font-semibold">{t('boards.background.title', 'Background layers')}</Text>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={addColorLayer}>
          {t('boards.background.addColor', 'Add color')}
        </Button>
        <Button size="sm" variant="outline" onClick={addMapLayer}>
          {t('boards.background.addMap', 'Add map')}
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          size="sm"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder={t('boards.background.imageUrl', 'Image URL')}
          className="flex-1"
        />
        <Button size="sm" variant="outline" onClick={addImageLayer} disabled={!imageUrl.trim()}>
          {t('boards.background.addImage', 'Add image')}
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          size="sm"
          value={artifactId}
          onChange={(e) => setArtifactId(e.target.value)}
          placeholder={t('boards.background.artifactId', 'Artifact ID')}
          className="flex-1"
        />
        <Button size="sm" variant="outline" onClick={addArtifactLayer} disabled={!artifactId.trim()}>
          {t('boards.background.addArtifact', 'Add artifact')}
        </Button>
      </div>
      <ul className="space-y-2">
        {layers.map((layer) => (
          <li key={layer.id} className="rounded border border-muted p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span>
                {layer.type} · z{layer.zIndex}
                {layer.locked ? ' · locked' : ''}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="text"
                  onClick={() =>
                    onChange(
                      layers.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l))
                    )
                  }
                >
                  {layer.locked
                    ? t('boards.background.unlock', 'Unlock')
                    : t('boards.background.lock', 'Lock')}
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => onChange(layers.filter((l) => l.id !== layer.id))}
                >
                  {t('boards.background.remove', 'Remove')}
                </Button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={layer.opacity}
              className="mt-1 w-full"
              onChange={(e) =>
                onChange(
                  layers.map((l) =>
                    l.id === layer.id ? { ...l, opacity: Number.parseFloat(e.target.value) } : l
                  )
                )
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
