'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { Button, Input, Select, Text, ActionIcon, Loader, Empty } from 'rizzui';
import {
  PiTrashBold,
  PiPlusBold,
  PiMagnifyingGlassBold,
} from 'react-icons/pi';
import { adminService } from '@/services/admin.service';
import WorkspaceModulePicker from '@/app/shared/workspace/components/workspace-module-picker';
import WorkspaceCasePicker from '@/app/shared/workspace/components/workspace-case-picker';
import WorkspaceFilePicker from '@/app/shared/workspace/components/workspace-file-picker';
import { workspaceService } from '@/services/workspace.service';
import { useConfirmDialog } from '@/app/shared/file-explorer/confirm-dialog';
import UserAvatar from '@/components/user-avatar';
import WorkspaceRoleBadge from '@/app/shared/workspace/components/workspace-role-badge';
import {
  WORKSPACE_ROLE_OPTIONS,
  type WorkspaceAssignableRole,
} from '@/app/shared/workspace/config/workspace-roles';
import {
  getCachedResourceName,
  setCachedResourceName,
  setCachedResourceNames,
  type WorkspaceResourceKind,
} from '@/lib/workspace-resource-names';
import type { MembershipResponse, UserResponse } from '@/types/auth.types';
import { useTranslation } from 'react-i18next';

export interface WorkspaceMembersTabProps {
  workspaceId: string;
  /** Show email invite button (Phase 3) */
  onInviteByEmail?: () => void;
}

export function WorkspaceMembersTab({
  workspaceId,
  onInviteByEmail,
}: WorkspaceMembersTabProps) {
  const { t } = useTranslation();
  const { update: updateSession } = useSession();
  const confirm = useConfirmDialog();
  const [members, setMembers] = useState<MembershipResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<WorkspaceAssignableRole>('user');
  const [adding, setAdding] = useState(false);
  const [usernameMap, setUsernameMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleOptions = useMemo(
    () => WORKSPACE_ROLE_OPTIONS.map((r) => ({ value: r.value, label: t(r.labelKey) })),
    [t]
  );
  const roleDescription = (value: string) =>
    WORKSPACE_ROLE_OPTIONS.find((r) => r.value === value)?.descriptionKey;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workspaceService.listMembers(workspaceId);
      setMembers(data);
      const userIds = data.map((m) => m.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const names = await adminService.resolveUsernames(userIds);
        setUsernameMap((prev) => ({ ...prev, ...names }));
      }
    } catch {
      toast.error(t('groupDetail.loadMembersError'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSelectedUserId('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await adminService.searchUsers(query, 8);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectUser = (user: UserResponse) => {
    setSelectedUserId(user.id);
    setSearchQuery(`${user.username} (${user.email || user.id.slice(0, 8)})`);
    setShowDropdown(false);
  };

  const handleAdd = async () => {
    // Require an explicit pick from search results — no raw-text fallback,
    // so a mistyped/unresolved query can never be sent as a user_id.
    if (!selectedUserId) return;
    setAdding(true);
    try {
      await workspaceService.addMember(workspaceId, { user_id: selectedUserId, role_name: role });
      toast.success(t('groupDetail.memberAdded'));
      setSearchQuery('');
      setSelectedUserId('');
      await updateSession();
      fetchMembers();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || t('groupDetail.addMemberError'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    const confirmed = await confirm({
      title: t('workspace.members.removeTitle'),
      message: t('workspace.members.removeConfirm'),
      confirmLabel: t('workspace.members.removeAction'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await workspaceService.removeMember(workspaceId, userId);
      toast.success(t('groupDetail.memberRemoved'));
      await updateSession();
      fetchMembers();
    } catch {
      toast.error(t('groupDetail.removeMemberError'));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await workspaceService.updateMemberRole(workspaceId, userId, newRole);
      toast.success(t('groupDetail.roleUpdated'));
      await updateSession();
      fetchMembers();
    } catch {
      toast.error(t('groupDetail.updateRoleError'));
    }
  };

  if (loading) return <Loader variant="spinner" className="mx-auto my-6" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="relative w-64" ref={searchRef}>
          <Input
            label={t('workspace.members.searchUser')}
            placeholder={t('workspace.members.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            prefix={<PiMagnifyingGlassBold className="h-4 w-4" />}
            suffix={isSearching ? <Loader variant="spinner" size="sm" /> : undefined}
            className="w-full"
            size="sm"
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-muted bg-white shadow-lg dark:bg-gray-50">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-gray-100 dark:hover:bg-gray-200/50"
                  onClick={() => handleSelectUser(u)}
                >
                  <UserAvatar
                    avatarUrl={u.avatar_url}
                    fallbackSeed={u.id}
                    name={u.username}
                    className="!h-6 !w-6 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <Text className="text-sm font-medium">{u.username}</Text>
                    <Text className="truncate text-xs text-gray-500">
                      {u.email || u.id.slice(0, 12)}
                    </Text>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery && !selectedUserId && !isSearching && (
            <Text className="mt-1 text-[11px] text-gray-500">
              {t('workspace.members.selectFromResults')}
            </Text>
          )}
        </div>
        <div className="w-40">
          <Select
            label={t('groupDetail.roleHeader')}
            options={roleOptions}
            value={roleOptions.find((r) => r.value === role)}
            onChange={(opt: { value?: WorkspaceAssignableRole } | null) =>
              setRole(opt?.value || 'user')
            }
            className="w-full"
            size="sm"
          />
          <Text className="mt-1 text-[11px] leading-snug text-gray-500">
            {t(roleDescription(role) ?? '')}
          </Text>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          isLoading={adding}
          disabled={!selectedUserId}
          className="flex items-center gap-1"
        >
          <PiPlusBold size={14} />
          {t('workspace.members.addDirect')}
        </Button>
        {onInviteByEmail && (
          <Button size="sm" variant="outline" onClick={onInviteByEmail}>
            {t('workspace.invite.title')}
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <Empty text={t('workspace.members.empty')} textClassName="text-sm text-gray-500 mt-2" />
      ) : (
        <div className="overflow-auto rounded-lg border border-muted">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-200/70">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t('groupDetail.userHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('groupDetail.roleHeader')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('groupDetail.joinedHeader')}</th>
                <th className="px-3 py-2 text-end font-medium">{t('groupDetail.actionHeader')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {members.map((m) => {
                const isOwnerRow = m.role_name === 'owner';
                const displayName = usernameMap[m.user_id] || `${m.user_id.slice(0, 8)}...`;
                return (
                  <tr key={m.id}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          avatarUrl={null}
                          fallbackSeed={m.user_id}
                          name={displayName}
                          className="!h-7 !w-7 shrink-0"
                        />
                        <Text className="truncate text-sm font-medium">{displayName}</Text>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {isOwnerRow ? (
                        <Tooltip content={t('workspace.owner.notEditableHint')} placement="top">
                          <span>
                            <WorkspaceRoleBadge role={m.role_name} />
                          </span>
                        </Tooltip>
                      ) : (
                        <Select
                          options={roleOptions}
                          value={roleOptions.find((r) => r.value === m.role_name)}
                          onChange={(opt: { value?: WorkspaceAssignableRole } | null) =>
                            handleRoleChange(m.user_id, opt?.value || m.role_name)
                          }
                          size="sm"
                          className="w-28"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <Tooltip
                        content={
                          isOwnerRow
                            ? t('workspace.owner.notEditableHint')
                            : t('groupDetail.actionHeader')
                        }
                        placement="left"
                      >
                        <span>
                          <ActionIcon
                            size="sm"
                            variant="outline"
                            color="danger"
                            disabled={isOwnerRow}
                            onClick={() => handleRemove(m.user_id)}
                          >
                            <PiTrashBold size={14} />
                          </ActionIcon>
                        </span>
                      </Tooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export interface WorkspaceResourceTabProps {
  workspaceId: string;
  type: 'modules' | 'files' | 'cases';
  idField: 'module_id' | 'artifact_id' | 'case_id';
  fetchFn: (id: string) => Promise<unknown[]>;
  addFn: (id: string, data: Record<string, string>) => Promise<unknown>;
  removeFn: (id: string, resourceId: string) => Promise<void>;
}

export function WorkspaceResourceTab({
  workspaceId,
  type,
  idField,
  fetchFn,
  addFn,
  removeFn,
}: WorkspaceResourceTabProps) {
  const { t } = useTranslation();
  const confirm = useConfirmDialog();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  const resourceKind: WorkspaceResourceKind = type;

  const assignedIds = useMemo(
    () =>
      items
        .map((item) => (item[idField] as string) || (item.id as string))
        .filter(Boolean),
    [items, idField]
  );

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFn(workspaceId);
      setItems(data as Record<string, unknown>[]);
    } catch {
      toast.error(t('groupDetail.loadError', { type }));
    } finally {
      setLoading(false);
    }
  }, [fetchFn, workspaceId, t, type]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Resolve display names for already-assigned ids: cached names first, then
  // (for modules) the full permission-sections catalog, which is always
  // fetched anyway for the picker dropdown. Cases/files fall back to the raw
  // id until picked again through WorkspaceCasePicker/WorkspaceFilePicker,
  // which do capture a name at selection time (see handleAdd below).
  useEffect(() => {
    if (assignedIds.length === 0 && resourceKind !== 'modules') return;
    let cancelled = false;
    (async () => {
      const cached: Record<string, string> = {};
      for (const id of assignedIds) {
        const name = getCachedResourceName(resourceKind, id);
        if (name) cached[id] = name;
      }
      if (resourceKind === 'modules') {
        try {
          const sections = await adminService.getPermissionSections();
          const fresh: Record<string, string> = {};
          for (const s of sections) {
            if (s.id) fresh[s.id] = s.description ? `${s.name} — ${s.description}` : s.name || s.id;
          }
          setCachedResourceNames('modules', fresh);
          if (!cancelled) setNameMap((prev) => ({ ...prev, ...cached, ...fresh }));
          return;
        } catch {
          /* fall through to cached-only names below */
        }
      }
      if (!cancelled) setNameMap((prev) => ({ ...prev, ...cached }));
    })();
    return () => {
      cancelled = true;
    };
  }, [assignedIds, resourceKind]);

  const handleAdd = async () => {
    const id = newId.trim();
    if (!id) return;
    setAdding(true);
    try {
      await addFn(workspaceId, { [idField]: id });
      if (newLabel.trim()) {
        setCachedResourceName(resourceKind, id, newLabel.trim());
        setNameMap((prev) => ({ ...prev, [id]: newLabel.trim() }));
      }
      toast.success(t('groupDetail.assignSuccess', { type }));
      setNewId('');
      setNewLabel('');
      fetchItems();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || t('groupDetail.assignError', { type }));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (resourceId: string) => {
    const confirmed = await confirm({
      title: t('workspace.resourceTab.removeTitle', { type }),
      message: t('workspace.resourceTab.removeConfirm', {
        name: nameMap[resourceId] ?? resourceId,
      }),
      confirmLabel: t('workspace.resourceTab.removeAction'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await removeFn(workspaceId, resourceId);
      toast.success(t('groupDetail.removedFromGroup'));
      fetchItems();
    } catch {
      toast.error(t('groupDetail.removeError'));
    }
  };

  if (loading) return <Loader variant="spinner" className="mx-auto my-6" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {type === 'modules' && (
          <WorkspaceModulePicker
            value={newId}
            onChange={(id, label) => {
              setNewId(id);
              setNewLabel(label ?? nameMap[id] ?? '');
            }}
            excludeIds={assignedIds}
          />
        )}
        {type === 'cases' && (
          <WorkspaceCasePicker
            value={newId}
            onChange={(id, label) => {
              setNewId(id);
              setNewLabel(label ?? '');
            }}
            excludeIds={assignedIds}
          />
        )}
        {type === 'files' && (
          <WorkspaceFilePicker
            value={newId}
            onChange={(id, label) => {
              setNewId(id);
              setNewLabel(label ?? '');
            }}
            excludeIds={assignedIds}
          />
        )}
        <Button size="sm" onClick={handleAdd} isLoading={adding} className="flex items-center gap-1">
          <PiPlusBold size={14} />
          {t('workspace.assign')}
        </Button>
      </div>

      {items.length === 0 ? (
        <Empty
          text={t('workspace.noAssigned', { type })}
          textClassName="text-sm text-gray-500 mt-2"
        />
      ) : (
        <div className="grid gap-2">
          {items.map((item, idx) => {
            const itemId =
              (item[idField] as string) || (item.id as string) || `item-${idx}`;
            const resolvedName = nameMap[itemId];
            return (
              <div
                key={itemId}
                className="flex items-center justify-between gap-3 rounded-md border border-muted px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <Text className="truncate text-sm font-medium" title={itemId}>
                    {resolvedName ?? itemId}
                  </Text>
                  {resolvedName && (
                    <Text className="truncate font-mono text-[10px] text-gray-400">{itemId}</Text>
                  )}
                </div>
                <Tooltip content={t('groupDetail.actionHeader')} placement="left">
                  <ActionIcon
                    size="sm"
                    variant="outline"
                    color="danger"
                    onClick={() => handleRemove(itemId)}
                  >
                    <PiTrashBold size={14} />
                  </ActionIcon>
                </Tooltip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
