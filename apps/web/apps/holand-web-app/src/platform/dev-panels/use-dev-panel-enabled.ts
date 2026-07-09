'use client';

/**
 * Returns true when a module dev panel should render (explicit env or development).
 * @param envKey - Optional `NEXT_PUBLIC_*` flag name (without prefix), e.g. `AI_CHAT_DEV_PANEL`
 */
export function useDevPanelEnabled(envKey?: string): boolean {
  if (envKey && process.env[`NEXT_PUBLIC_${envKey}`] === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'development';
}

/** Non-hook variant for static module config files. */
export function isDevPanelEnabled(envKey?: string): boolean {
  if (envKey && process.env[`NEXT_PUBLIC_${envKey}`] === 'true') {
    return true;
  }
  return process.env.NODE_ENV === 'development';
}
