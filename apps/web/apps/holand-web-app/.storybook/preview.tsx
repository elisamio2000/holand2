import type { Preview } from '@storybook/react';
import React, { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { LanguageProvider } from '@/providers/language-provider';
import { useAudioPlayerStore } from '@/components/audio-player/store/audio-player-store';
import { useVideoPlayerSessionStore } from '@/components/video-player/store/video-player-session-store';
import '@/app/globals.css';

function StoryDecorator({
  children,
  theme,
  direction,
}: {
  children: React.ReactNode;
  theme: string;
  direction: string;
}) {
  useEffect(() => {
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme, direction]);

  useEffect(() => {
    return () => {
      useAudioPlayerStore.getState().clearSession();
      useVideoPlayerSessionStore.getState().closePip();
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme={theme} forcedTheme={theme}>
      <LanguageProvider>
        <div dir={direction} className="min-w-[320px] p-2 font-inter">
          {children}
        </div>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    docs: {
      description: {
        component:
          'See docs/MEDIA-PLAYER-ARCHITECTURE.md and /dev/media-players for integration scenarios.',
      },
    },
  },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light / dark',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
    direction: {
      name: 'Direction',
      description: 'LTR / RTL',
      defaultValue: 'ltr',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'ltr', title: 'LTR' },
          { value: 'rtl', title: 'RTL' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <StoryDecorator theme={context.globals.theme as string} direction={context.globals.direction as string}>
        <Story />
      </StoryDecorator>
    ),
  ],
};

export default preview;
