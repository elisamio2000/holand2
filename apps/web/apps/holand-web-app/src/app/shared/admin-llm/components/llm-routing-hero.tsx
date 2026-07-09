'use client';

import { Button, Text, Title } from 'rizzui';
import { PiBrainBold } from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { routes } from '@/config/routes';

interface LlmRoutingHeroProps {
  onRefresh: () => void;
  showPipelineLink?: boolean;
}

export default function LlmRoutingHero({
  onRefresh,
  showPipelineLink = true,
}: LlmRoutingHeroProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-violet-500/10 p-5 dark:from-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Title className="flex items-center gap-2 text-lg">
            <PiBrainBold className="h-6 w-6 text-primary" />
            {t('llmPage.header')}
          </Title>
          <Text className="mt-1 max-w-2xl text-sm text-gray-500">
            {t('llmPage.description')}
          </Text>
          {showPipelineLink && (
            <Text className="mt-2 text-xs text-gray-400">
              {t('pipeline.redirectFromLlmRouting')}{' '}
              <Link href={routes.admin.pipeline} className="text-primary underline">
                {t('nav.pipelineAdmin')}
              </Link>
            </Text>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh}>
          {t('llmPage.refresh')}
        </Button>
      </div>
    </div>
  );
}
