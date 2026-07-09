// ============================================
// AddDataView — Step 1 of 3: Upload or connect a data source
// Saves raw graph data to session, then navigates to /graph/edit-data
// ============================================

'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import DataSourceConnector, { DataSourceTab } from './data-source-connector';
import PageHeader from '../page-header';
import { saveRawData } from './graph-session';
import type { GraphData } from '@/types/graph-explorer.types';

/** Route map for DataSourceConnector tab → URL */
const TAB_ROUTES: Record<DataSourceTab, string> = {
  backend: '/graph/load-data',
  file: '/graph/file-upload',
  url: '/graph/fetch-data',
  path: '/graph/batch-upload',
  generate: '/graph/generate-data',
};

interface AddDataViewProps {
  /** Which data-source tab to show initially */
  defaultTab?: DataSourceTab;
}

/**
 * AddDataView — Standalone step-1 wrapper for DataSourceConnector.
 *
 * When data is loaded:
 *  1. Persists rawData + sourceLabel to sessionStorage via saveRawData()
 *  2. Navigates to /graph/edit-data for the pre-processing step
 *
 * Used by the /graph/add-data route page.
 *
 * @example
 * ```tsx
 * <AddDataView />
 * ```
 */
export default function AddDataView({ defaultTab }: AddDataViewProps) {
  const router = useRouter();

  const pageHeader = {
    title: 'Graph Data Source',
    breadcrumb: [
      { href: '/', name: 'Dashboard' },
      { href: '/graph/file-upload', name: 'Graph Explorer' },
      { name: 'Load Data' },
    ],
  };

  const handleDataLoaded = (data: GraphData, label: string, meta?: { caseIds?: string[] }) => {
    console.info('[AddDataView] Data loaded, saving to session:', {
      nodes: data.nodes.length,
      links: data.links.length,
      label,
    });
    saveRawData(data, label, meta?.caseIds);
    toast.success(`Loaded ${data.nodes.length} entities — proceeding to edit step`);
    const caseIds = (meta?.caseIds ?? []).map((x) => x.trim()).filter(Boolean);
    if (caseIds.length > 0) {
      router.push(`/graph/edit-entities/${encodeURIComponent(caseIds.join('&'))}`);
      return;
    }
    router.push('/graph/edit-entities');
  };

  return (
    <div className="w-full py-4 px-4 sm:px-6 lg:px-8">
      <PageHeader title={pageHeader.title} breadcrumb={pageHeader.breadcrumb} />
      <DataSourceConnector
        onLoad={handleDataLoaded}
        defaultTab={defaultTab}
        onTabChange={(tab) => router.push(TAB_ROUTES[tab])}
      />
    </div>
  );
}
