'use client';

import { Tooltip } from '@/components/tooltip';
import { type ReactNode } from 'react';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { usePermissionsApi } from '@/hooks/use-permissions-api';

type ButtonColor = 'primary' | 'secondary' | 'danger';

interface ProtectedButtonProps {
  /** Single permission string to check */
  permission?: string;
  /** Multiple permissions - all must pass */
  permissions?: string[];
  /** Use OR logic for multiple permissions (at least one must pass) */
  requireAny?: boolean;
  /** Behavior when permission is denied: 'hide' removes element, 'disable' disables it */
  fallback?: 'hide' | 'disable';
  /** Tooltip text to show when disabled */
  disabledTooltip?: string;
  /** RizzUI Button color */
  color?: ButtonColor;
  /** RizzUI Button variant */
  variant?: 'solid' | 'flat' | 'outline' | 'text';
  /** Class names for the wrapper (when using hide/disable) */
  wrapperClassName?: string;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * ProtectedButton — Permission-controlled button wrapper
 *
 * Automatically hides or disables buttons based on user permissions.
 *
 * @example
 * ```tsx
 * // Single permission check
 * <ProtectedButton permission="admin:users:delete" onClick={handleDelete}>
 *   Delete User
 * </ProtectedButton>
 *
 * // Multiple permissions (all required)
 * <ProtectedButton
 *   permissions={['users:read', 'users:update']}
 *   fallback="disable"
 *   disabledTooltip="You don't have permission to edit users"
 * >
 *   Edit User
 * </ProtectedButton>
 *
 * // Multiple permissions (any required)
 * <ProtectedButton
 *   permissions={['files:upload', 'files:replace']}
 *   requireAny={true}
 *   fallback="hide"
 * >
 *   Upload File
 * </ProtectedButton>
 * ```
 */
export default function ProtectedButton({
  permission,
  permissions: permissionList,
  requireAny = false,
  fallback = 'disable',
  disabledTooltip = 'You do not have permission to perform this action',
  color,
  variant,
  wrapperClassName,
  className,
  disabled,
  children,
  onClick,
}: ProtectedButtonProps) {
  const { can, canAll, canAny } = usePermissionsApi();

  // Determine which permissions to check
  const permissionsToCheck = permission
    ? [permission]
    : permissionList || [];

  // Check if user has permission
  let hasPermission = true;
  if (permissionsToCheck.length === 0) {
    // No permissions specified, allow access
    hasPermission = true;
  } else if (permissionsToCheck.length === 1) {
    // Single permission
    hasPermission = can(permissionsToCheck[0]);
  } else if (requireAny) {
    // Multiple permissions with OR logic
    hasPermission = canAny(permissionsToCheck);
  } else {
    // Multiple permissions with AND logic (default)
    hasPermission = canAll(permissionsToCheck);
  }

  const isDisabled = disabled || !hasPermission;

  // Hide the button if permission is denied and fallback is 'hide'
  if (!hasPermission && fallback === 'hide') {
    return null;
  }

  // Disable the button if permission is denied and fallback is 'disable'
  const buttonElement = (
    <Button
      disabled={isDisabled}
      className={cn('transition-all', className)}
      color={color}
      variant={variant}
      onClick={onClick}
    >
      {children}
    </Button>
  );

  // Wrap with tooltip if disabled and disabledTooltip is provided
  if (isDisabled && disabledTooltip && fallback === 'disable') {
    return (
      <Tooltip
        content={disabledTooltip}
        placement="top"
      >
        <div className={cn('inline-block', wrapperClassName)}>
          {buttonElement}
        </div>
      </Tooltip>
    );
  }

  return (
    <div className={cn('inline-block', wrapperClassName)}>
      {buttonElement}
    </div>
  );
}
