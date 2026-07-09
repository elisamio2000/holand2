// ============================================
// DEPRECATED — use use-permissions-api.ts instead
//
// This file is kept as a shim for any legacy imports of
// '@/hooks/usePermissions'. New code must import from:
//   '@/hooks/use-permissions-api' → usePermissionsApi
//
// WHY renamed: The old name shadowed the session-based hook in
// '@/hooks/use-permissions', creating developer confusion and
// potential wrong-hook imports.
// ============================================

export { usePermissionsApi as usePermissions, usePermissionsApi as default } from '@/hooks/use-permissions-api';

