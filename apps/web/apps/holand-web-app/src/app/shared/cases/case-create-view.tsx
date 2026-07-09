// ============================================
// CaseCreateView — Multi-step case import wizard
// Uses POST /import/review, POST /import/{case_id}/embed, POST /import/{case_id}/store
// ============================================
'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Title,
  Text,
  Button,
  Input,
  Loader,
  Badge,
} from 'rizzui';
import {
  PiFolderPlusDuotone,
  PiMagnifyingGlassBold,
  PiDatabaseBold,
  PiFloppyDiskBold,
  PiCheckCircleBold,
  PiArrowRightBold,
  PiWarningCircleBold,
  PiSpinnerGapBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { gatewayClient } from '@/lib/api-client';
import { routes } from '@/config/routes';

// ==========================================
// Types
// ==========================================

type ImportStep = 'review' | 'embed' | 'store' | 'done';

/** Review response from POST /import/review */
interface ReviewResponse {
  case_id?: string;
  case_name?: string;
  file_count?: number;
  total_size?: number;
  files?: Array<Record<string, unknown>>;
  status?: string;
  [key: string]: unknown;
}

/**
 * CaseCreateView — Multi-step case import wizard.
 *
 * 3-step process:
 * 1. Review — POST /import/review (scan folder, create case)
 * 2. Embed — POST /import/{case_id}/embed (run embeddings)
 * 3. Store — POST /import/{case_id}/store (finalize storage)
 *
 * @requires gatewayClient
 * @version 0.21.0
 */
export default function CaseCreateView() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState<ImportStep>('review');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [folderPath, setFolderPath] = useState('');
  const [caseName, setCaseName] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [groupId, setGroupId] = useState('');

  // Results
  const [caseId, setCaseId] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResponse | null>(null);
  const [embedResult, setEmbedResult] = useState<Record<string, unknown> | null>(null);

  // ==========================================
  // Step Handlers
  // ==========================================

  /**
   * Step 1: Review — scan folder and create case.
   * @endpoint POST /import/review
   */
  const handleReview = useCallback(async () => {
    if (!folderPath.trim() || !caseName.trim()) {
      toast.error(t('cases.create.folderPath') + ' & ' + t('cases.create.caseName') + ' required');
      return;
    }

    console.info('[CaseCreateView] Step 1: Reviewing files:', { folderPath, caseName });
    setLoading(true);
    setError(null);
    try {
      const res = await gatewayClient.post('/import/review', {
        folder_path: folderPath.trim(),
        case_name: caseName.trim(),
        session_id: sessionId.trim() || null,
        group_id: groupId.trim() || null,
        force: false,
      });

      const data = res.data;
      console.info('[CaseCreateView] Review result:', {
        caseId: data?.case_id,
        fileCount: data?.file_count,
      });

      setReviewResult(data);
      setCaseId(data?.case_id);
      setStep('embed');
      toast.success(t('cases.create.step1') + ' ✓');
    } catch (err: unknown) {
      console.error('[CaseCreateView] Review failed:', err);
      const msg = err instanceof Error ? err.message : 'Review failed';
      setError(msg);
      toast.error(t('toast.failedReviewFiles'));
    } finally {
      setLoading(false);
    }
  }, [folderPath, caseName, sessionId, groupId, t]);

  /**
   * Step 2: Embed — run embedding on case files.
   * @endpoint POST /import/{case_id}/embed
   */
  const handleEmbed = useCallback(async () => {
    if (!caseId) return;
    console.info('[CaseCreateView] Step 2: Running embedding:', { caseId });
    setLoading(true);
    setError(null);
    try {
      const res = await gatewayClient.post(`/import/${caseId}/embed`);
      console.info('[CaseCreateView] Embedding result:', res.data);
      setEmbedResult(res.data);
      setStep('store');
      toast.success(t('cases.create.step2') + ' ✓');
    } catch (err: unknown) {
      console.error('[CaseCreateView] Embedding failed:', err);
      setError('Embedding failed');
      toast.error(t('toast.failedRunEmbedding'));
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

  /**
   * Step 3: Store — finalize case storage.
   * @endpoint POST /import/{case_id}/store
   */
  const handleStore = useCallback(async () => {
    if (!caseId) return;
    console.info('[CaseCreateView] Step 3: Storing case:', { caseId });
    setLoading(true);
    setError(null);
    try {
      await gatewayClient.post(`/import/${caseId}/store`);
      console.info('[CaseCreateView] Store successful:', { caseId });
      setStep('done');
      toast.success(t('cases.create.step3') + ' ✓');
    } catch (err: unknown) {
      console.error('[CaseCreateView] Store failed:', err);
      setError('Store failed');
      toast.error(t('toast.failedStoreCase'));
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

  // ==========================================
  // Step Definitions
  // ==========================================

  const steps = [
    {
      key: 'review' as const,
      label: t('cases.create.step1'),
      icon: <PiMagnifyingGlassBold className="h-5 w-5" />,
    },
    {
      key: 'embed' as const,
      label: t('cases.create.step2'),
      icon: <PiDatabaseBold className="h-5 w-5" />,
    },
    {
      key: 'store' as const,
      label: t('cases.create.step3'),
      icon: <PiFloppyDiskBold className="h-5 w-5" />,
    },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // ==========================================
  // Render
  // ==========================================

  return (
    <div className="space-y-6">
      {/* Step Progress */}
      <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
        {steps.map((s, idx) => {
          const isActive = s.key === step;
          const isCompleted = idx < currentStepIndex || step === 'done';
          return (
            <div key={s.key} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-400 dark:bg-gray-200'
                  )}
                >
                  {isCompleted ? (
                    <PiCheckCircleBold className="h-5 w-5" />
                  ) : (
                    s.icon
                  )}
                </div>
                <div className="hidden sm:block">
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      isActive
                        ? 'text-primary'
                        : isCompleted
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-400'
                    )}
                  >
                    {s.label}
                  </Text>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-3 h-0.5 flex-1',
                    idx < currentStepIndex || step === 'done'
                      ? 'bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-300'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <PiWarningCircleBold className="h-5 w-5 text-red-500" />
          <Text className="text-sm text-red-700 dark:text-red-300">{error}</Text>
        </div>
      )}

      {/* Step Content */}
      <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        {step === 'review' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <PiFolderPlusDuotone className="h-7 w-7 text-primary" />
              <div>
                <Title as="h5" className="font-semibold">
                  {t('cases.create.step1')}
                </Title>
                <Text className="text-sm text-gray-500">
                  {t('cases.create.description')}
                </Text>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label={t('cases.create.folderPath')}
                placeholder={t('cases.create.folderPathPlaceholder')}
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                className="col-span-full"
              />
              <Input
                label={t('cases.create.caseName')}
                placeholder={t('cases.create.caseNamePlaceholder')}
                value={caseName}
                onChange={(e) => setCaseName(e.target.value)}
              />
              <Input
                label={t('cases.create.sessionId')}
                placeholder="Optional"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
              <Input
                label={t('cases.create.groupId')}
                placeholder="Optional"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
              />
            </div>

            <Button
              onClick={handleReview}
              isLoading={loading}
              disabled={!folderPath.trim() || !caseName.trim()}
              className="gap-1.5"
            >
              {t('cases.create.reviewFiles')}
              <PiArrowRightBold className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'embed' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <PiDatabaseBold className="h-7 w-7 text-primary" />
              <div>
                <Title as="h5" className="font-semibold">
                  {t('cases.create.step2')}
                </Title>
                <Text className="text-sm text-gray-500">
                  {t('cases.create.runEmbedding')}
                </Text>
              </div>
            </div>

            {/* Review Summary */}
            {reviewResult && (
              <div className="rounded-lg border border-muted bg-gray-100 p-4 dark:bg-gray-200/50">
                <Text className="mb-2 text-sm font-medium">
                  {t('cases.create.step1')} {t('common.completed')}:
                </Text>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Text className="text-gray-500">{t('cases.detail.caseName')}:</Text>
                  <Text className="font-medium">{reviewResult.case_name}</Text>
                  <Text className="text-gray-500">{t('cases.detail.fileCount')}:</Text>
                  <Text className="font-medium">{reviewResult.file_count ?? '—'}</Text>
                  <Text className="text-gray-500">{t('cases.detail.caseId')}:</Text>
                  <Text className="font-mono text-xs">{reviewResult.case_id}</Text>
                </div>
              </div>
            )}

            <Button onClick={handleEmbed} isLoading={loading} className="gap-1.5">
              {t('cases.create.runEmbedding')}
              <PiArrowRightBold className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'store' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <PiFloppyDiskBold className="h-7 w-7 text-primary" />
              <div>
                <Title as="h5" className="font-semibold">
                  {t('cases.create.step3')}
                </Title>
                <Text className="text-sm text-gray-500">
                  {t('cases.create.storeData')}
                </Text>
              </div>
            </div>

            {embedResult && (
              <div className="rounded-lg border border-muted bg-gray-100 p-4 dark:bg-gray-200/50">
                <Text className="mb-2 text-sm font-medium">
                  {t('cases.create.step2')} {t('common.completed')}
                </Text>
                <Badge variant="flat" color="success">
                  {t('common.success')}
                </Badge>
              </div>
            )}

            <Button onClick={handleStore} isLoading={loading} className="gap-1.5">
              {t('cases.create.storeData')}
              <PiArrowRightBold className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5 text-center">
            <PiCheckCircleBold className="mx-auto h-16 w-16 text-green-500" />
            <Title as="h4" className="text-green-600 dark:text-green-400">
              {t('common.success')}!
            </Title>
            <Text className="text-gray-500">
              Case &quot;{reviewResult?.case_name}&quot; has been imported successfully.
            </Text>
            <div className="flex items-center justify-center gap-3">
              {caseId && (
                <Button
                  onClick={() => router.push(routes.cases.detail(caseId))}
                  className="gap-1.5"
                >
                  {t('common.viewDetails')}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => router.push(routes.cases.list)}
              >
                {t('cases.list.title')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
