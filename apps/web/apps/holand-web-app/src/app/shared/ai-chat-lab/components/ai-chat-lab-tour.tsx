'use client';

import { useTranslation } from 'react-i18next';
import { OnboardingTour, useTourController } from '@/platform/onboarding';
import { Button } from 'rizzui';

const STORAGE_KEY = 'ai-chat-lab-tour-seen';

export function AiChatLabTour() {
  const { t } = useTranslation();
  const { startSignal, startTour } = useTourController();

  const steps = [
    {
      id: 'scenarios',
      title: t('platform.dx.aiChatLab.tour.scenariosTitle'),
      body: t('platform.dx.aiChatLab.tour.scenariosBody'),
      targetSelector: '[data-tour="lab-tab-scenarios"]',
    },
    {
      id: 'dev-panel',
      title: t('platform.dx.aiChatLab.tour.inlineTitle'),
      body: t('platform.dx.aiChatLab.tour.inlineBody'),
      targetSelector: '[data-tour="scenario-dev-panel"]',
    },
    {
      id: 'production',
      title: t('platform.dx.aiChatLab.tour.productionTitle'),
      body: t('platform.dx.aiChatLab.tour.productionBody'),
      targetSelector: '[data-tour="lab-production-link"]',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={startTour} data-tour="lab-start-tour">
          {t('platform.dx.aiChatLab.tour.restart')}
        </Button>
      </div>
      <OnboardingTour
        storageKey={STORAGE_KEY}
        steps={steps}
        startSignal={startSignal}
        maskId="ai-chat-lab-tour-mask"
        labels={{
          title: t('platform.dx.aiChatLab.tour.title'),
          step: t('platform.dx.aiChatLab.tour.step'),
          skip: t('platform.dx.aiChatLab.tour.skip'),
          next: t('platform.dx.aiChatLab.tour.next'),
          done: t('platform.dx.aiChatLab.tour.done'),
          closeAriaLabel: t('platform.dx.aiChatLab.tour.skip'),
        }}
      />
    </>
  );
}
