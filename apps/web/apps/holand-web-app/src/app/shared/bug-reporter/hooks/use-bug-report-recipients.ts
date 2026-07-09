'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BugReportConfig } from '../config/bug-report-config';
import {
  fetchBugReportRecipients,
  type BugReportRecipient,
} from '../services/bug-report-recipients.service';

export function useBugReportRecipients(config: BugReportConfig) {
  const [recipients, setRecipients] = useState<BugReportRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchBugReportRecipients(config.recipientIds);
      setRecipients(items);
    } catch {
      setError('failed');
      setRecipients(
        config.recipientIds.map((id) => ({
          id,
          name: id,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [config.recipientIds]);

  useEffect(() => {
    void loadRecipients();
  }, [loadRecipients]);

  return { recipients, loading, error, reload: loadRecipients };
}
