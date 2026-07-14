'use client';

import { useState } from 'react';
import { PiPaperPlane, PiSpinner } from 'react-icons/pi';
import { Button, Input, Textarea, Text, Title, Badge } from 'rizzui';
import toast from 'react-hot-toast';
import adminLLMService from '@/services/admin-llm.service';

export default function TestTab() {
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerateReport = async () => {
    if (!sessionId.trim()) {
      toast.error('لطفاً Session ID را وارد کنید');
      return;
    }

    try {
      setLoading(true);
      setResult(null);
      const response = await adminLLMService.generateAIReport(sessionId, {});
      setResult(response);

      if (response.status === 'success') {
        toast.success(`گزارش با موفقیت تولید شد (${response.generation_time_ms}ms)`);
      } else if (response.status === 'fallback') {
        toast.warning('LLM در دسترس نیست، از تفسیر rule-based استفاده شد');
      } else {
        toast.error(response.message || 'خطا در تولید گزارش');
      }
    } catch (error: any) {
      toast.error(`خطا: ${error.message}`);
      setResult({ status: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
        <Title as="h3" className="mb-4">تست تولید گزارش AI</Title>
        <Text className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Session ID یک assessment تکمیل‌شده را وارد کنید تا گزارش AI تولید شود.
        </Text>

        <div className="space-y-4">
          <Input
            label="Session ID"
            placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />

          <Button
            onClick={handleGenerateReport}
            disabled={loading || !sessionId.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <PiSpinner className="h-4 w-4 animate-spin" />
                در حال تولید گزارش...
              </>
            ) : (
              <>
                <PiPaperPlane className="h-4 w-4" />
                تولید گزارش AI
              </>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <div className="mb-4 flex items-center gap-2">
            <Title as="h3">نتیجه</Title>
            <Badge color={result.status === 'success' ? 'success' : result.status === 'fallback' ? 'warning' : 'danger'}>
              {result.status}
            </Badge>
          </div>

          <div className="space-y-2">
            {result.report_id && (
              <Text className="text-sm">
                <span className="font-semibold">Report ID:</span> {result.report_id}
              </Text>
            )}
            {result.message && (
              <Text className="text-sm">
                <span className="font-semibold">پیام:</span> {result.message}
              </Text>
            )}
            {result.generation_time_ms && (
              <Text className="text-sm">
                <span className="font-semibold">زمان:</span> {result.generation_time_ms}ms
              </Text>
            )}
          </div>

          <pre className="mt-4 rounded-md bg-gray-100 p-4 text-xs dark:bg-gray-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
