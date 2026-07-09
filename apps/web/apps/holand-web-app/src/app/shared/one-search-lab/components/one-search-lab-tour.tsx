'use client';

import { useTranslation } from 'react-i18next';
import { OnboardingTour, useTourController } from '@/platform/onboarding';
import { Button } from 'rizzui';

const STORAGE_KEY = 'one-search-lab-tour-seen';

export function OneSearchLabTour() {
  const { t } = useTranslation();
  const { startSignal, startTour } = useTourController();

  const steps = [
    {
      id: 'scenarios',
      title: t('platform.dx.oneSearchLab.tour.scenariosTitle'),
      body: t('platform.dx.oneSearchLab.tour.scenariosBody'),
      targetSelector: '[data-tour="lab-tab-scenarios"]',
    },
    {
      id: 'compact',
      title: t('platform.dx.oneSearchLab.tour.compactTitle'),
      body: t('platform.dx.oneSearchLab.tour.compactBody'),
      targetSelector: '[data-tour="scenario-compact"]',
    },
    {
      id: 'production',
      title: t('platform.dx.oneSearchLab.tour.productionTitle'),
      body: t('platform.dx.oneSearchLab.tour.productionBody'),
      targetSelector: '[data-tour="lab-production-link"]',
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={startTour} data-tour="lab-start-tour">
          {t('platform.dx.oneSearchLab.tour.restart')}
        </Button>
      </div>
      <OnboardingTour
        storageKey={STORAGE_KEY}
        steps={steps}
        startSignal={startSignal}
        maskId="one-search-lab-tour-mask"
        labels={{
          title: t('platform.dx.oneSearchLab.tour.title'),
          step: t('platform.dx.oneSearchLab.tour.step'),
          skip: t('platform.dx.oneSearchLab.tour.skip'),
          next: t('platform.dx.oneSearchLab.tour.next'),
          done: t('platform.dx.oneSearchLab.tour.done'),
          closeAriaLabel: t('platform.dx.oneSearchLab.tour.skip'),
        }}
      />
    </>
  );
}
