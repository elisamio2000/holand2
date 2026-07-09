// ============================================
// OcrRenderer — کامپوننت اصلی OCR
//
// این کامپوننت PluginUIProps را پیاده می‌کند و
// همه sub-components را ترکیب می‌کند:
//   OcrDropzone → OcrEnginePanel → [Run] → OcrResultPanel + OcrBboxCanvas + OcrWordsTable
// ============================================
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button, Title, Text, Switch } from 'rizzui';
import {
  PiScanBold,
  PiArrowCounterClockwiseBold,
  PiEyeBold,
  PiEyeSlashBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import type { PluginUIProps, TempUploadedFile } from '../../plugin-ui-types';
import type { OcrResultData, OcrEngineKey, OcrUserSettings } from './ocr-types';
import OcrDropzone from './ocr-dropzone';
import OcrEnginePanel from './ocr-engine-panel';
import OcrResultPanel from './ocr-result-panel';
import OcrBboxCanvas from './ocr-bbox-canvas';
import OcrWordsTable from './ocr-words-table';

// ==========================================
// Empty engines fallback
// ==========================================

const DEFAULT_ENGINES = {
  rapidocr: {
    name: 'rapidocr',
    display_name: 'RapidOCR',
    status: 'available' as const,
    speed_rank: 1,
    accuracy_rank: 3,
    languages: ['fa', 'en'],
    error: null,
  },
  easyocr: {
    name: 'easyocr',
    display_name: 'EasyOCR',
    status: 'available' as const,
    speed_rank: 3,
    accuracy_rank: 1,
    languages: ['fa', 'en'],
    error: null,
  },
  tesseract: {
    name: 'tesseract',
    display_name: 'Tesseract',
    status: 'available' as const,
    speed_rank: 2,
    accuracy_rank: 2,
    languages: ['fa', 'en'],
    error: null,
  },
};

// ==========================================
// Main Component
// ==========================================

export default function OcrRenderer({
  result,
  isRunning,
  readOnly = false,
  onRun,
  onSendToChat,
  onCopy,
  className,
}: PluginUIProps) {
  // ------------------------------------------
  // State
  // ------------------------------------------
  const [uploadedFile, setUploadedFile] = useState<TempUploadedFile | null>(null);
  const [settings, setSettings] = useState<OcrUserSettings>({
    engine: null,
    languages: ['fa', 'en'],
  });
  const [showBboxOverlay, setShowBboxOverlay] = useState(true);
  const [imageDimensions, setImageDimensions] = useState({ w: 0, h: 0 });

  // Parse result.data into OcrResultData
  const ocrData: OcrResultData | null =
    result?.data && typeof result.data === 'object'
      ? (result.data as unknown as OcrResultData)
      : null;

  // Engines from result or fallback
  const engines = ocrData?.engines_available ?? DEFAULT_ENGINES;

  // ------------------------------------------
  // Load image dimensions on file change
  // ------------------------------------------

  useEffect(() => {
    if (!uploadedFile?.previewUrl) return;
    const img = new Image();
    img.onload = () =>
      setImageDimensions({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = uploadedFile.previewUrl;
  }, [uploadedFile?.previewUrl]);

  // ------------------------------------------
  // Run handler
  // ------------------------------------------

  const handleRun = useCallback(() => {
    if (!uploadedFile || isRunning) return;

    const params: Record<string, unknown> = {
      path: uploadedFile.tempPath,
      languages: settings.languages,
    };

    // engine vs strategy
    if (settings.engine === 'speed' || settings.engine === 'accuracy') {
      params.strategy = settings.engine;
    } else if (settings.engine) {
      params.engine = settings.engine;
    }

    onRun(params);
  }, [uploadedFile, isRunning, settings, onRun]);

  // ------------------------------------------
  // Render
  // ------------------------------------------

  const hasWords = (ocrData?.words ?? []).length > 0;
  const canRun = !!uploadedFile && !isRunning && !readOnly;

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6',
        className
      )}
    >
      {/* ======================================
          بخش بالا: Dropzone + Engine Panel
      ====================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        {/* Dropzone */}
        <div className="space-y-3">
          <Title as="h5" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            انتخاب تصویر
          </Title>
          <OcrDropzone
            uploadedFile={uploadedFile}
            onFileReady={setUploadedFile}
            onFileRemove={() => {
              setUploadedFile(null);
              setImageDimensions({ w: 0, h: 0 });
            }}
            disabled={isRunning || readOnly}
          />
        </div>

        {/* Engine Panel */}
        <div className="space-y-3">
          <Title as="h5" className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            تنظیمات
          </Title>
          <OcrEnginePanel
            engines={engines}
            selectedEngine={settings.engine}
            selectedLanguages={settings.languages}
            onSelectEngine={(engine: OcrEngineKey) =>
              setSettings((s) => ({ ...s, engine }))
            }
            onSelectLanguages={(langs) =>
              setSettings((s) => ({ ...s, languages: langs }))
            }
            disabled={isRunning || readOnly}
          />
        </div>
      </div>

      {/* ======================================
          Run Button
      ====================================== */}
      {!readOnly && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {uploadedFile ? (
              <span className="font-medium text-gray-600 dark:text-gray-300">
                {uploadedFile.originalName}
              </span>
            ) : (
              <span>ابتدا تصویر انتخاب کنید</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {ocrData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setUploadedFile(null);
                  setImageDimensions({ w: 0, h: 0 });
                }}
                className="h-9 gap-1.5 text-sm text-gray-500"
              >
                <PiArrowCounterClockwiseBold className="h-4 w-4" />
                شروع مجدد
              </Button>
            )}

            <Button
              size="md"
              disabled={!canRun}
              onClick={handleRun}
              isLoading={isRunning}
              className="h-9 gap-2 bg-primary text-white hover:bg-primary/90"
            >
              {!isRunning && <PiScanBold className="h-4 w-4" />}
              {isRunning ? 'در حال پردازش...' : 'اجرای OCR'}
            </Button>
          </div>
        </div>
      )}

      {/* ======================================
          نتایج
      ====================================== */}
      {(ocrData || isRunning) && (
        <div className="space-y-4">
          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-muted" />
            <Text className="text-xs font-medium text-gray-400">نتیجه</Text>
            <div className="h-px flex-1 bg-muted" />
          </div>

          {/* Image + BBox canvas + Result Panel */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Image with BBox */}
            {uploadedFile?.previewUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    تصویر
                  </Text>
                  {hasWords && (
                    <div className="flex items-center gap-1.5">
                      <Text className="text-[11px] text-gray-400">Bbox</Text>
                      <Switch
                        size="sm"
                        checked={showBboxOverlay}
                        onChange={(e) => setShowBboxOverlay(e.target.checked)}
                      />
                      {showBboxOverlay ? (
                        <PiEyeBold className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <PiEyeSlashBold className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </div>
                  )}
                </div>

                <OcrBboxCanvas
                  imageSrc={uploadedFile.previewUrl}
                  imageNaturalWidth={imageDimensions.w}
                  imageNaturalHeight={imageDimensions.h}
                  words={ocrData?.words ?? []}
                  enabled={showBboxOverlay && hasWords}
                  className="rounded-xl shadow-sm"
                />
              </div>
            )}

            {/* Result Panel */}
            <OcrResultPanel
              data={ocrData}
              isRunning={isRunning}
              readOnly={readOnly}
              onSendToChat={onSendToChat}
              onCopy={onCopy}
            />
          </div>

          {/* Words Table */}
          {hasWords && (
            <OcrWordsTable words={ocrData!.words} maxRows={100} />
          )}
        </div>
      )}
    </div>
  );
}
