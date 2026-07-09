// ============================================
// One Search — Bing/Google-inspired chrome (landing + compact bar)
// Used only from one-search-view.tsx
// ============================================
'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { CSSProperties, Ref } from 'react';
import { Button, Text, Title, Dropdown } from 'rizzui';
import {
  PiArrowLeftBold,
  PiCaretDownBold,
  PiChatCircleDotsBold,
  PiDotsThreeBold,
  PiFileBold,
  PiFolderBold,
  PiFunnelBold,
  PiGraphBold,
  PiImageBold,
  PiSlidersHorizontalBold,
  PiSparkleBold,
  PiSquaresFourBold,
  PiTextAaBold,
  PiVideoBold,
  PiWaveformBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import {
  ONE_SEARCH_SCROLL_BLEED_X,
  ONE_SEARCH_SCROLL_INSET_X,
} from '@/app/shared/one-search/utils/one-search-scroll-padding';
import { routes } from '@/config/routes';
import type { OneSearchMode } from '@/types/one-search.types';
import { type VisualSearchArtifactChip } from './components/visual-search-chip';
import { OneSearchInput } from './components/one-search-input';

export type { VisualSearchArtifactChip };

const MODE_LIST: OneSearchMode[] = ['all', 'text', 'image', 'audio', 'video', 'file'];

const MODE_ICON: Record<OneSearchMode, React.ReactNode> = {
  all: <PiSquaresFourBold className="h-3.5 w-3.5" />,
  text: <PiTextAaBold className="h-3.5 w-3.5" />,
  image: <PiImageBold className="h-3.5 w-3.5" />,
  audio: <PiWaveformBold className="h-3.5 w-3.5" />,
  video: <PiVideoBold className="h-3.5 w-3.5" />,
  file: <PiFileBold className="h-3.5 w-3.5" />,
};

function LandingModeToolbar({
  mode,
  setMode,
  variant,
  onOpenAdvanced,
  onOpenSimple,
}: {
  mode: OneSearchMode;
  setMode: (m: OneSearchMode) => void;
  variant: 'default' | 'advanced';
  onOpenAdvanced: () => void;
  onOpenSimple: () => void;
}) {
  const { t } = useTranslation();

  const shortcutLinks: {
    href: string;
    labelKey: 'navChats' | 'navCases' | 'navFiles' | 'navGraph';
    icon: React.ReactNode;
  }[] = [
    { href: routes.aiChat.root, labelKey: 'navChats', icon: <PiChatCircleDotsBold className="h-4 w-4 text-sky-600" /> },
    { href: routes.cases.list, labelKey: 'navCases', icon: <PiFolderBold className="h-4 w-4 text-violet-600" /> },
    { href: routes.fileExplorer, labelKey: 'navFiles', icon: <PiFileBold className="h-4 w-4 text-amber-600" /> },
    { href: routes.graphExplorer, labelKey: 'navGraph', icon: <PiGraphBold className="h-4 w-4 text-rose-600" /> },
  ];

  return (
    <div
      className="mt-5 flex w-full justify-center border-t border-muted pt-4"
      role="navigation"
      aria-label={t('searchHub.landingModeBarAria')}
    >
      <div className="flex w-full max-w-[720px] flex-wrap items-center justify-center gap-x-1 gap-y-2 sm:gap-x-2">
        {MODE_LIST.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs',
              mode === m
                ? 'border-primary bg-primary text-white shadow-sm'
                : 'border-muted bg-gray-0 text-gray-700 hover:bg-gray-100 dark:bg-gray-50 dark:text-gray-700 dark:hover:bg-gray-100'
            )}
          >
            <span className="opacity-90">{MODE_ICON[m]}</span>
            <span className="whitespace-nowrap">{t(`searchHub.modes.${m}`)}</span>
          </button>
        ))}

        <span className="mx-1 hidden h-5 w-px shrink-0 bg-muted sm:inline" aria-hidden />

        <Dropdown placement="bottom-end">
          <Dropdown.Trigger>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 gap-1 rounded-md border-muted px-3 text-xs font-medium"
              title={t('searchHub.navStubHint')}
            >
              {t('searchHub.navMore')}
              <PiCaretDownBold className="h-3 w-3 opacity-70" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Menu className="min-w-[200px] !z-[100] border border-muted bg-gray-0 shadow-lg dark:bg-gray-50">
            {shortcutLinks.map(({ href, labelKey, icon }) => (
              <Dropdown.Item key={href} className="p-0">
                <Link
                  href={href}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-200/20"
                >
                  {icon}
                  <span className="font-medium">{t(`searchHub.${labelKey}`)}</span>
                </Link>
              </Dropdown.Item>
            ))}
            <Dropdown.Item className="border-t border-muted px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              {t('searchHub.navStubHint')}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <span className="mx-1 hidden h-5 w-px shrink-0 bg-muted sm:inline" aria-hidden />

        <button
          type="button"
          onClick={variant === 'advanced' ? onOpenSimple : onOpenAdvanced}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-muted bg-gray-0 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-100"
          title={variant === 'advanced' ? t('searchHub.backToSimple') : t('searchHub.openAdvanced')}
          aria-label={variant === 'advanced' ? t('searchHub.backToSimple') : t('searchHub.openAdvanced')}
        >
          {variant === 'advanced' ? (
            <PiArrowLeftBold className="h-4 w-4" />
          ) : (
            <PiSlidersHorizontalBold className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export interface OneSearchLandingProps {
  query: string;
  setQuery: (v: string) => void;
  mode: OneSearchMode;
  setMode: (m: OneSearchMode) => void;
  onSubmit: (e: React.FormEvent) => void;
  onQuickSearch: (q: string) => void;
  variant: 'default' | 'advanced';
  onOpenAdvanced: () => void;
  onOpenSimple: () => void;
  mockEnabled: boolean;
  isTempProvider?: boolean;
  isSmartSearchProvider?: boolean;
  onImageUpload?: (file: File) => void;
  imageUploading?: boolean;
  visualArtifact?: VisualSearchArtifactChip | null;
  onClearVisual?: () => void;
  onClearQuery?: () => void;
  voiceSearchEnabled?: boolean;
  onVoiceQuery?: (transcript: string) => void;
}

export function OneSearchLanding(props: OneSearchLandingProps) {
  const {
    query,
    setQuery,
    mode,
    setMode,
    onSubmit,
    onQuickSearch,
    variant,
    onOpenAdvanced,
    onOpenSimple,
    mockEnabled,
    isTempProvider = false,
    onImageUpload,
    imageUploading = false,
    visualArtifact,
    onClearVisual,
    onClearQuery,
    voiceSearchEnabled,
    onVoiceQuery,
  } = props;
  const isSmartSearchProvider = props.isSmartSearchProvider ?? false;
  const { t } = useTranslation();

  return (
    <div className={cn('flex w-full flex-1 flex-col', ONE_SEARCH_SCROLL_BLEED_X)}>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col items-center justify-center pb-20 pt-6 @md:min-h-[min(52vh,560px)] @md:pt-10',
          ONE_SEARCH_SCROLL_INSET_X
        )}
      >
        <div className="mx-auto w-full max-w-[720px]">
          <Title
            as="h1"
            className="mb-7 text-center text-5xl font-light tracking-tight text-gray-800 dark:text-gray-200 @md:mb-8 @md:text-6xl"
          >
            <span className="font-semibold text-primary">{t('searchHub.brandAccent')}</span>
            {t('searchHub.brandRest')}
          </Title>

          <form onSubmit={onSubmit} className="w-full">
            <OneSearchInput
              query={query}
              onQueryChange={setQuery}
              onSubmit={onSubmit}
              variant="landing"
              onImageUpload={onImageUpload}
              imageUploading={imageUploading}
              visualArtifact={visualArtifact}
              onClearVisual={onClearVisual}
              onClearQuery={onClearQuery}
              voiceSearchEnabled={voiceSearchEnabled ?? mode === 'audio'}
              onVoiceQuery={onVoiceQuery}
            />

            <LandingModeToolbar
              mode={mode}
              setMode={setMode}
              variant={variant}
              onOpenAdvanced={onOpenAdvanced}
              onOpenSimple={onOpenSimple}
            />

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Text className="w-full text-center text-xs text-gray-500 dark:text-gray-400">{t('searchHub.quickTry')}</Text>
              <Button type="button" variant="outline" size="sm" className="rounded-md border-dashed" onClick={() => onQuickSearch('احمد')}>
                {t('searchHub.sampleAhmad')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-md border-dashed" onClick={() => onQuickSearch('ahmad')}>
                ahmad
              </Button>
              <Button type="button" variant="outline" size="sm" className="rounded-md border-dashed" onClick={() => onQuickSearch('screen')}>
                screen
              </Button>
            </div>
          </form>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" className="gap-2 rounded-md" type="button" onClick={() => {}} disabled>
              <PiSparkleBold className="h-4 w-4" />
              {t('searchHub.ctaVoiceBundle')}
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-400">
            {isSmartSearchProvider && <span>{t('searchHub.smartSearchBadge')}</span>}
            {isTempProvider && !isSmartSearchProvider && <span>{t('searchHub.tempApiBadge')}</span>}
            {mockEnabled && <span>{t('searchHub.mockSampleBadge')}</span>}
            <span>·</span>
            <span>
              {isSmartSearchProvider
                ? t('searchHub.modesHint')
                : isTempProvider
                  ? t('searchHub.tempApiFootnote')
                  : t('searchHub.heroFootnote')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface OneSearchCompactBarProps {
  query: string;
  setQuery: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  variant: 'default' | 'advanced';
  onOpenAdvanced: () => void;
  onOpenSimple: () => void;
  isFilterOpen?: boolean;
  onToggleFilter?: () => void;
  onImageUpload?: (file: File) => void;
  imageUploading?: boolean;
  visualArtifact?: VisualSearchArtifactChip | null;
  onClearVisual?: () => void;
  onClearQuery?: () => void;
  voiceSearchEnabled?: boolean;
  onVoiceQuery?: (transcript: string) => void;
  barRef?: Ref<HTMLDivElement>;
  pinned?: boolean;
  pinStyle?: CSSProperties;
}

export function OneSearchCompactBar({
  query,
  setQuery,
  onSubmit,
  variant,
  onOpenAdvanced,
  onOpenSimple,
  isFilterOpen,
  onToggleFilter,
  onImageUpload,
  imageUploading = false,
  visualArtifact,
  onClearVisual,
  onClearQuery,
  voiceSearchEnabled,
  onVoiceQuery,
  barRef,
  pinned = false,
  pinStyle,
}: OneSearchCompactBarProps) {
  const { t } = useTranslation();
  return (
    <div
      ref={barRef}
      style={pinned ? pinStyle : undefined}
      className={cn(
        'border-b border-muted bg-gray-0 py-2.5 shadow-sm dark:bg-gray-50',
        !pinned && ONE_SEARCH_SCROLL_BLEED_X,
        pinned ? 'z-[80]' : 'sticky top-0 z-[80]'
      )}
    >
      <div
        className={cn(
          'flex w-full flex-wrap items-center gap-3',
          ONE_SEARCH_SCROLL_INSET_X
        )}
      >
        <div className="hidden shrink-0 items-center gap-1 sm:flex" aria-hidden>
          <span className="text-lg font-semibold text-primary">{t('searchHub.brandAccent')}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-400">{t('searchHub.brandRest')}</span>
        </div>

        <form onSubmit={onSubmit} className="min-w-0 w-full flex-[1_1_12rem] basis-48 sm:basis-64">
          <OneSearchInput
            query={query}
            onQueryChange={setQuery}
            onSubmit={onSubmit}
            variant="compact"
            onImageUpload={onImageUpload}
            imageUploading={imageUploading}
            visualArtifact={visualArtifact}
            onClearVisual={onClearVisual}
            onClearQuery={onClearQuery}
            voiceSearchEnabled={voiceSearchEnabled}
            onVoiceQuery={onVoiceQuery}
          />
        </form>

        <div className="ms-auto flex shrink-0 items-center gap-1.5">
          <Dropdown placement="bottom-end">
            <Dropdown.Trigger>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-200/20"
                title={t('searchHub.moreMenu')}
                aria-label={t('searchHub.moreMenu')}
              >
                <PiDotsThreeBold className="h-5 w-5" />
              </button>
            </Dropdown.Trigger>
            <Dropdown.Menu className="min-w-[200px] !z-[100] border border-muted bg-gray-0 shadow-lg dark:bg-gray-50">
              <Dropdown.Item className="p-0">
                <Link
                  href={routes.aiChat.root}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-200/20"
                >
                  <PiChatCircleDotsBold className="h-4 w-4 text-primary" />
                  <span className="font-medium">{t('searchHub.navChats')}</span>
                </Link>
              </Dropdown.Item>
              <Dropdown.Item className="p-0">
                <Link
                  href={routes.cases.list}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-200/20"
                >
                  <PiFolderBold className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <span className="font-medium">{t('searchHub.navCases')}</span>
                </Link>
              </Dropdown.Item>
              <Dropdown.Item className="p-0">
                <Link
                  href={routes.fileExplorer}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-200/20"
                >
                  <PiFileBold className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-medium">{t('searchHub.navFiles')}</span>
                </Link>
              </Dropdown.Item>
              <Dropdown.Item className="p-0">
                <Link
                  href={routes.graphExplorer}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-200/20"
                >
                  <PiGraphBold className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span className="font-medium">{t('searchHub.navGraph')}</span>
                </Link>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          <Button
            variant={isFilterOpen ? 'solid' : 'outline'}
            size="sm"
            className={cn(
              'gap-1.5 rounded-md',
              isFilterOpen && 'shadow-sm'
            )}
            onClick={onToggleFilter}
            aria-label={t('searchHub.openAdvanced')}
          >
            <PiFunnelBold className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{t('searchHub.openAdvanced')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
