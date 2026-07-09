'use client';

import { IconTooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ActionIcon, Badge, Button, Empty, Flex, Loader, Text, Title } from 'rizzui';
import {
  PiPencilSimpleBold,
  PiTrashBold,
  PiUsersThreeBold,
  PiPlusBold,
  PiArrowsClockwiseBold,
  PiCaretDownBold,
  PiCaretRightBold,
  PiWarningBold,
} from 'react-icons/pi';
import { adminService } from '@/services/admin.service';
import type { GroupResponse } from '@/types/auth.types';
import cn from '@core/utils/class-names';
import ModalButton from '@/app/shared/modal-button';
import CreateGroup from './create-group';
import GroupDetail from './group-detail';
import { getApiErrorMessage } from '@/utils/api-error-message';

/**
 * Groups Table — Backend integration
 * ✅ GET /admin/group-rbac/groups — List groups
 * ✅ DELETE /admin/group-rbac/groups/:id — Delete group (cascade)
 * ✅ Expandable rows for group detail (members, modules, files, cases)
 */
export default function GroupsTable() {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [backendUnavailable, setBackendUnavailable] = useState(false);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setBackendUnavailable(false);
    try {
      const data = await adminService.getGroups();
      setGroups(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        console.warn('[GroupsTable] Group-RBAC service returned 404 — backend not available:', err);
        setBackendUnavailable(true);
      } else {
        console.error('[GroupsTable] Failed to load groups:', err);
        toast.error(getApiErrorMessage(err, t('groupsTable.loadError')));
      }
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleDelete = async (group: GroupResponse) => {
    if (!window.confirm(t('groupsTable.deleteConfirm', { name: group.name }))) return;
    try {
      await adminService.deleteGroup(group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      if (expandedId === group.id) setExpandedId(null);
      toast.success(t('groupsTable.deleteSuccess', { name: group.name }));
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, t('groupsTable.deleteError')));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (backendUnavailable) {
    return (
      <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950/30">
        <div className="flex items-start gap-3">
          <PiWarningBold className="mt-0.5 h-6 w-6 shrink-0 text-orange-500" />
          <div>
            <Title as="h5" className="font-semibold text-orange-700 dark:text-orange-400">
              {t('groupsTable.backendNotAvailableTitle')}
            </Title>
            <Text className="mt-1 text-sm text-orange-600 dark:text-orange-300">
              {t('groupsTable.backendNotAvailableMessage')}
            </Text>
            <div className="mt-3 overflow-auto rounded-md bg-orange-100 p-3 dark:bg-orange-900/30">
              <code className="text-xs text-orange-700 dark:text-orange-300">
                {t('groupsTable.endpoint404')}
              </code>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchGroups}>
              <PiArrowsClockwiseBold className="me-1.5 h-3.5 w-3.5" />
              {t('groupsTable.retry')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Flex justify="between" align="center">
        <Title as="h5" className="font-semibold">
          {t('groupsTable.title', { count: groups.length })}
        </Title>
        <Flex gap="2">
          <IconTooltip content={t('groupsTable.refreshTooltip')} preset="toolbar">
            <ActionIcon variant="outline" onClick={fetchGroups}>
              <PiArrowsClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </IconTooltip>
          <ModalButton
            label={t('groupsTable.createGroup')}
            view={<CreateGroup onCreated={fetchGroups} />}
            customSize="600px"
            icon={<PiPlusBold className="me-1.5 h-4 w-4" />}
          />
        </Flex>
      </Flex>

      {groups.length === 0 ? (
        <Empty text={t('groupsTable.noGroups')} textClassName="mt-2 text-gray-500" />
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50"
            >
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-100 sm:gap-4 sm:px-5 sm:py-4',
                  expandedId === group.id && 'bg-gray-50 dark:bg-gray-100'
                )}
                onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
              >
                <div className="shrink-0 text-gray-500">
                  {expandedId === group.id ? (
                    <PiCaretDownBold className="h-4 w-4" />
                  ) : (
                    <PiCaretRightBold className="h-4 w-4" />
                  )}
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PiUsersThreeBold className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Text className="font-semibold truncate">{group.name}</Text>
                    {!group.is_active && (
                      <Badge variant="flat" color="danger" size="sm" className="shrink-0">
                        {t('groupsTable.inactive')}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {group.description && (
                      <Text className="text-xs text-gray-500 line-clamp-1 min-w-0">
                        {group.description}
                      </Text>
                    )}
                    <Text className="shrink-0 text-[10px] text-gray-400 sm:text-xs">
                      {new Date(group.created_at).toLocaleDateString()}
                    </Text>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <IconTooltip content={t('groupsTable.editTooltip')} preset="toolbar">
                    <ModalButton
                      label=""
                      view={<CreateGroup group={group} onCreated={fetchGroups} />}
                      customSize="600px"
                      icon={<PiPencilSimpleBold className="h-4 w-4" />}
                      variant="outline"
                      size="sm"
                    />
                  </IconTooltip>
                  <IconTooltip content={t('groupsTable.deleteTooltip')} preset="toolbar">
                    <ActionIcon
                      variant="outline"
                      color="danger"
                      size="sm"
                      onClick={() => handleDelete(group)}
                    >
                      <PiTrashBold className="h-4 w-4" />
                    </ActionIcon>
                  </IconTooltip>
                </div>
              </div>

              {expandedId === group.id && (
                <div className="border-t border-muted px-5 pb-5 pt-4">
                  <GroupDetail groupId={group.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
