// ============================================
// ShareSessionModal — Share a chat conversation
// Public link + share with specific users (tabs)
// ============================================

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  PiShareNetwork,
  PiCopy,
  PiCheck,
  PiX,
  PiLockKey,
  PiWarning,
  PiLink,
  PiClock,
  PiArrowClockwise,
  PiUsers,
  PiMagnifyingGlass,
  PiUserPlus,
} from 'react-icons/pi';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import { chatService } from '@/services/chat.service';
import { messagesService } from '@/services/messages.service';
import { openChatDevRequirementsPanel } from '@/app/shared/ai-chat/components/chat-dev-requirements-panel';
import type {
  SessionShareRecipient,
  ShareExpiryHours,
  ShareSessionResponse,
} from '@/types/chat.types';
import type { UserSummary } from '@/types/messages.types';

interface ShareSessionModalProps {
  sessionId: string;
  sessionTitle?: string;
  onClose: () => void;
  /** Called after successful people share so sidebar can refresh */
  onSharedWithUsers?: () => void;
}

type ShareTab = 'public' | 'people';

/** Compact chip labels map to `expires_hours` sent to POST .../share */
const EXPIRY_OPTIONS: { value: ShareExpiryHours; label: string; ariaKey: string }[] = [
  { value: 1, label: '1H', ariaKey: 'expiry1h' },
  { value: 24, label: '1D', ariaKey: 'expiry1d' },
  { value: 72, label: '3D', ariaKey: 'expiry3d' },
  { value: 168, label: '1W', ariaKey: 'expiry1w' },
  { value: 720, label: '1M', ariaKey: 'expiry1m' },
  { value: 0, label: '∞', ariaKey: 'neverExpires' },
];

function formatExpiry(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return isoDate;
  }
}

function isNeverExpires(hours: ShareExpiryHours): boolean {
  return hours === 0 || hours === null;
}

function isShareApiMissing(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 501 || status === 405;
}

export default function ShareSessionModal({
  sessionId,
  sessionTitle,
  onClose,
  onSharedWithUsers,
}: ShareSessionModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ShareTab>('public');
  const [expiresHours, setExpiresHours] = useState<ShareExpiryHours>(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareResult, setShareResult] = useState<ShareSessionResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<UserSummary[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserSummary[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isSharingUsers, setIsSharingUsers] = useState(false);
  const [peopleApiMissing, setPeopleApiMissing] = useState(false);
  const [recipients, setRecipients] = useState<SessionShareRecipient[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userSearchRef = useRef<HTMLDivElement>(null);

  const expiryLabel = (value: ShareExpiryHours): string => {
    const opt = EXPIRY_OPTIONS.find((o) => o.value === value);
    if (opt) return opt.label;
    if (isNeverExpires(value)) return '∞';
    return `${value}H`;
  };

  const loadRecipients = useCallback(async () => {
    setIsLoadingRecipients(true);
    try {
      const list = await chatService.listSessionShares(sessionId);
      setRecipients(list);
      setPeopleApiMissing(false);
    } catch {
      setRecipients([]);
      setPeopleApiMissing(true);
      toast.error(t('shareModal.loadRecipientsFailed'));
    } finally {
      setIsLoadingRecipients(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (activeTab === 'people') {
      void loadRecipients();
    }
  }, [activeTab, loadRecipients]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userSearchRef.current && !userSearchRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const runUserSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setUserResults([]);
        setShowUserDropdown(false);
        return;
      }
      setIsSearchingUsers(true);
      try {
        const users = await messagesService.searchDirectoryUsers(q, 8);
        const filtered = users.filter(
          (u) => !selectedUsers.some((s) => s.id === u.id)
        );
        setUserResults(filtered);
        setShowUserDropdown(true);
      } catch {
        setUserResults([]);
        setShowUserDropdown(true);
      } finally {
        setIsSearchingUsers(false);
      }
    },
    [selectedUsers]
  );

  const handleUserQueryChange = (next: string) => {
    setUserQuery(next);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => void runUserSearch(next), 300);
  };

  const addUser = (user: UserSummary) => {
    setSelectedUsers((prev) => [...prev, user]);
    setUserQuery('');
    setUserResults([]);
    setShowUserDropdown(false);
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await chatService.shareSession(sessionId, expiresHours);
      setShareResult(result);
    } catch {
      toast.error(t('shareModal.errorGenerate'));
    } finally {
      setIsGenerating(false);
    }
  }, [sessionId, expiresHours, t]);

  const handleRegenerate = useCallback(async () => {
    setShareResult(null);
    await handleGenerate();
  }, [handleGenerate]);

  const handleCopy = useCallback(async () => {
    if (!shareResult?.share_url) return;
    try {
      await navigator.clipboard.writeText(shareResult.share_url);
      setCopied(true);
      toast.success(t('shareModal.successCopy'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('shareModal.errorCopy'));
    }
  }, [shareResult?.share_url, t]);

  const handleShareWithUsers = useCallback(async () => {
    if (selectedUsers.length === 0) return;
    setIsSharingUsers(true);
    try {
      await chatService.shareSessionWithUsers(sessionId, {
        recipient_user_ids: selectedUsers.map((u) => u.id),
        permission: 'read',
      });
      toast.success(t('shareModal.shareSuccess'));
      setSelectedUsers([]);
      setPeopleApiMissing(false);
      await loadRecipients();
      onSharedWithUsers?.();
    } catch (error: unknown) {
      if (isShareApiMissing(error)) {
        setPeopleApiMissing(true);
      }
      toast.error(t('shareModal.shareFailed'));
    } finally {
      setIsSharingUsers(false);
    }
  }, [selectedUsers, sessionId, t, loadRecipients, onSharedWithUsers]);

  const handleRevoke = useCallback(
    async (userId: string) => {
      setRevokingUserId(userId);
      try {
        await chatService.revokeSessionShare(sessionId, userId);
        toast.success(t('shareModal.revokeSuccess'));
        setRecipients((prev) => prev.filter((r) => r.user_id !== userId));
        onSharedWithUsers?.();
      } catch (error: unknown) {
        if (isShareApiMissing(error)) {
          setPeopleApiMissing(true);
        }
        toast.error(t('shareModal.revokeFailed'));
      } finally {
        setRevokingUserId(null);
      }
    },
    [sessionId, t, onSharedWithUsers]
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-gray-0 shadow-2xl dark:bg-gray-50">
          <div className="flex items-center justify-between border-b border-muted px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <PiShareNetwork className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2
                  id="share-modal-title"
                  className="text-sm font-semibold text-gray-900 dark:text-gray-700"
                >
                  {t('shareModal.title')}
                </h2>
                {sessionTitle && (
                  <p className="max-w-[240px] truncate text-xs text-gray-500 dark:text-gray-400">
                    {sessionTitle}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/30"
              aria-label={t('shareModal.close')}
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-muted px-6">
            <div className="flex gap-1">
              {(['public', 'people'] as ShareTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors',
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  )}
                >
                  {tab === 'public' ? (
                    <PiLink className="h-3.5 w-3.5" />
                  ) : (
                    <PiUsers className="h-3.5 w-3.5" />
                  )}
                  {tab === 'public' ? t('shareModal.tabPublic') : t('shareModal.tabPeople')}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
            {activeTab === 'public' ? (
              <>
                <div className="flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3.5 dark:border-orange-800 dark:bg-orange-950/30">
                  <PiWarning className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-500" />
                  <div className="text-xs text-orange-700 dark:text-orange-300 space-y-0.5">
                    <p className="font-medium">{t('shareModal.linkTitle')}</p>
                    <p>{t('shareModal.linkDesc')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <PiClock className="h-3.5 w-3.5" />
                    {t('shareModal.expiresLabel')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {EXPIRY_OPTIONS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => {
                          setExpiresHours(opt.value);
                          if (shareResult) setShareResult(null);
                        }}
                        className={cn(
                          'min-w-[2.25rem] rounded-lg px-2.5 py-1.5 text-xs font-semibold tabular-nums transition-colors',
                          expiresHours === opt.value
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-200/30 dark:text-gray-400 dark:hover:bg-gray-200/50'
                        )}
                        aria-pressed={expiresHours === opt.value}
                        aria-label={t(`shareModal.${opt.ariaKey}`)}
                        title={t(`shareModal.${opt.ariaKey}`)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {shareResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl border border-muted bg-gray-50 p-2 dark:bg-gray-100">
                      <PiLink className="ms-1.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="flex-1 truncate text-xs text-gray-600 dark:text-gray-300">
                        {shareResult.share_url}
                      </span>
                      <button
                        onClick={handleCopy}
                        className={cn(
                          'flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                          copied
                            ? 'bg-green-500 text-white'
                            : 'bg-primary text-white hover:bg-primary/90'
                        )}
                        aria-label={t('shareModal.copyAria')}
                      >
                        {copied ? (
                          <PiCheck className="h-3.5 w-3.5" />
                        ) : (
                          <PiCopy className="h-3.5 w-3.5" />
                        )}
                        {copied ? t('shareModal.copied') : t('shareModal.copy')}
                      </button>
                    </div>

                    {shareResult.expires_at ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <PiClock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>
                          {t('shareModal.expiresOn')}{' '}
                          <span className="font-medium text-gray-600 dark:text-gray-400">
                            {formatExpiry(shareResult.expires_at)}
                          </span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <PiClock className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium text-gray-600 dark:text-gray-400">
                          {t('shareModal.noExpiration')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                      <PiLockKey className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>{t('shareModal.readOnly')}</span>
                    </div>

                    <button
                      onClick={handleRegenerate}
                      disabled={isGenerating}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted py-2 text-xs text-gray-400 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 dark:text-gray-500"
                    >
                      <PiArrowClockwise
                        className={cn('h-3.5 w-3.5', isGenerating && 'animate-spin')}
                      />
                      {t('shareModal.regenerate', { label: expiryLabel(expiresHours) })}
                    </button>
                  </div>
                ) : (
                  <Button
                    onClick={handleGenerate}
                    isLoading={isGenerating}
                    disabled={isGenerating}
                    className="w-full"
                    size="sm"
                  >
                    <PiLink className="me-2 h-4 w-4" />
                    {isGenerating ? t('shareModal.generating') : t('shareModal.generate')}
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t('shareModal.peopleTitle')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('shareModal.peopleDesc')}
                  </p>
                </div>

                {peopleApiMissing && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      {t('shareModal.pendingBackend')}
                    </p>
                    <button
                      type="button"
                      onClick={() => openChatDevRequirementsPanel()}
                      className="mt-2 text-xs font-medium text-primary hover:underline"
                    >
                      {t('shareModal.openDevChecklist')}
                    </button>
                  </div>
                )}

                <div ref={userSearchRef} className="relative space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                    <PiUserPlus className="h-3.5 w-3.5" />
                    {t('shareModal.shareWithUsers')}
                  </label>
                  {selectedUsers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedUsers.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                        >
                          {user.name || user.email || user.id}
                          <button
                            type="button"
                            onClick={() => removeUser(user.id)}
                            className="rounded-full p-0.5 hover:bg-primary/20"
                            aria-label={t('shareModal.close')}
                          >
                            <PiX className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <PiMagnifyingGlass className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={userQuery}
                      onChange={(e) => handleUserQueryChange(e.target.value)}
                      placeholder={t('shareModal.searchUsersPlaceholder')}
                      className="w-full rounded-lg border border-muted bg-gray-0 py-2 ps-9 pe-3 text-xs text-gray-700 outline-none focus:border-primary dark:bg-gray-100 dark:text-gray-300"
                    />
                  </div>
                  {showUserDropdown && (
                    <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-muted bg-gray-0 shadow-lg dark:bg-gray-50">
                      {isSearchingUsers ? (
                        <li className="px-3 py-2 text-xs text-gray-400">{t('shareModal.sharing')}</li>
                      ) : userResults.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-gray-400">
                          {t('shareModal.noUsersFound')}
                        </li>
                      ) : (
                        userResults.map((user) => (
                          <li key={user.id}>
                            <button
                              type="button"
                              onClick={() => addUser(user)}
                              className="w-full px-3 py-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-200/30"
                            >
                              <span className="font-medium text-gray-800 dark:text-gray-200">
                                {user.name || user.email}
                              </span>
                              {user.email && user.name && (
                                <span className="ms-1 text-gray-400">{user.email}</span>
                              )}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>

                <Button
                  onClick={handleShareWithUsers}
                  isLoading={isSharingUsers}
                  disabled={isSharingUsers || selectedUsers.length === 0}
                  className="w-full"
                  size="sm"
                >
                  <PiUsers className="me-2 h-4 w-4" />
                  {isSharingUsers ? t('shareModal.sharing') : t('shareModal.shareWithUsers')}
                </Button>

                <div className="space-y-2 border-t border-muted pt-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t('shareModal.currentRecipients')}
                  </p>
                  {isLoadingRecipients ? (
                    <p className="text-xs text-gray-400">{t('shareModal.sharing')}</p>
                  ) : recipients.length === 0 ? (
                    <p className="text-xs text-gray-400">{t('shareModal.noRecipients')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {recipients.map((r) => (
                        <li
                          key={r.user_id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-100/50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                              {r.display_name || r.email || r.user_id}
                            </p>
                            {r.email && r.display_name && (
                              <p className="truncate text-[10px] text-gray-400">{r.email}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRevoke(r.user_id)}
                            disabled={revokingUserId === r.user_id}
                            className="shrink-0 text-[10px] font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {t('shareModal.revokeAccess')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
