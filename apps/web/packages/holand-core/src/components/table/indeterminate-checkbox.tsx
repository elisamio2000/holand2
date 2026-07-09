'use client';

// ============================================
// IndeterminateCheckbox — Theme-aware table checkbox
// Wraps rizzui Checkbox to override hardcoded bg-black
// on indeterminate state with the project's primary color.
//
// WHY: rizzui v0.8.7 uses `bg-black` for the indeterminate
// dash indicator (hardcoded in checkboxStyles). This wrapper
// replaces it with `bg-primary` to match the platform theme.
// ============================================

import { Checkbox } from 'rizzui';
import type { ComponentPropsWithoutRef } from 'react';

type CheckboxProps = ComponentPropsWithoutRef<typeof Checkbox>;

/**
 * IndeterminateCheckbox — Theme-aware table row selection checkbox.
 *
 * Extends rizzui Checkbox with a global CSS fix for the indeterminate
 * dash color. rizzui v0.8.7 hardcodes `bg-black` for the indeterminate
 * indicator; this component overrides it with `bg-primary` via a wrapper
 * className, matching the platform theme in both light and dark modes.
 *
 * Use this in ALL table `columns.tsx` files instead of `<Checkbox>` directly
 * for the `select` column header and cells.
 *
 * @param indeterminate - When true, shows the dash indicator in primary color
 *
 * @example
 * ```tsx
 * // Header (select-all)
 * import IndeterminateCheckbox from '@core/components/table/indeterminate-checkbox';
 *
 * <IndeterminateCheckbox
 *   checked={table.getIsAllPageRowsSelected()}
 *   indeterminate={table.getIsSomePageRowsSelected()}
 *   onChange={() => table.toggleAllPageRowsSelected()}
 * />
 *
 * // Cell (select-row)
 * <IndeterminateCheckbox
 *   checked={row.getIsSelected()}
 *   onChange={row.getToggleSelectedHandler()}
 * />
 * ```
 */
export default function IndeterminateCheckbox(props: CheckboxProps) {
  return (
    // Override rizzui's hardcoded `bg-black` on the indeterminate indicator span.
    //
    // WHY this selector works:
    //   .checkbox-input is the <input> element (rizzui class name).
    //   The indeterminate span is the NEXT sibling of .checkbox-input.
    //   `~` targets ANY sibling, but we add `:not(.checkbox-icon)` because
    //   the checkmark SVG icon also follows the input (as .checkbox-icon).
    //   Tailwind v3 arbitrary variants support [&_selector]:utility syntax.
    <span className="[&_.checkbox-input+span]:!bg-primary">
      <Checkbox {...props} />
    </span>
  );
}

IndeterminateCheckbox.displayName = 'IndeterminateCheckbox';
