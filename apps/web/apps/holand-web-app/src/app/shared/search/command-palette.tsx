'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ActionIcon,
  Empty,
  Input,
  SearchNotFoundIcon,
  Title,
  cn,
} from 'rizzui';
import {
  PiFileTextDuotone,
  PiMagnifyingGlassBold,
  PiSparkleBold,
  PiXBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import {
  requestNativeAiChatOpen,
  resolveNativeAiChatSurface,
} from '@/app/shared/native-ai-chat/native-ai-chat-bridge';
import { SUPPORT_USER_ID } from '@/app/shared/bug-reporter/config/support-config';
import { useBugReporter } from '@/app/shared/bug-reporter/context/bug-reporter-context';
import { usePermissions } from '@/hooks/use-permissions';
import { isNavHrefAllowed } from '@/config/nav-section-routes';
import {
  commandPaletteEntries,
  commandPaletteQuickActions,
  type CommandPaletteEntry,
} from './command-palette-pages';
import CommandPaletteOneSearch, {
  resolveOneSearchEnterHref,
} from './command-palette-one-search';

function matchesQuery(label: string, query: string, keywords: string[] = []): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (label.toLowerCase().includes(q)) return true;
  return keywords.some((k) => k.toLowerCase().includes(q));
}

export default function CommandPalette({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const { isEnabled, toggleCapture } = useBugReporter();
  const { allowedSections, user } = usePermissions();
  const surface = resolveNativeAiChatSurface(pathname ?? '/');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredPages = useMemo(() => {
    const result: CommandPaletteEntry[] = [];
    let currentSection: CommandPaletteEntry | null = null;
    const pagesInSection: Extract<CommandPaletteEntry, { type: 'page' }>[] = [];

    const flushSection = () => {
      if (currentSection && pagesInSection.length > 0) {
        result.push(currentSection);
        result.push(...pagesInSection);
      }
      pagesInSection.length = 0;
    };

    for (const entry of commandPaletteEntries) {
      if (entry.type === 'section') {
        flushSection();
        currentSection = entry;
        continue;
      }
      if (!isNavHrefAllowed(entry.href, allowedSections, user?.isSuperAdmin)) {
        continue;
      }
      const label = t(entry.nameKey);
      if (matchesQuery(label, searchText, entry.keywords)) {
        pagesInSection.push(entry);
      }
    }
    flushSection();
    return result;
  }, [searchText, t, allowedSections, user?.isSuperAdmin]);

  const filteredQuickActions = useMemo(() => {
    return commandPaletteQuickActions.filter((action) => {
      const label = t(action.nameKey);
      const hint = t(action.hintKey);
      return matchesQuery(`${label} ${hint}`, searchText);
    });
  }, [searchText, t]);

  const firstPageHref = useMemo(() => {
    const first = filteredPages.find((e) => e.type === 'page');
    return first?.type === 'page' ? first.href : null;
  }, [filteredPages]);

  const runQuickAction = useCallback(
    (id: string) => {
      onClose?.();
      switch (id) {
        case 'ai':
          requestNativeAiChatOpen(surface);
          break;
        case 'support':
          router.push(routes.messagesPeopleChat(SUPPORT_USER_ID));
          break;
        case 'bug':
          if (isEnabled) void toggleCapture();
          break;
        default:
          break;
      }
    },
    [isEnabled, onClose, router, surface, toggleCapture]
  );

  const handleEnter = useCallback(() => {
    const q = searchText.trim();
    if (q.length > 0) {
      onClose?.();
      router.push(resolveOneSearchEnterHref(q));
      return;
    }
    if (firstPageHref) {
      onClose?.();
      router.push(firstPageHref);
    }
  }, [firstPageHref, onClose, router, searchText]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        if (target?.closest('[data-command-palette-root]')) {
          e.preventDefault();
          handleEnter();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleEnter]);

  const showOneSearch = true;

  return (
    <div data-command-palette-root>
      <div className="flex items-center px-5 py-4">
        <Input
          variant="flat"
          value={searchText}
          ref={inputRef}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={t('commandPalette.placeholderUnified')}
          className="flex-1"
          prefix={<PiMagnifyingGlassBold className="h-[18px] w-[18px] text-gray-600" />}
        />
        <ActionIcon
          variant="text"
          size="sm"
          className="ms-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <PiXBold className="h-5 w-5" />
        </ActionIcon>
      </div>

      <div className="custom-scrollbar max-h-[60vh] overflow-y-auto border-t border-gray-300 px-2 py-3">
        {filteredQuickActions.length > 0 && (
          <>
            <Title
              as="h6"
              className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500"
            >
              {t('commandPalette.quickActions')}
            </Title>
            {filteredQuickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.id === 'bug' && !isEnabled}
                onClick={() => runQuickAction(action.id)}
                className={cn(
                  'relative my-0.5 flex w-full items-center rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100 dark:hover:bg-gray-50/50',
                  action.id === 'bug' && !isEnabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <span className="inline-flex items-center justify-center rounded-md border border-gray-300 p-2 text-gray-500">
                  <PiSparkleBold className="h-5 w-5" />
                </span>
                <span className="ms-3 grid gap-0.5 text-start">
                  <span className="font-medium text-gray-900 dark:text-gray-700">
                    {t(action.nameKey)}
                  </span>
                  <span className="text-xs text-gray-500">{t(action.hintKey)}</span>
                </span>
              </button>
            ))}
          </>
        )}

        {showOneSearch ? (
          <>
            <Title
              as="h6"
              className="mb-1 mt-3 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500"
            >
              {t('commandPalette.tabs.oneSearch')}
            </Title>
            <CommandPaletteOneSearch query={searchText} onClose={onClose} />
          </>
        ) : null}

        {filteredPages.length > 0 && (
          <>
            <Title
              as="h6"
              className="mb-1 mt-3 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500"
            >
              {t('commandPalette.tabs.pages')}
            </Title>
            {filteredPages.map((item, index) => (
              <Fragment key={`${item.type}-${index}-${'nameKey' in item ? item.nameKey : ''}`}>
                {item.type === 'page' ? (
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className="relative my-0.5 flex items-center rounded-lg px-3 py-2 text-sm hover:bg-gray-100 focus:outline-none focus-visible:bg-gray-100 dark:hover:bg-gray-50/50"
                  >
                    <span className="inline-flex items-center justify-center rounded-md border border-gray-300 p-2 text-gray-500">
                      <PiFileTextDuotone className="h-5 w-5" />
                    </span>
                    <span className="ms-3 grid gap-0.5">
                      <span className="font-medium text-gray-900 dark:text-gray-700">
                        {t(item.nameKey)}
                      </span>
                      <span className="text-xs text-gray-500">{item.href}</span>
                    </span>
                  </Link>
                ) : (
                  <Title
                    as="h6"
                    className={cn(
                      'mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-gray-500',
                      index !== 0 && 'mt-4'
                    )}
                  >
                    {t(item.nameKey)}
                  </Title>
                )}
              </Fragment>
            ))}
          </>
        )}

        {filteredPages.length === 0 &&
        filteredQuickActions.length === 0 &&
        !showOneSearch ? (
          <Empty
            className="scale-75"
            image={<SearchNotFoundIcon />}
            text={t('commandPalette.noResults')}
            textClassName="text-xl"
          />
        ) : null}
      </div>
    </div>
  );
}
