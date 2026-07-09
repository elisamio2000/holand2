'use client';

/**
 * Shared entity-type icons for graph UI (inspector, pathfinding, etc.).
 */

import {
  PiUserBold,
  PiBuildingsBold,
  PiMapPinBold,
  PiCurrencyDollarBold,
  PiCalendarBold,
  PiFileBold,
  PiCarBold,
  PiPhoneBold,
  PiEnvelopeBold,
  PiPackageBold,
  PiProjectorScreenChartBold,
  PiQuestionBold,
} from 'react-icons/pi';
import type { EntityType } from '@/types/graph-explorer.types';

export const GRAPH_ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  person: <PiUserBold className="h-5 w-5" />,
  organization: <PiBuildingsBold className="h-5 w-5" />,
  location: <PiMapPinBold className="h-5 w-5" />,
  financial_entity: <PiCurrencyDollarBold className="h-5 w-5" />,
  event: <PiCalendarBold className="h-5 w-5" />,
  document: <PiFileBold className="h-5 w-5" />,
  vehicle: <PiCarBold className="h-5 w-5" />,
  phone: <PiPhoneBold className="h-5 w-5" />,
  phone_number: <PiPhoneBold className="h-5 w-5" />,
  email: <PiEnvelopeBold className="h-5 w-5" />,
  product: <PiPackageBold className="h-5 w-5" />,
  project: <PiProjectorScreenChartBold className="h-5 w-5" />,
  unknown: <PiQuestionBold className="h-5 w-5" />,
};
