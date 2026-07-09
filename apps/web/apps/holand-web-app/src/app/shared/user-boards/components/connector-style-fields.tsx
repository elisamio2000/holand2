'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BoardArrowDirection,
  BoardConnectorRouteStyle,
  BoardStrokeStyle,
} from '../lib/board-types';
import {
  IconArrowBackward,
  IconArrowBoth,
  IconArrowForward,
  IconArrowNone,
  IconRouteCurved,
  IconRouteOrthogonal,
  IconRouteStraight,
  IconStrokeDashed,
  IconStrokeDotted,
  IconStrokeSolid,
} from './board-design-icons';
import { IconChoiceField } from './icon-choice-field';

export function StrokeStyleField({
  label,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: BoardStrokeStyle;
  onChange: (value: BoardStrokeStyle) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      [
        { value: 'solid' as const, label: t('boards.inspector.stroke.solid', 'Solid'), icon: <IconStrokeSolid /> },
        { value: 'dashed' as const, label: t('boards.inspector.stroke.dashed', 'Dashed'), icon: <IconStrokeDashed /> },
        { value: 'dotted' as const, label: t('boards.inspector.stroke.dotted', 'Dotted'), icon: <IconStrokeDotted /> },
      ],
    [t]
  );
  return (
    <IconChoiceField
      label={label ?? t('boards.inspector.strokeStyle', 'Line style')}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function RouteStyleField({
  label,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: BoardConnectorRouteStyle;
  onChange: (value: BoardConnectorRouteStyle) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      [
        { value: 'curved' as const, label: t('boards.inspector.routeCurved', 'Curved'), icon: <IconRouteCurved /> },
        {
          value: 'orthogonal' as const,
          label: t('boards.inspector.routeOrthogonal', 'Orthogonal'),
          icon: <IconRouteOrthogonal />,
        },
        {
          value: 'straight' as const,
          label: t('boards.inspector.routeStraight', 'Straight'),
          icon: <IconRouteStraight />,
        },
      ],
    [t]
  );
  return (
    <IconChoiceField
      label={label ?? t('boards.inspector.routeStyle', 'Route style')}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export function ArrowDirectionField({
  label,
  value,
  onChange,
  disabled,
}: {
  label?: string;
  value: BoardArrowDirection;
  onChange: (value: BoardArrowDirection) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      [
        { value: 'forward' as const, label: t('boards.inspector.arrow.forward', 'Forward'), icon: <IconArrowForward /> },
        { value: 'backward' as const, label: t('boards.inspector.arrow.backward', 'Backward'), icon: <IconArrowBackward /> },
        { value: 'both' as const, label: t('boards.inspector.arrow.both', 'Both'), icon: <IconArrowBoth /> },
        { value: 'none' as const, label: t('boards.inspector.arrow.none', 'None'), icon: <IconArrowNone /> },
      ],
    [t]
  );
  return (
    <IconChoiceField
      label={label ?? t('boards.inspector.arrowDirection', 'Arrow direction')}
      value={value}
      options={options}
      onChange={onChange}
      disabled={disabled}
    />
  );
}
