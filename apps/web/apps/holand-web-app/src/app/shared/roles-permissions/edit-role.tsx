'use client';

import { useEffect, useState } from 'react';
import { PiCheckBold, PiXBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { IconTooltip } from '@/components/tooltip';
import { useModal } from '@/app/shared/modal-views/use-modal';
import {
  ActionIcon,
  Title,
  Button,
  Text,
  Loader,
  Badge,
} from 'rizzui';
import { adminService } from '@/services/admin.service';
import {
  matrixPermissionLabelI18n,
  permissionCategoryLabelI18n,
  roleDisplayNameKey,
} from '@/app/shared/roles-permissions/utils';
import type { RoleResponse, PermissionsMatrix } from '@/types/auth.types';
import toast from 'react-hot-toast';

/**
 * DEV NOTE: Edit Role — Backend integration
 * ✅ GET /rbac/permissions/matrix — Returns full permissions matrix per role
 * ✅ POST /rbac/permissions — { role, permission, action: 'add'|'remove' }
 *    → Each toggle saves immediately (aligned with Matrix tab UX)
 */

interface EditRoleProps {
  role?: RoleResponse;
  onSaved?: () => void;
}

export default function EditRole({ role, onSaved }: EditRoleProps) {
  const { t } = useTranslation();
  const { closeModal } = useModal();
  const [isLoading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<PermissionsMatrix | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const isSystemRole = Boolean(role?.is_system);
  const roleDescription = role
    ? t(`rolesGrid.roleDescriptions.${role.name}`, {
        defaultValue: role.description || '',
      })
    : '';
  const roleDisplayName = role
    ? t(roleDisplayNameKey(role.name), { defaultValue: role.name })
    : '';

  useEffect(() => {
    async function fetchMatrix() {
      try {
        const data = await adminService.getPermissionsMatrix();
        setMatrix(data);

        const initial: Record<string, string[]> = {};
        for (const roleName of data.roles) {
          initial[roleName] = [];
          for (const [perm, grants] of Object.entries(data.permissions)) {
            if (grants[roleName]) {
              initial[roleName].push(perm);
            }
          }
        }
        setRolePermissions(initial);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || t('editRoleForm.loadError'));
      } finally {
        setLoading(false);
      }
    }
    fetchMatrix();
  }, [t]);

  const handlePermissionToggle = async (
    roleName: string,
    perm: string,
    isChecked: boolean
  ) => {
    if (isSystemRole) {
      toast.error(t('roleCard.systemRoleCannotModify'));
      return;
    }

    const key = `${roleName}:${perm}`;
    setSavingKey(key);
    try {
      await adminService.assignPermission({
        role: roleName,
        permission: perm,
        action: isChecked ? 'remove' : 'add',
      });
      setRolePermissions((prev) => {
        const current = prev[roleName] || [];
        const next = isChecked
          ? current.filter((p) => p !== perm)
          : [...current, perm];
        return { ...prev, [roleName]: next };
      });
      if (matrix) {
        setMatrix((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            permissions: {
              ...prev.permissions,
              [perm]: {
                ...prev.permissions[perm],
                [roleName]: !isChecked,
              },
            },
          };
        });
      }
      toast.success(t('permissions.matrix.updateSuccess'));
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('permissions.matrix.updateError'));
    } finally {
      setSavingKey(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center p-6">
        <Loader variant="spinner" size="xl" />
      </div>
    );
  }

  if (!matrix) {
    return (
      <div className="p-6">
        <Text className="text-red-500">{t('editRoleForm.matrixLoadError')}</Text>
      </div>
    );
  }

  const allPermissions = Object.keys(matrix.permissions);
  const categoryMap: Record<string, string[]> = {};
  if (matrix.categories) {
    Object.entries(matrix.categories).forEach(([category, perms]) => {
      categoryMap[category] = perms;
    });
  } else {
    allPermissions.forEach((perm) => {
      const category = perm.split(':')[0] || 'other';
      if (!categoryMap[category]) categoryMap[category] = [];
      categoryMap[category].push(perm);
    });
  }

  const displayRoles = role
    ? matrix.roles.filter((r) => r === role.name)
    : matrix.roles;

  return (
    <div className="grid grid-cols-1 gap-6 p-6 @container">
      <div className="col-span-full flex items-center justify-between">
        <div>
          <Title as="h4" className="font-semibold">
            {role
              ? t('editRoleForm.titleWithRole', { name: roleDisplayName })
              : t('editRoleForm.title')}
          </Title>
          {roleDescription && (
            <Text className="mt-1 text-sm text-gray-500">{roleDescription}</Text>
          )}
          {isSystemRole && (
            <Text className="mt-2 text-xs text-orange-600">
              {t('roleCard.systemRoleCannotModify')}
            </Text>
          )}
        </div>
        <IconTooltip content={t('common.close')} preset="toolbar">
          <ActionIcon size="sm" variant="text" onClick={closeModal}>
            <PiXBold className="h-auto w-5" />
          </ActionIcon>
        </IconTooltip>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {displayRoles.map((roleName) => (
          <div key={roleName} className="mb-6">
            <Title as="h5" className="mb-3 flex items-center gap-2 text-base font-semibold capitalize">
              {t(roleDisplayNameKey(roleName), { defaultValue: roleName })}
              {role?.is_system && (
                <Badge variant="flat" color="warning" size="sm">
                  {t('editRoleForm.systemBadge')}
                </Badge>
              )}
            </Title>

            {Object.entries(categoryMap).map(([category, perms]) => (
              <div
                key={category}
                className="mb-4 rounded-md border border-muted p-4"
              >
                <Title as="h6" className="mb-3 text-sm font-medium text-gray-700">
                  {permissionCategoryLabelI18n(category, t)}
                </Title>
                <div className="flex flex-wrap gap-2">
                  {perms.map((perm) => {
                    const isChecked = (rolePermissions[roleName] || []).includes(perm);
                    const action = matrixPermissionLabelI18n(perm, matrix.labels, t);
                    const chipKey = `${roleName}:${perm}`;
                    const isSaving = savingKey === chipKey;
                    return (
                      <label
                        key={perm}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          isChecked
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-muted text-gray-500 hover:border-gray-400'
                        } ${isSystemRole || isSaving ? 'pointer-events-none opacity-60' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isChecked}
                          disabled={isSystemRole || isSaving}
                          onChange={() => handlePermissionToggle(roleName, perm, isChecked)}
                        />
                        {isChecked && <PiCheckBold className="h-3 w-3" />}
                        <span className="font-medium" title={perm}>
                          {isSaving ? '…' : action}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="col-span-full flex items-center justify-end gap-4">
        <Button variant="outline" onClick={closeModal} className="w-full @xl:w-auto">
          {t('editRoleForm.cancel')}
        </Button>
      </div>
    </div>
  );
}
