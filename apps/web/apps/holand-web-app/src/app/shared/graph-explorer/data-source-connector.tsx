'use client';

// ============================================
// DataSourceConnector â€” Multi-source graph data input
// Provides tab-based interface for: Backend Case IDs, File Upload,
// External URL, and File Path data sources
// ============================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Button, Text, Title, Input, Badge, Loader } from 'rizzui';
import {
  PiDatabaseBold,
  PiUploadSimpleBold,
  PiGlobeBold,
  PiFolderOpenBold,
  PiFileCsvBold,
  PiFileCodeBold,
  PiFileTextBold,
  PiXBold,
  PiCheckCircleBold,
  PiWarningCircleBold,
  PiPlusBold,
  PiTrashBold,
  PiCloudArrowDownBold,
  PiLinkBold,
  PiGraphBold,
  PiInfoBold,
  PiArrowRightBold,
  PiCloudSlashBold,
  PiFlaskBold,
  PiArrowClockwiseBold,
  PiMagnifyingGlassBold,
  PiPhoneCallBold,
  PiTableBold,
  PiMagicWandBold,
  PiCaretDownBold,
  PiMicrosoftExcelLogoBold,
  PiTranslateBold,
  PiChatCircleBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { isAxiosError } from 'axios';
import { graphService, transformRawToGraphData } from '@/services/graph-explorer.service';
import type {
  GraphCaseListItem,
  GraphArtifactListItem,
  GraphExplorerOverview,
  GraphData,
} from '@/types/graph-explorer.types';
import { generateTestGraph } from './generate-test-graph';
import {
  parseGraphFile,
  fetchAndParseGraphUrl,
  detectFormat,
  CSV_FORMAT_TEMPLATES,
  type ParseResult,
  type CsvFormatTemplateId,
} from '@/utils/graph-data-parsers';
import {
  readGraphDataFile,
  ENCODING_OPTIONS,
  type FileEncoding,
} from '@/utils/file-encoding-reader';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Available data source tabs */
export type DataSourceTab = 'backend' | 'file' | 'url' | 'path' | 'generate';

interface DataSourceConnectorProps {
  /** Called when graph data is successfully loaded */
  onLoad: (data: GraphData, sourceLabel: string, meta?: { caseIds?: string[] }) => void;
  /** Optional className */
  className?: string;
  /** Pre-select a tab on first render */
  defaultTab?: DataSourceTab;
  /** Called whenever the user switches tabs (used for URL-based navigation) */
  onTabChange?: (tab: DataSourceTab) => void;
}

// â”€â”€â”€ Accepted file types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ACCEPTED_EXTENSIONS = '.json,.csv,.tsv,.txt,.text,.graphml,.gexf,.xls,.xlsx,.xlsm,.xlsb';
const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  json: PiFileCodeBold,
  csv: PiFileCsvBold,
  tsv: PiFileCsvBold,
  txt: PiFileTextBold,
  text: PiFileTextBold,
  xls: PiMicrosoftExcelLogoBold,
  xlsx: PiMicrosoftExcelLogoBold,
  xlsm: PiMicrosoftExcelLogoBold,
  xlsb: PiMicrosoftExcelLogoBold,
};

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * DataSourceConnector â€” Multi-source graph data input component.
 *
 * Provides 4 tabs modeled after the Case Importer pattern:
 * 1. Backend (Case IDs) â€” connect to API Gateway via /api/gateway proxy
 * 2. File Upload â€” JSON, CSV, TSV, TXT with drag & drop
 * 3. External URL â€” fetch from remote endpoint
 * 4. File Path â€” server-side file path (future)
 *
 * @requires graphService â€” for backend API calls
 * @requires parseGraphFile â€” for local file parsing
 * @requires fetchAndParseGraphUrl â€” for URL fetching
 *
 * @example
 * ```tsx
 * <DataSourceConnector onLoad={(data, label) => setGraphData(data)} />
 * ```
 */
export default function DataSourceConnector({
  onLoad,
  className,
  defaultTab,
  onTabChange,
}: DataSourceConnectorProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DataSourceTab>(defaultTab ?? 'file');

  const handleTabClick = (tab: DataSourceTab) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };
  const [isLoading, setIsLoading] = useState(false);

  const tabs: { key: DataSourceTab; icon: React.ElementType; labelKey: string }[] = [
    { key: 'backend', icon: PiDatabaseBold, labelKey: 'graphExplorer.dataSource.backendTab' },
    { key: 'file', icon: PiUploadSimpleBold, labelKey: 'graphExplorer.dataSource.fileTab' },
    { key: 'url', icon: PiGlobeBold, labelKey: 'graphExplorer.dataSource.urlTab' },
    { key: 'path', icon: PiFolderOpenBold, labelKey: 'graphExplorer.dataSource.pathTab' },
    { key: 'generate', icon: PiFlaskBold, labelKey: 'graphExplorer.dataSource.generateTab' },
  ];

  return (
    <div className={cn('w-full', className)}>
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <PiGraphBold className="h-5 w-5 text-primary" />
        </div>
        <div>
          <Title as="h4" className="text-base font-semibold text-gray-900 dark:text-gray-700">
            {t('graphExplorer.dataSource.title')}
          </Title>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            {t('graphExplorer.dataSource.description')}
          </Text>
        </div>
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-muted bg-gray-50 dark:bg-gray-100 p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-all',
                isActive
                  ? 'bg-gray-0 dark:bg-gray-50 text-primary shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 p-6 min-h-[500px]">
        {activeTab === 'backend' && (
          <BackendTab onLoad={onLoad} isLoading={isLoading} setIsLoading={setIsLoading} />
        )}
        {activeTab === 'file' && (
          <FileUploadTab onLoad={onLoad} isLoading={isLoading} setIsLoading={setIsLoading} />
        )}
        {activeTab === 'url' && (
          <UrlTab onLoad={onLoad} isLoading={isLoading} setIsLoading={setIsLoading} />
        )}
        {activeTab === 'path' && (
          <PathTab />
        )}
        {activeTab === 'generate' && (
          <GenerateTab onLoad={onLoad} isLoading={isLoading} setIsLoading={setIsLoading} />
        )}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 1: Backend (Case IDs)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface TabProps {
  onLoad: (data: GraphData, sourceLabel: string, meta?: { caseIds?: string[] }) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

/**
 * BackendTab â€” Load graph data via graph_explorer plugins (Neo4j).
 */
function BackendTab({ onLoad, isLoading, setIsLoading }: TabProps) {
  const { t } = useTranslation();
  const [caseIds, setCaseIds] = useState<string[]>(['']);
  const [focusedCaseRow, setFocusedCaseRow] = useState(0);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [caseList, setCaseList] = useState<GraphCaseListItem[]>([]);
  const [caseListLoading, setCaseListLoading] = useState(false);
  const [caseListError, setCaseListError] = useState<string | null>(null);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [overview, setOverview] = useState<GraphExplorerOverview | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [artifactList, setArtifactList] = useState<GraphArtifactListItem[]>([]);
  const [artifactListLoading, setArtifactListLoading] = useState(false);
  const [artifactSearchQuery, setArtifactSearchQuery] = useState('');
  const [artifactIds, setArtifactIds] = useState<string[]>(['']);
  const [neoElementIds, setNeoElementIds] = useState<string[]>(['']);
  const [lastLoadError, setLastLoadError] = useState<string | null>(null);
  const multiCaseMode = caseIds.filter((x) => x.trim()).length > 1;
  const validArtifacts = useMemo(
    () => artifactIds.map((s) => s.trim()).filter(Boolean),
    [artifactIds]
  );
  const validElements = useMemo(
    () => neoElementIds.map((s) => s.trim()).filter(Boolean),
    [neoElementIds]
  );

  const loadCaseList = useCallback(async () => {
    setCaseListLoading(true);
    setCaseListError(null);
    try {
      const res = await graphService.listCases({ limit: 2000 });
      setCaseList(res.items);
      console.info('[DataSourceConnector] Case list loaded (plugin):', { count: res.count });
    } catch (err: unknown) {
      console.error('[DataSourceConnector] Case list failed:', err);
      setCaseList([]);
      const rateLimited = isAxiosError(err) && err.response?.status === 429;
      const msg = rateLimited
        ? t('graphExplorer.dataSource.caseListRateLimited')
        : t('graphExplorer.dataSource.caseListError');
      setCaseListError(msg);
      toast.error(msg);
    } finally {
      setCaseListLoading(false);
    }
  }, [t]);

  const loadArtifactsForCase = useCallback(async (caseId: string) => {
    const cid = caseId.trim();
    if (!cid) {
      setArtifactList([]);
      return;
    }
    setArtifactListLoading(true);
    try {
      const res = await graphService.listArtifacts(cid, { limit: 500 });
      setArtifactList(res.items);
    } catch (err: unknown) {
      console.error('[DataSourceConnector] Artifact list failed:', err);
      setArtifactList([]);
    } finally {
      setArtifactListLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCaseList();
    void graphService.fetchOverview().then(setOverview);
  }, [loadCaseList]);

  const searchedCases = useMemo(() => {
    const q = caseSearchQuery.trim().toLowerCase();
    if (!q) return caseList;
    return caseList.filter((c) => c.case_id.toLowerCase().includes(q));
  }, [caseList, caseSearchQuery]);

  const displayedCases = searchedCases;

  const searchedArtifacts = useMemo(() => {
    const q = artifactSearchQuery.trim().toLowerCase();
    if (!q) return artifactList;
    return artifactList.filter(
      (a) =>
        a.artifact_id.toLowerCase().includes(q) ||
        (a.label || '').toLowerCase().includes(q)
    );
  }, [artifactList, artifactSearchQuery]);

  const applyCaseFromList = useCallback(
    (case_id: string) => {
      setSelectedCaseId(case_id);
      setArtifactSearchQuery('');
      void loadArtifactsForCase(case_id);
      setCaseIds((prev) => {
        if (prev.length === 1) {
          return [case_id];
        }
        const emptyIdx = prev.findIndex((id) => !id.trim());
        if (emptyIdx >= 0) {
          const next = [...prev];
          next[emptyIdx] = case_id;
          return next;
        }
        const next = [...prev];
        const fi = Math.min(Math.max(0, focusedCaseRow), next.length - 1);
        next[fi] = case_id;
        return next;
      });
    },
    [focusedCaseRow, loadArtifactsForCase]
  );

  const applyArtifactFromList = useCallback((artifact_id: string) => {
    setArtifactIds((prev) => {
      if (prev.length === 1 && !prev[0].trim()) return [artifact_id];
      const emptyIdx = prev.findIndex((id) => !id.trim());
      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = artifact_id;
        return next;
      }
      return [artifact_id];
    });
  }, []);

  const addCaseId = useCallback(() => {
    const newRowIndex = caseIds.length;
    setCaseIds((prev) => [...prev, '']);
    setFocusedCaseRow(newRowIndex);
  }, [caseIds.length]);

  const removeCaseId = useCallback((index: number) => {
    setCaseIds((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setFocusedCaseRow((f) => {
        let nf = f;
        if (index < f) nf -= 1;
        else if (index === f) nf = Math.min(f, Math.max(0, next.length - 1));
        return Math.max(0, Math.min(nf, next.length - 1));
      });
      return next;
    });
  }, []);

  const updateCaseId = useCallback((index: number, value: string) => {
    setCaseIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const addArtifactId = useCallback(() => {
    setArtifactIds((prev) => [...prev, '']);
  }, []);

  const removeArtifactId = useCallback((index: number) => {
    setArtifactIds((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateArtifactId = useCallback((index: number, value: string) => {
    setArtifactIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const addNeoElementId = useCallback(() => {
    setNeoElementIds((prev) => [...prev, '']);
  }, []);

  const removeNeoElementId = useCallback((index: number) => {
    setNeoElementIds((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const updateNeoElementId = useCallback((index: number, value: string) => {
    setNeoElementIds((prev) => prev.map((v, i) => (i === index ? value : v)));
  }, []);

  const handleLoad = useCallback(async () => {
    const validIds = caseIds.map((id) => id.trim()).filter(Boolean);
    if (validIds.length === 0) {
      toast.error(t('graphExplorer.dataSource.noCaseId'));
      return;
    }

    console.info('[DataSourceConnector] Loading from backend:', {
      caseIds: validIds,
      artifactIds: validArtifacts,
      neoElementIds: validElements,
    });
    setIsLoading(true);
    setBackendAvailable(null);
    setLastLoadError(null);

    try {
      if (validIds.length > 1) {
        const results = await Promise.allSettled(
          validIds.map((id) => graphService.getCaseGraph(id))
        );

        const successData: GraphData[] = [];
        const failedIds: string[] = [];

        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            successData.push(r.value);
          } else {
            failedIds.push(validIds[i]);
          }
        });

        if (successData.length === 0) {
          setBackendAvailable(false);
          toast.error(t('graphExplorer.dataSource.allFailed'));
          return;
        }

        if (failedIds.length > 0) {
          toast.error(`Failed to load: ${failedIds.join(', ')}`);
        }

        const merged = mergeGraphData(successData);
        setBackendAvailable(true);
        onLoad(merged, `Cases: ${validIds.join(', ')}`, { caseIds: validIds });
        toast.success(
          `${t('graphExplorer.dataSource.loaded')} (${successData.length}/${validIds.length})`
        );
        return;
      }

      const cid = validIds[0];
      const labelBase = [`Case: ${cid}`];

      if (validElements.length > 1) {
        if (validArtifacts.length > 0) {
          toast.error(t('graphExplorer.dataSource.multiSeedArtifactConflict'));
        }
        const graphs = await Promise.all(
          validElements.map((elementId) => graphService.getCaseGraph(cid, { elementId }))
        );
        const merged = mergeGraphData(graphs);
        setBackendAvailable(true);
        const elShort =
          validElements.length > 2
            ? `${validElements.slice(0, 2).join(', ')}â€¦ (+${validElements.length - 2})`
            : validElements.join(', ');
        onLoad(merged, [...labelBase, `elementIds: ${elShort}`].join(' Â· '), { caseIds: [cid] });
        toast.success(t('graphExplorer.dataSource.loaded'));
        return;
      }

      if (validArtifacts.length > 1) {
        const graphs = await Promise.all(
          validArtifacts.map((artifactId) => graphService.getCaseGraph(cid, { artifactId }))
        );
        const merged = mergeGraphData(graphs);
        setBackendAvailable(true);
        const artShort =
          validArtifacts.length > 2
            ? `${validArtifacts.slice(0, 2).join(', ')}â€¦ (+${validArtifacts.length - 2})`
            : validArtifacts.join(', ');
        onLoad(merged, [...labelBase, `artifacts: ${artShort}`].join(' Â· '), { caseIds: [cid] });
        toast.success(t('graphExplorer.dataSource.loaded'));
        return;
      }

      const graphOpts =
        validElements.length === 1 && validArtifacts.length === 1
          ? { elementId: validElements[0], artifactId: validArtifacts[0] }
          : validElements.length === 1
            ? { elementId: validElements[0] }
            : validArtifacts.length === 1
              ? { artifactId: validArtifacts[0] }
              : undefined;

      const data = await graphService.getCaseGraph(cid, graphOpts);
      setBackendAvailable(true);
      const labelParts = [...labelBase];
      if (validElements.length === 1) labelParts.push(`elementId: ${validElements[0]}`);
      if (validArtifacts.length === 1) labelParts.push(`artifact: ${validArtifacts[0]}`);
      onLoad(data, labelParts.join(' Â· '), { caseIds: [cid] });
      toast.success(t('graphExplorer.dataSource.loaded'));
    } catch (err: unknown) {
      console.error('[DataSourceConnector] Backend load failed:', err);
      setBackendAvailable(false);
      let toastMsg = t('graphExplorer.dataSource.backendError');
      let detail = '';
      if (isAxiosError(err)) {
        const st = err.response?.status;
        const body =
          typeof err.response?.data === 'string'
            ? err.response.data.slice(0, 200)
            : err.response?.data &&
                typeof err.response.data === 'object' &&
                'detail' in err.response.data
              ? String((err.response.data as { detail?: unknown }).detail).slice(0, 200)
              : '';
        detail = [st ? `HTTP ${st}` : '', body].filter(Boolean).join(' â€” ');
        if (st === 404) toastMsg = t('graphExplorer.dataSource.caseNotFound404');
      }
      setLastLoadError(detail || (err instanceof Error ? err.message : String(err)));
      toast.error(toastMsg);
    } finally {
      setIsLoading(false);
    }
  }, [validArtifacts, validElements, caseIds, onLoad, setIsLoading, t]);

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
        <PiInfoBold className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{t('graphExplorer.dataSource.backendInfo')}</span>
      </div>

      {overview && (
        <div className="flex items-start gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-200">
          <PiCheckCircleBold className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            {t('graphExplorer.dataSource.overviewBanner', {
              labels: overview.schema?.labels?.length ?? 0,
              graphrag: overview.graphrag_ready
                ? t('graphExplorer.dataSource.overviewGraphragReady')
                : t('graphExplorer.dataSource.overviewGraphragPending'),
            })}
          </span>
        </div>
      )}

      {/* Case list from plugin_graph_explorer_cases */}
      <div className="rounded-lg border border-muted bg-gray-50/80 dark:bg-gray-100/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('graphExplorer.dataSource.caseListTitle')}
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => void loadCaseList()}
            disabled={caseListLoading}
            isLoading={caseListLoading}
          >
            <PiArrowClockwiseBold className="h-3.5 w-3.5" />
            {t('graphExplorer.dataSource.caseListRefresh')}
          </Button>
        </div>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {t('graphExplorer.dataSource.caseListHint')}
        </Text>
        {caseList.length > 0 && (
          <Input
            size="sm"
            type="search"
            value={caseSearchQuery}
            onChange={(e) => setCaseSearchQuery(e.target.value)}
            placeholder={t('graphExplorer.dataSource.caseListSearchPlaceholder')}
            className="text-xs"
            disabled={caseListLoading}
            prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5 text-gray-400" />}
          />
        )}
        {caseListLoading && caseList.length === 0 && (
          <div className="flex justify-center py-6">
            <Loader variant="spinner" size="sm" />
          </div>
        )}
        {caseListError && (
          <Text className="text-[11px] text-orange-600 dark:text-orange-400">{caseListError}</Text>
        )}
        {!caseListLoading && caseList.length === 0 && !caseListError && (
          <Text className="text-[11px] text-gray-500">{t('graphExplorer.dataSource.caseListEmpty')}</Text>
        )}
        {!caseListLoading && caseList.length > 0 && searchedCases.length === 0 && (
          <Text className="text-[11px] text-gray-500">{t('graphExplorer.dataSource.caseListNoSearchMatches')}</Text>
        )}
        {caseList.length > 0 && searchedCases.length > 0 && (
          <div className="max-h-52 overflow-y-auto rounded-md border border-muted bg-gray-0 dark:bg-gray-50 divide-y divide-muted">
            {displayedCases.map((c) => {
              const selected = caseIds.some((id) => id.trim() === c.case_id);
              return (
                <button
                  key={c.case_id}
                  type="button"
                  onClick={() => applyCaseFromList(c.case_id)}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors',
                    selected
                      ? 'bg-primary/10 text-primary dark:bg-primary/15'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-100'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono font-medium text-gray-900 dark:text-gray-800">
                      {c.case_id}
                    </div>
                  </div>
                  <Badge variant="flat" className="shrink-0 text-[10px]">
                    {t('graphExplorer.dataSource.caseListNodeCount', { count: c.node_count })}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Artifact list from plugin_graph_explorer_artifacts (after case select) */}
      {selectedCaseId && (
        <div className="rounded-lg border border-muted bg-gray-50/80 dark:bg-gray-100/50 p-3 space-y-2">
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('graphExplorer.dataSource.artifactListTitle', { caseId: selectedCaseId })}
          </Text>
          <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
            {t('graphExplorer.dataSource.artifactListHint')}
          </Text>
          {artifactListLoading && (
            <div className="flex justify-center py-4">
              <Loader variant="spinner" size="sm" />
            </div>
          )}
          {!artifactListLoading && artifactList.length > 0 && (
            <Input
              size="sm"
              type="search"
              value={artifactSearchQuery}
              onChange={(e) => setArtifactSearchQuery(e.target.value)}
              placeholder={t('graphExplorer.dataSource.artifactListSearchPlaceholder')}
              className="text-xs"
              prefix={<PiMagnifyingGlassBold className="h-3.5 w-3.5 text-gray-400" />}
            />
          )}
          {!artifactListLoading && artifactList.length === 0 && (
            <Text className="text-[11px] text-gray-500">{t('graphExplorer.dataSource.artifactListEmpty')}</Text>
          )}
          {!artifactListLoading && artifactList.length > 0 && searchedArtifacts.length === 0 && (
            <Text className="text-[11px] text-gray-500">{t('graphExplorer.dataSource.artifactListNoMatches')}</Text>
          )}
          {!artifactListLoading && searchedArtifacts.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-muted bg-gray-0 dark:bg-gray-50 divide-y divide-muted">
              {searchedArtifacts.map((a) => {
                const selected = artifactIds.some((id) => id.trim() === a.artifact_id);
                return (
                  <button
                    key={a.artifact_id}
                    type="button"
                    onClick={() => applyArtifactFromList(a.artifact_id)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors',
                      selected
                        ? 'bg-primary/10 text-primary dark:bg-primary/15'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-100'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      {a.label && (
                        <div className="truncate font-medium text-gray-900 dark:text-gray-800">{a.label}</div>
                      )}
                      <div className="truncate font-mono text-[10px] text-gray-500">{a.artifact_id}</div>
                    </div>
                    <Badge variant="flat" className="shrink-0 text-[10px]">
                      {a.node_count}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Case ID inputs */}
      <div className="space-y-2">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('graphExplorer.dataSource.caseIds')}
        </Text>
        {caseIds.map((id, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              size="sm"
              type="text"
              value={id}
              onChange={(e) => updateCaseId(index, e.target.value)}
              onFocus={() => setFocusedCaseRow(index)}
              placeholder={`${t('graphExplorer.dataSource.caseIdPlaceholder')} ${index + 1}`}
              className="flex-1"
              disabled={isLoading}
            />
            {caseIds.length > 1 && (
              <button
                onClick={() => removeCaseId(index)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-950/30"
              >
                <PiTrashBold className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addCaseId}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <PiPlusBold className="h-3.5 w-3.5" />
          {t('graphExplorer.dataSource.addCaseId')}
        </button>
      </div>

      <div className="space-y-2">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('graphExplorer.dataSource.artifactIdLabel')}
        </Text>
        {artifactIds.map((aid, index) => (
          <div key={`artifact-${index}`} className="flex items-center gap-2">
            <Input
              size="sm"
              type="text"
              value={aid}
              onChange={(e) => updateArtifactId(index, e.target.value)}
              placeholder={t('graphExplorer.dataSource.artifactIdPlaceholder')}
              className="flex-1 font-mono text-xs"
              disabled={isLoading || multiCaseMode}
            />
            {artifactIds.length > 1 && !multiCaseMode && (
              <button
                type="button"
                onClick={() => removeArtifactId(index)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-950/30"
              >
                <PiTrashBold className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addArtifactId}
          disabled={isLoading || multiCaseMode}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <PiPlusBold className="h-3.5 w-3.5" />
          {t('graphExplorer.dataSource.addArtifactId')}
        </button>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {t('graphExplorer.dataSource.artifactHint')}
        </Text>
      </div>

      <div className="space-y-2">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('graphExplorer.dataSource.neoElementIdLabel')}
        </Text>
        {neoElementIds.map((eid, index) => (
          <div key={`element-${index}`} className="flex items-center gap-2">
            <Input
              size="sm"
              type="text"
              value={eid}
              onChange={(e) => updateNeoElementId(index, e.target.value)}
              placeholder={t('graphExplorer.dataSource.neoElementIdPlaceholder')}
              className="flex-1 font-mono text-xs"
              disabled={isLoading || multiCaseMode}
            />
            {neoElementIds.length > 1 && !multiCaseMode && (
              <button
                type="button"
                onClick={() => removeNeoElementId(index)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-950/30"
              >
                <PiTrashBold className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addNeoElementId}
          disabled={isLoading || multiCaseMode}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <PiPlusBold className="h-3.5 w-3.5" />
          {t('graphExplorer.dataSource.addNeoElementId')}
        </button>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {t('graphExplorer.dataSource.neoElementIdHint')}
        </Text>
      </div>

      {/* Load button */}
      <Button
        size="md"
        onClick={handleLoad}
        isLoading={isLoading}
        disabled={isLoading || caseIds.every((id) => !id.trim())}
        className="w-full gap-2"
      >
        <PiCloudArrowDownBold className="h-4 w-4" />
        {t('graphExplorer.dataSource.loadFromBackend')}
      </Button>

      {/* Backend not available warning */}
      {backendAvailable === false && (
        <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30">
          <div className="flex items-start gap-3">
            <PiCloudSlashBold className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <Text className="text-sm font-semibold text-gray-900 dark:text-gray-700">
                {t('graphExplorer.dataSource.loadFailedTitle')}
              </Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('graphExplorer.dataSource.backendNotAvailableDesc')}
              </Text>
              {lastLoadError && (
                <Text className="text-[11px] font-mono text-orange-800 dark:text-orange-300 mt-2 break-all">
                  {lastLoadError}
                </Text>
              )}
              <div className="mt-2 rounded bg-gray-100 dark:bg-gray-200 p-2 space-y-1">
                <code className="text-[10px] text-gray-600 dark:text-gray-400 font-mono block">
                  POST /tools/plugin_graph_explorer_case_graph/execute
                </code>
                <code className="text-[10px] text-gray-600 dark:text-gray-400 font-mono block">
                  POST /tools/plugin_graph_explorer_subgraph/execute (fallback: element_id | artifact_id | case_id)
                </code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 2: File Upload
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * FileUploadTab â€” Drag & drop file upload with multi-format support.
 *
 * Accepts: JSON, CSV, TSV, TXT
 * Features: drag & drop, file browse, format preview, parse results
 */
function FileUploadTab({ onLoad, isLoading, setIsLoading }: TabProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [parseResults, setParseResults] = useState<(ParseResult & { fileName: string })[]>([]);
  const [csvTemplate, setCsvTemplate] = useState<CsvFormatTemplateId>('auto');
  const [fileEncoding, setFileEncoding] = useState<FileEncoding>('auto');
  const [isFormatDropdownOpen, setIsFormatDropdownOpen] = useState(false);
  const [isEncodingDropdownOpen, setIsEncodingDropdownOpen] = useState(false);
  const formatDropdownRef = useRef<HTMLDivElement>(null);
  const encodingDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formatDropdownRef.current && !formatDropdownRef.current.contains(e.target as Node)) {
        setIsFormatDropdownOpen(false);
      }
      if (encodingDropdownRef.current && !encodingDropdownRef.current.contains(e.target as Node)) {
        setIsEncodingDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
      setParseResults([]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
      setParseResults([]);
    }
  }, []);

  const handleParse = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    console.info('[DataSourceConnector] Parsing files:', {
      count: selectedFiles.length,
      names: selectedFiles.map((f) => f.name),
      csvTemplate,
      fileEncoding,
    });
    setIsLoading(true);
    const results: (ParseResult & { fileName: string; detectedEncoding?: string })[] = [];

    for (const file of selectedFiles) {
      try {
        const readResult = await readGraphDataFile(file, fileEncoding);
        
        if (!readResult.success) {
          results.push({
            success: false,
            data: null,
            error: readResult.error || 'Failed to read file',
            nodeCount: 0,
            linkCount: 0,
            format: 'unknown',
            warnings: [],
            fileName: file.name,
            detectedEncoding: readResult.detectedEncoding,
          });
          continue;
        }

        const result = parseGraphFile(readResult.content, file.name, undefined, csvTemplate);
        results.push({ 
          ...result, 
          fileName: file.name,
          detectedEncoding: readResult.detectedEncoding,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to read file';
        results.push({
          success: false,
          data: null,
          error: msg,
          nodeCount: 0,
          linkCount: 0,
          format: 'unknown',
          warnings: [],
          fileName: file.name,
        });
      }
    }

    setParseResults(results);
    setIsLoading(false);

    const successResults = results.filter((r) => r.success && r.data);
    if (successResults.length === 1 && successResults[0].data) {
      onLoad(successResults[0].data, `File: ${successResults[0].fileName}`);
      toast.success(
        `${t('graphExplorer.dataSource.loaded')} â€” ${successResults[0].nodeCount} nodes, ${successResults[0].linkCount} edges`
      );
    } else if (successResults.length > 1) {
      const merged = mergeGraphData(successResults.map((r) => r.data!));
      onLoad(merged, `Files: ${successResults.map((r) => r.fileName).join(', ')}`);
      toast.success(
        `${t('graphExplorer.dataSource.loaded')} (${successResults.length} files merged)`
      );
    } else if (successResults.length === 0) {
      toast.error(t('graphExplorer.dataSource.parseFailed'));
    }
  }, [selectedFiles, onLoad, setIsLoading, t, csvTemplate, fileEncoding]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setParseResults([]);
  }, []);

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const Icon = FILE_TYPE_ICONS[ext] || PiFileTextBold;
    return <Icon className="h-4 w-4" />;
  };

  const FORMAT_ICONS: Record<string, React.ElementType> = {
    auto: PiMagicWandBold,
    phone: PiPhoneCallBold,
    table: PiTableBold,
    chat: PiChatCircleBold,
  };

  const selectedTemplate = CSV_FORMAT_TEMPLATES.find((tmpl) => tmpl.id === csvTemplate) ?? CSV_FORMAT_TEMPLATES[0];

  return (
    <div className="space-y-4">
      {/* â”€â”€ CSV Format Selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="rounded-lg border border-muted bg-gray-50/80 dark:bg-gray-100/50 p-3 space-y-2">
        <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
          {t('graphExplorer.dataSource.formatSelectorTitle')}
        </Text>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {t('graphExplorer.dataSource.formatSelectorHint')}
        </Text>

        {/* Dropdown */}
        <div className="relative" ref={formatDropdownRef}>
          <button
            type="button"
            onClick={() => setIsFormatDropdownOpen((v) => !v)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all',
              isFormatDropdownOpen
                ? 'border-primary ring-1 ring-primary/30 bg-gray-0 dark:bg-gray-50'
                : 'border-muted hover:border-primary/50 bg-gray-0 dark:bg-gray-50'
            )}
          >
            {(() => {
              const Icon = FORMAT_ICONS[selectedTemplate.icon] || PiTableBold;
              return (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-700 truncate">
                {t(selectedTemplate.labelKey)}
              </Text>
              <Text className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {t(selectedTemplate.descriptionKey)}
              </Text>
            </div>
            <PiCaretDownBold className={cn(
              'h-4 w-4 text-gray-400 transition-transform flex-shrink-0',
              isFormatDropdownOpen && 'rotate-180'
            )} />
          </button>

          {isFormatDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 shadow-lg overflow-hidden">
              {CSV_FORMAT_TEMPLATES.map((tmpl) => {
                const Icon = FORMAT_ICONS[tmpl.icon] || PiTableBold;
                const isActive = tmpl.id === csvTemplate;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setCsvTemplate(tmpl.id);
                      setIsFormatDropdownOpen(false);
                      setParseResults([]);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-100'
                    )}
                  >
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0',
                      isActive ? 'bg-primary/20' : 'bg-gray-100 dark:bg-gray-200'
                    )}>
                      <Icon className={cn(
                        'h-4 w-4',
                        isActive ? 'text-primary' : 'text-gray-500'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text className={cn(
                        'text-xs font-medium truncate',
                        isActive ? 'text-primary' : 'text-gray-900 dark:text-gray-700'
                      )}>
                        {t(tmpl.labelKey)}
                      </Text>
                      <Text className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {t(tmpl.descriptionKey)}
                      </Text>
                      <Text className="text-[9px] font-mono text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {tmpl.exampleHeader}
                      </Text>
                    </div>
                    {isActive && (
                      <PiCheckCircleBold className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* â”€â”€ Encoding Selector â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="rounded-lg border border-muted bg-gray-50/80 dark:bg-gray-100/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <PiTranslateBold className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          <Text className="text-xs font-semibold text-gray-800 dark:text-gray-700">
            {t('graphExplorer.dataSource.encodingSelectorTitle')}
          </Text>
        </div>
        <Text className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
          {t('graphExplorer.dataSource.encodingSelectorHint')}
        </Text>

        <div className="relative" ref={encodingDropdownRef}>
          <button
            type="button"
            onClick={() => setIsEncodingDropdownOpen((v) => !v)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all',
              isEncodingDropdownOpen
                ? 'border-primary ring-1 ring-primary/30 bg-gray-0 dark:bg-gray-50'
                : 'border-muted hover:border-primary/50 bg-gray-0 dark:bg-gray-50'
            )}
          >
            <div className="flex-1 min-w-0">
              <Text className="text-xs font-medium text-gray-900 dark:text-gray-700 truncate">
                {t(ENCODING_OPTIONS.find((e) => e.id === fileEncoding)?.labelKey || '')}
              </Text>
            </div>
            <PiCaretDownBold className={cn(
              'h-3.5 w-3.5 text-gray-400 transition-transform flex-shrink-0',
              isEncodingDropdownOpen && 'rotate-180'
            )} />
          </button>

          {isEncodingDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-muted bg-gray-0 dark:bg-gray-50 shadow-lg overflow-hidden">
              {ENCODING_OPTIONS.map((enc) => {
                const isActive = enc.id === fileEncoding;
                return (
                  <button
                    key={enc.id}
                    type="button"
                    onClick={() => {
                      setFileEncoding(enc.id);
                      setIsEncodingDropdownOpen(false);
                      setParseResults([]);
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-100'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <Text className={cn(
                        'text-xs font-medium truncate',
                        isActive ? 'text-primary' : 'text-gray-900 dark:text-gray-700'
                      )}>
                        {t(enc.labelKey)}
                      </Text>
                      <Text className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {t(enc.descriptionKey)}
                      </Text>
                    </div>
                    {isActive && (
                      <PiCheckCircleBold className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3">
        <div className="flex items-start gap-2">
          <PiInfoBold className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <Text className="text-xs font-medium text-blue-900 dark:text-blue-300">
              {t('graphExplorer.dataSource.supportedFormatsTitle')}
            </Text>
            <Text className="text-xs text-blue-700 dark:text-blue-400 mt-1">
              {csvTemplate === 'call_record' ? (
                <>
                  <strong>Call Record</strong>: CSV/XLS/XLSX with Id, Type (Incoming/Outgoing/Missed/SMS),
                  Number, Name, DateTime, Duration, Location
                </>
              ) : (
                <>
                  <strong>JSON</strong>: RawGraphData, GraphData, edge-list &bull;{' '}
                  <strong>CSV/TSV/Excel</strong>: source,target,relation header &bull;{' '}
                  <strong>TXT</strong>: &quot;Person A-&gt;WORKS_AT-&gt;Company B&quot; format
                </>
              )}
            </Text>
          </div>
        </div>
      </div>

      {/* Drag & Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 transition-all',
          isDragOver
            ? 'border-primary bg-primary/10 scale-[1.02]'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary/60 hover:bg-gray-50 dark:hover:bg-gray-100'
        )}
      >
        <div className={cn(
          'flex h-16 w-16 items-center justify-center rounded-full transition-all',
          isDragOver 
            ? 'bg-primary/20 scale-110' 
            : 'bg-gray-100 dark:bg-gray-200'
        )}>
          <PiUploadSimpleBold className={cn(
            'h-9 w-9 transition-all',
            isDragOver ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
          )} />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <Text className="text-base font-semibold text-gray-900 dark:text-gray-700">
            {isDragOver ? 'Drop files here to upload' : t('graphExplorer.dataSource.dropFiles')}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400">
            or click to browse &bull; Multiple files supported
          </Text>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {['JSON', 'CSV', 'TSV', 'TXT', 'XLS', 'XLSX'].map((fmt) => (
              <Badge
                key={fmt}
                variant="flat"
                className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-200 text-gray-600 dark:text-gray-400"
              >
                .{fmt.toLowerCase()}
              </Badge>
            ))}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('graphExplorer.dataSource.selectedFiles')} ({selectedFiles.length})
          </Text>
          {selectedFiles.map((file, i) => {
            const result = parseResults[i];
            return (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 rounded-md border border-muted p-2.5"
              >
                <div className="text-gray-500">{getFileIcon(file.name)}</div>
                <div className="flex-1 min-w-0">
                  <Text className="text-xs font-medium text-gray-900 dark:text-gray-700 truncate">
                    {file.name}
                  </Text>
                  <Text className="text-[10px] text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                    {result && result.success && (
                      <span className="text-green-500 ml-2">
                        âœ“ {result.nodeCount} nodes, {result.linkCount} edges
                      </span>
                    )}
                    {result && !result.success && (
                      <span className="text-red-500 ml-2">âœ— {result.error}</span>
                    )}
                  </Text>
                </div>
                {result && (
                  result.success
                    ? <PiCheckCircleBold className="h-4 w-4 text-green-500 flex-shrink-0" />
                    : <PiWarningCircleBold className="h-4 w-4 text-red-400 flex-shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-950/30"
                >
                  <PiXBold className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {/* Parse warnings */}
          {parseResults.some((r) => r.warnings.length > 0) && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 p-2 text-[10px] text-yellow-700 dark:text-yellow-400">
              {parseResults.flatMap((r) => r.warnings).map((w, i) => (
                <div key={i}>âš  {w}</div>
              ))}
            </div>
          )}

          {/* Parse button */}
          <Button
            size="md"
            onClick={handleParse}
            isLoading={isLoading}
            disabled={isLoading || selectedFiles.length === 0}
            className="w-full gap-2"
          >
            <PiArrowRightBold className="h-4 w-4" />
            {t('graphExplorer.dataSource.parseAndLoad')}
          </Button>
        </div>
      )}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 3: External URL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * UrlTab â€” Fetch graph data from a remote URL endpoint.
 */
function UrlTab({ onLoad, isLoading, setIsLoading }: TabProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');

  const handleFetch = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      toast.error(t('graphExplorer.dataSource.noUrl'));
      return;
    }

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      toast.error(t('graphExplorer.dataSource.invalidUrl'));
      return;
    }

    console.info('[DataSourceConnector] Fetching from URL:', { url: trimmed });
    setIsLoading(true);

    try {
      const result = await fetchAndParseGraphUrl(trimmed);
      if (result.success && result.data) {
        onLoad(result.data, `URL: ${trimmed}`);
        toast.success(
          `${t('graphExplorer.dataSource.loaded')} â€” ${result.nodeCount} nodes, ${result.linkCount} edges`
        );
      } else {
        toast.error(result.error || t('graphExplorer.dataSource.parseFailed'));
      }
    } catch (err: unknown) {
      console.error('[DataSourceConnector] URL fetch failed:', err);
      toast.error(t('graphExplorer.dataSource.fetchFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [url, onLoad, setIsLoading, t]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-xs text-blue-700 dark:text-blue-300">
        <PiInfoBold className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>{t('graphExplorer.dataSource.urlInfo')}</span>
      </div>

      <div className="space-y-2">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {t('graphExplorer.dataSource.endpointUrl')}
        </Text>
        <Input
          size="sm"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="/brand/brand-mark-4x.svg"
          disabled={isLoading}
          prefix={<PiLinkBold className="h-4 w-4 text-gray-400" />}
        />
      </div>

      <Button
        size="md"
        onClick={handleFetch}
        isLoading={isLoading}
        disabled={isLoading || !url.trim()}
        className="w-full gap-2"
      >
        <PiCloudArrowDownBold className="h-4 w-4" />
        {t('graphExplorer.dataSource.fetchAndLoad')}
      </Button>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 4: File Path (Server-side)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * PathTab â€” Server-side file path input (future feature placeholder).
 *
 * WHY placeholder: This requires a backend endpoint to read files from
 * the server filesystem, which is not yet implemented.
 */
function PathTab() {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/30">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center">
          <PiFolderOpenBold className="h-5 w-5 text-orange-500" />
        </div>
        <div>
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-700">
            {t('graphExplorer.dataSource.pathNotAvailable')}
          </Text>
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('graphExplorer.dataSource.pathNotAvailableDesc')}
          </Text>
        </div>
        <div className="mt-2 w-full max-w-md rounded bg-gray-100 dark:bg-gray-200 p-2">
          <code className="text-[10px] text-gray-600 dark:text-gray-400 font-mono block text-left">
            POST /api/v1/graph/from-file<br />
            &#123; &quot;path&quot;: &quot;/data/case-123/graph.json&quot; &#125;
          </code>
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Helper: Merge multiple GraphData objects
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Merge multiple GraphData objects into a single graph.
 *
 * Deduplicates nodes by ID, concatenates links, merges communities.
 *
 * @param dataSets - Array of GraphData to merge
 * @returns Single merged GraphData
 */
function mergeGraphData(dataSets: GraphData[]): GraphData {
  const nodeMap = new Map<string, GraphData['nodes'][0]>();
  const linkSet = new Map<string, GraphData['links'][0]>();
  const allCommunities: GraphData['communities'] = [];
  const allReports: GraphData['community_reports'] = [];

  dataSets.forEach((ds) => {
    ds.nodes.forEach((n) => {
      if (!nodeMap.has(n.id)) nodeMap.set(n.id, n);
    });
    ds.links.forEach((l) => {
      if (!linkSet.has(l.id)) linkSet.set(l.id, l);
    });
    if (ds.communities) allCommunities.push(...ds.communities);
    if (ds.community_reports) allReports.push(...ds.community_reports);
  });

  const nodes = Array.from(nodeMap.values());
  const links = Array.from(linkSet.values());

  // Aggregate stats
  const stats = dataSets[0]?.stats ?? {
    entity_count: nodes.length,
    relationship_count: links.length,
    community_count: allCommunities.length,
    report_count: allReports.length,
  };
  stats.entity_count = nodes.length;
  stats.relationship_count = links.length;

  console.info('[DataSourceConnector] Merged graphs:', {
    sources: dataSets.length,
    nodes: nodes.length,
    links: links.length,
  });

  return {
    nodes,
    links,
    communities: allCommunities,
    community_reports: allReports,
    stats,
  };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 5: Generate Test Data (Big Data Testing)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const PRESETS = [
  { label: 'Small (100 nodes)', nodeCount: 100, edgesPerNode: 2, description: 'Quick test â€” renders instantly' },
  { label: 'Medium (500 nodes)', nodeCount: 500, edgesPerNode: 3, description: 'Moderate â€” tests basic filtering' },
  { label: 'Large (2K nodes)', nodeCount: 2000, edgesPerNode: 3, description: 'LOD & viewport culling kick in' },
  { label: 'Big Data (5K nodes)', nodeCount: 5000, edgesPerNode: 3, description: 'Full scalability test â€” 3D recommended' },
  { label: 'Stress Test (10K nodes)', nodeCount: 10000, edgesPerNode: 2, description: 'Push engine to limits' },
] as const;

/**
 * GenerateTab â€” Generate synthetic test graph data for Big Data testing.
 *
 * Provides preset sizes and custom configuration for stress-testing
 * the graph explorer with large datasets.
 *
 * @requires generateTestGraph â€” synthetic data generator
 */
function GenerateTab({
  onLoad,
  isLoading,
  setIsLoading,
}: TabProps) {
  const [nodeCount, setNodeCount] = useState(1000);
  const [edgesPerNode, setEdgesPerNode] = useState(3);
  const [communityCount, setCommunityCount] = useState(0);
  const [seed, setSeed] = useState(42);

  const handleGenerate = useCallback(
    (count: number, edges: number, communities?: number) => {
      console.info('[GenerateTab] Generating test graph:', { count, edges, communities });
      setIsLoading(true);

      // WHY setTimeout: Allow UI to show loading state before blocking CPU with generation
      setTimeout(() => {
        try {
          const startTime = performance.now();
          const data = generateTestGraph({
            nodeCount: count,
            edgesPerNode: edges,
            communityCount: communities || undefined,
            seed,
          });
          const elapsed = Math.round(performance.now() - startTime);

          console.info('[GenerateTab] Generation complete:', {
            nodes: data.nodes.length,
            links: data.links.length,
            communities: data.communities?.length,
            timeMs: elapsed,
          });

          toast.success(`Generated ${data.nodes.length.toLocaleString()} nodes, ${data.links.length.toLocaleString()} links in ${elapsed}ms`);
          onLoad(data, `Test Data (${count.toLocaleString()} nodes)`);
        } catch (error: unknown) {
          console.error('[GenerateTab] Generation failed:', error);
          toast.error('Failed to generate test data');
        } finally {
          setIsLoading(false);
        }
      }, 50);
    },
    [onLoad, setIsLoading, seed]
  );

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
        <PiFlaskBold className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Big Data Test Generator
          </Text>
          <Text className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Generate synthetic graph data for stress-testing LOD, virtual viewport, and auto engine switch.
            Larger graphs activate Big Data optimizations automatically.
          </Text>
        </div>
      </div>

      {/* Presets */}
      <div>
        <Text className="text-sm font-medium text-gray-900 dark:text-gray-700 mb-3">
          Quick Presets
        </Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.nodeCount}
              onClick={() => handleGenerate(preset.nodeCount, preset.edgesPerNode)}
              disabled={isLoading}
              className={cn(
                'flex flex-col items-start gap-1 rounded-lg border border-muted p-3 text-left transition-all',
                'hover:border-primary hover:bg-primary/5',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Text className="text-sm font-medium text-gray-900 dark:text-gray-700">
                {preset.label}
              </Text>
              <Text className="text-[11px] text-gray-500 dark:text-gray-400">
                {preset.description}
              </Text>
            </button>
          ))}
        </div>
      </div>

      {/* Custom configuration */}
      <div>
        <Text className="text-sm font-medium text-gray-900 dark:text-gray-700 mb-3">
          Custom Configuration
        </Text>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Nodes</label>
            <Input
              type="number"
              min={10}
              max={50000}
              value={nodeCount}
              onChange={(e) => setNodeCount(Math.max(10, Math.min(50000, Number(e.target.value))))}
              size="sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Edges/Node</label>
            <Input
              type="number"
              min={1}
              max={10}
              value={edgesPerNode}
              onChange={(e) => setEdgesPerNode(Math.max(1, Math.min(10, Number(e.target.value))))}
              size="sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Communities (0=auto)</label>
            <Input
              type="number"
              min={0}
              max={50}
              value={communityCount}
              onChange={(e) => setCommunityCount(Math.max(0, Math.min(50, Number(e.target.value))))}
              size="sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Seed</label>
            <Input
              type="number"
              min={1}
              max={999999}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              size="sm"
            />
          </div>
        </div>

        <Button
          className="mt-4"
          onClick={() => handleGenerate(nodeCount, edgesPerNode, communityCount || undefined)}
          disabled={isLoading}
          isLoading={isLoading}
        >
          <PiFlaskBold className="h-4 w-4 mr-2" />
          Generate {nodeCount.toLocaleString()} Nodes
        </Button>
      </div>

      {/* Estimated metrics */}
      <div className="rounded-lg border border-muted bg-gray-50 dark:bg-gray-100 p-3">
        <Text className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          Estimated Output
        </Text>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-700">
              {nodeCount.toLocaleString()}
            </Text>
            <Text className="text-[10px] text-gray-500">Nodes</Text>
          </div>
          <div>
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-700">
              {Math.floor((nodeCount * edgesPerNode) / 2).toLocaleString()}
            </Text>
            <Text className="text-[10px] text-gray-500">Edges (approx)</Text>
          </div>
          <div>
            <Text className="text-lg font-semibold text-gray-900 dark:text-gray-700">
              {communityCount || Math.max(2, Math.min(15, Math.ceil(nodeCount / 200)))}
            </Text>
            <Text className="text-[10px] text-gray-500">Communities</Text>
          </div>
        </div>
      </div>
    </div>
  );
}

