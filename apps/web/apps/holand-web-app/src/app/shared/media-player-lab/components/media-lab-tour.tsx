'use client';

import { useTranslation } from 'react-i18next';
import { OnboardingTour, useTourController } from '@/platform/onboarding';
import { Button } from 'rizzui';

const STORAGE_KEY = 'media-player-lab-tour-seen';

export function MediaLabTour() {
  const { t } = useTranslation();
  const { startSignal, startTour } = useTourController();

  const steps = [
    {
      id: 'gallery',
      title: t('platform.dx.mediaLab.tour.galleryTitle'),
      body: t('platform.dx.mediaLab.tour.galleryBody'),
      targetSelector: '[data-tour="lab-tab-gallery"]',
    },
    {
      id: 'scenarios',
      title: t('platform.dx.mediaLab.tour.scenariosTitle'),
      body: t('platform.dx.mediaLab.tour.scenariosBody'),
      targetSelector: '[data-tour="lab-tab-scenarios"]',
    },
    {
      id: 'chat-expand',
      title: t('platform.dx.mediaLab.tour.chatTitle'),
      body: t('platform.dx.mediaLab.tour.chatBody'),
      targetSelector: '[data-tour="scenario-chat"]',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={startTour} data-tour="lab-start-tour">
          {t('platform.dx.mediaLab.tour.restart')}
        </Button>
      </div>
      <OnboardingTour
        storageKey={STORAGE_KEY}
        steps={steps}
        startSignal={startSignal}
        maskId="media-lab-tour-mask"
        labels={{
          title: t('platform.dx.mediaLab.tour.title'),
          step: t('platform.dx.mediaLab.tour.step'),
          skip: t('platform.dx.mediaLab.tour.skip'),
          next: t('platform.dx.mediaLab.tour.next'),
          done: t('platform.dx.mediaLab.tour.done'),
          closeAriaLabel: t('platform.dx.mediaLab.tour.skip'),
        }}
      />
    </>
  );
}
