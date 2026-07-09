// ============================================
// EditDataView — Step 2 of 3: Pre-process and transform graph data
// Reads rawData from session, renders GraphDataProcessor,
// saves processedData to session, then navigates to /graph/visual-explorer
// ============================================

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button, Text, Title } from 'rizzui';
import { PiArrowLeftBold, PiDatabaseBold } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PageHeader from '../page-header';
import GraphDataProcessor, { ProcessorTab } from './graph-data-processor';
import FloatingNativeAiChat from '@/app/shared/native-ai-chat/floating-native-ai-chat';
import {
  loadRawData,
  saveProcessedData,
  clearGraphSession,
  clearProcessorDraft,
} from './graph-session';
import type { GraphData } from '@/types/graph-explorer.types';

/** Route map for GraphDataProcessor tab → URL */
const TAB_ROUTES: Record<ProcessorTab, string> = {
  entities: '/graph/edit-entities',
  relationships: '/graph/edit-relationships',
  filters: '/graph/edit-filters',
  transform: '/graph/edit-transform',
};

interface EditDataViewProps {
  /** Which processor tab to show initially */
  defaultTab?: ProcessorTab;
  /** Case IDs parsed from route segment (/graph/edit-entities/<joined-case-ids>) */
  caseIdsFromRoute?: string[];
}

/**
 * EditDataView — Standalone step-2 wrapper for GraphDataProcessor.
 *
 * On mount: reads rawData from sessionStorage.
 * If not found: redirects back to /graph/load-data.
 *
 * When user clicks Visualize:
 *  1. Saves processedData to sessionStorage via saveProcessedData()
 *  2. Navigates to /graph/visual-explorer
 *
 * @example
 * ```tsx
 * <EditDataView defaultTab="entities" />
 * ```
 */
export default function EditDataView({ defaultTab, caseIdsFromRoute }: EditDataViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [caseIds, setCaseIds] = useState<string[]>(caseIdsFromRoute ?? []);
  const [notFound, setNotFound] = useState(false);

  const tabTitleMap: Record<ProcessorTab, string> = {
    entities: t('graphExplorer.editEntities', { defaultValue: 'Edit Entities' }),
    relationships: t('graphExplorer.editRelationships', { defaultValue: 'Edit Relationships' }),
    filters: t('graphExplorer.editFilters', { defaultValue: 'Edit Filters' }),
    transform: t('graphExplorer.editTransform', { defaultValue: 'Transform Rules' }),
  };

  const selectedTab = defaultTab ?? 'entities';

  const buildNativeAiChatContext = useCallback(() => {
    if (!rawData) {
      return { tab: selectedTab, case_ids: caseIds, pathname: pathname ?? '' };
    }
    return {
      tab: selectedTab,
      case_ids: caseIds,
      source_label: sourceLabel,
      pathname: pathname ?? '',
      node_count: rawData.nodes.length,
      link_count: rawData.links.length,
    };
  }, [rawData, selectedTab, caseIds, sourceLabel, pathname]);

  const pageHeader = {
    title: tabTitleMap[selectedTab],
    breadcrumb: [
      { href: '/', name: t('pages.dashboard', { defaultValue: 'Dashboard' }) },
      { href: '/graph/file-upload', name: t('graphExplorer.title', { defaultValue: 'Graph Explorer' }) },
      { name: tabTitleMap[selectedTab] },
    ],
  };

  useEffect(() => {
    console.info('[EditDataView] Loading raw data from session…');
    const session = loadRawData();
    if (!session) {
      console.warn('[EditDataView] No session data found, redirecting to load-data');
      setNotFound(true);
    } else {
      setRawData(session.data);
      setSourceLabel(session.label);
      setCaseIds(session.caseIds?.length ? session.caseIds : (caseIdsFromRoute ?? []));
    }
  }, [caseIdsFromRoute]);

  const caseIdsQuery = caseIds.length > 0 ? `?caseIds=${encodeURIComponent(caseIds.join('&'))}` : '';
  const tabRoute = (tab: ProcessorTab) => `${TAB_ROUTES[tab]}${caseIdsQuery}`;

  const handleProcessed = (data: GraphData) => {
    console.info('[EditDataView] Processed data ready, saving to session:', {
      nodes: data.nodes.length,
      links: data.links.length,
    });
    saveProcessedData(data);
    clearProcessorDraft();
    const target =
      caseIds.length > 0
        ? `/graph/visual-explorer/${encodeURIComponent(caseIds.join('&'))}`
        : '/graph/visual-explorer';
    router.push(target);
  };

  const handleBack = () => {
    clearGraphSession();
    router.push('/graph/load-data');
  };

  // Redirect state — no raw data in session
  if (notFound) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <PiDatabaseBold className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <Title as="h3" className="text-lg font-semibold mb-2">
          {t('graphExplorer.edit.noDataLoaded', { defaultValue: 'No Data Loaded' })}
        </Title>
        <Text className="text-sm text-gray-500 mb-6">
          {t('graphExplorer.edit.noDataLoadedHint', {
            defaultValue: 'Please upload or connect a data source first.',
          })}
        </Text>
        <Button onClick={() => router.push('/graph/load-data')} className="flex items-center gap-2">
          <PiArrowLeftBold className="h-4 w-4" />
          {t('graphExplorer.edit.goToUpload', { defaultValue: 'Go to Upload' })}
        </Button>
      </div>
    );
  }

  // Loading state — waiting for useEffect
  if (!rawData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full py-4 px-4 sm:px-6 lg:px-8">
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <GraphDataProcessor
        rawData={rawData}
        onProcessed={handleProcessed}
        onBack={handleBack}
        sourceLabel={sourceLabel}
        defaultTab={defaultTab}
        onTabChange={(tab) => router.push(tabRoute(tab))}
      />

      <FloatingNativeAiChat surface="graph_edit_entities" buildContext={buildNativeAiChatContext} />
    </div>
  );
}
