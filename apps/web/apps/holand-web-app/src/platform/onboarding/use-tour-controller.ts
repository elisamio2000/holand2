'use client';

import { useCallback, useState } from 'react';

export function useTourController() {
  const [startSignal, setStartSignal] = useState(0);

  const startTour = useCallback(() => {
    setStartSignal((n) => n + 1);
  }, []);

  return { startSignal, startTour };
}
