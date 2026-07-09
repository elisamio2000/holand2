import { useEffect, useLayoutEffect } from 'react';

// useLayoutEffect will show warning if used during ssr, e.g. with Next.js
// useClientSafeEffect removes it by replacing useLayoutEffect with useEffect during ssr
export const useClientSafeEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;
