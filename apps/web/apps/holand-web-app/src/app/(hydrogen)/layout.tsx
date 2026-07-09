'use client';

import { useIsMounted } from '@core/hooks/use-is-mounted';
import HydrogenLayout from '@/layouts/hydrogen/layout';
import HeliumLayout from '@/layouts/helium/helium-layout';
import LithiumLayout from '@/layouts/lithium/lithium-layout';
import BerylLiumLayout from '@/layouts/beryllium/beryllium-layout';
import BoronLayout from '@/layouts/boron/boron-layout';
import CarbonLayout from '@/layouts/carbon/carbon-layout';
import { useLayout } from '@/layouts/use-layout';
import { LAYOUT_OPTIONS } from '@/config/enums';
import { GlobalAudioPlayerHost } from '@/components/audio-player/components/global-audio-player-host';
import { GlobalVideoPlayerHost } from '@/components/video-player/global-video-player-host';

type LayoutProps = {
  children: React.ReactNode;
};

export default function DefaultLayout({ children }: LayoutProps) {
  return (
    <>
      <LayoutProvider>{children}</LayoutProvider>
      <GlobalAudioPlayerHost />
      <GlobalVideoPlayerHost />
    </>
  );
}

function LayoutProvider({ children }: LayoutProps) {
  const { layout } = useLayout();
  const isMounted = useIsMounted();

  if (!isMounted) {
    return null;
  }

  if (layout === LAYOUT_OPTIONS.HELIUM) {
    return <HeliumLayout>{children}</HeliumLayout>;
  }
  if (layout === LAYOUT_OPTIONS.LITHIUM) {
    return <LithiumLayout>{children}</LithiumLayout>;
  }
  if (layout === LAYOUT_OPTIONS.BERYLLIUM) {
    return <BerylLiumLayout>{children}</BerylLiumLayout>;
  }
  if (layout === LAYOUT_OPTIONS.BORON) {
    return <BoronLayout>{children}</BoronLayout>;
  }
  if (layout === LAYOUT_OPTIONS.CARBON) {
    return <CarbonLayout>{children}</CarbonLayout>;
  }

  return <HydrogenLayout>{children}</HydrogenLayout>;
}
