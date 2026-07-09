'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Loader, Text } from 'rizzui';
import { PiMagnifyingGlassBold, PiXBold } from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { messagesService } from '@/services/messages.service';
import type { UserSummary } from '@/types/messages.types';

type RecipientSearchInputProps = {
  id: string;
  label: string;
  value: UserSummary[];
  onChange: (recipients: UserSummary[]) => void;
  placeholder?: string;
  /** User ids already selected in this field or sibling fields */
  excludeIds?: string[];
  /** Current signed-in user — excluded from search results */
  currentUserId?: string;
  /** Allow single selection only (e.g. forward modal) */
  single?: boolean;
  className?: string;
};

function displayName(user: UserSummary) {
  return user.name || user.email || user.id;
}

export default function RecipientSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  excludeIds = [],
  currentUserId,
  single = false,
  className,
}: RecipientSearchInputProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExcluded = useCallback(
    (userId: string) => {
      if (currentUserId && userId === currentUserId) return true;
      if (excludeIds.includes(userId)) return true;
      return value.some((r) => r.id === userId);
    },
    [value, excludeIds, currentUserId]
  );

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setShowDropdown(false);
        setSearchError(null);
        return;
      }
      setIsSearching(true);
      setSearchError(null);
      try {
        const users = await messagesService.searchDirectoryUsers(q, 8);
        const filtered = users.filter((u) => !isExcluded(u.id));
        setResults(filtered);
        setShowDropdown(true);
        if (filtered.length === 0) {
          setSearchError(t('messages.compose.noUsersFound'));
        }
      } catch {
        setResults([]);
        setShowDropdown(true);
        setSearchError(t('messages.compose.userSearchFailed'));
      } finally {
        setIsSearching(false);
      }
    },
    [isExcluded, t]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQueryChange = (next: string) => {
    setQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next), 300);
  };

  const addRecipient = (user: UserSummary) => {
    if (isExcluded(user.id)) return;
    if (single) {
      onChange([user]);
    } else {
      onChange([...value, user]);
    }
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setSearchError(null);
    inputRef.current?.focus();
  };

  const removeRecipient = (userId: string) => {
    onChange(value.filter((r) => r.id !== userId));
  };

  const composeFieldLabelClass =
    'w-16 shrink-0 text-xs font-semibold text-gray-500 transition-all duration-200 group-focus-within:text-sm group-focus-within:text-primary group-focus-within:font-bold dark:text-gray-400';

  const composeFieldInputClass =
    'border-0 bg-transparent outline-none ring-0 caret-primary transition-colors duration-200 focus:outline-none focus:ring-0 focus-visible:outline-none focus:placeholder:text-primary/50 dark:focus:placeholder:text-primary/40';

  return (
    <div ref={containerRef} className={cn('group relative flex min-h-10 items-start gap-3', className)}>
      <label htmlFor={id} className={cn(composeFieldLabelClass, 'mt-2.5')}>
        {label}:
      </label>

      <div className="relative min-w-0 flex-1">
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 py-1">
          {value.map((recipient) => (
            <span
              key={recipient.id}
              className="flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary dark:bg-primary/20"
            >
              <span className="truncate">{displayName(recipient)}</span>
              <button
                type="button"
                onClick={() => removeRecipient(recipient.id)}
                className="shrink-0 rounded-full transition-colors hover:bg-primary/20 dark:hover:bg-primary/30"
                aria-label={t('messages.compose.removeRecipient', { name: displayName(recipient) })}
              >
                <PiXBold className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

          {(!single || value.length === 0) && (
            <div className="relative flex min-w-[140px] flex-1 items-center gap-1.5">
              <PiMagnifyingGlassBold className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                ref={inputRef}
                id={id}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (query.trim().length >= 2 && (results.length > 0 || searchError)) {
                    setShowDropdown(true);
                  }
                }}
                placeholder={placeholder ?? t('messages.compose.searchUsersPlaceholder')}
                className={cn(
                  composeFieldInputClass,
                  'min-w-0 flex-1 text-sm text-gray-900 placeholder:text-gray-400 dark:text-gray-100 dark:placeholder:text-gray-500'
                )}
                autoComplete="off"
              />
              {isSearching && <Loader variant="spinner" size="sm" className="shrink-0" />}
            </div>
          )}
        </div>

        {showDropdown && (results.length > 0 || searchError) && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-muted bg-gray-0 shadow-lg dark:bg-gray-50">
            {searchError && results.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-gray-500">{searchError}</div>
            ) : (
              results.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-gray-100 dark:hover:bg-gray-200/30"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addRecipient(user)}
                >
                  <Avatar name={user.name} src={user.avatar} size="sm" className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Text className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user.name}
                    </Text>
                    <Text className="truncate text-xs text-gray-500">
                      {user.email || user.id}
                    </Text>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
