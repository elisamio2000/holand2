import GithubIcon from '@core/components/icons/github';
import TeamsIcon from '@core/components/icons/teams';
import FigmaIcon from '@core/components/icons/figma';
import NotionIcon from '@core/components/icons/notion';
import SlackIcon from '@core/components/icons/slack';
import AirtableIcon from '@core/components/icons/airtable';
import TelegramIcon from '@core/components/icons/telegram';

export const teams = [
  {
    name: 'Teams',
    icon: <TeamsIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content: 'Streamline software projects, sprints, tasks, and bug tracking.',
  },
  {
    name: 'Github',
    icon: <GithubIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content: 'Link pull requests and automate workflows.',
  },
  {
    name: 'Figma',
    icon: <FigmaIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content: 'Embed file previews in projects.',
  },
  {
    name: 'Notion',
    icon: <NotionIcon className="h-9 w-9 dark:opacity-75 dark:invert" />,
    url: '/brand/brand-mark-4x.svg',
    content: 'Embed notion pages and notes in projects.',
  },
  {
    name: 'Slack',
    icon: <SlackIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content:
      'Send notifications to channels and create projects from messages.',
  },
  {
    name: 'Airtable',
    icon: <AirtableIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content:
      'Manage your projects using airtable a cloud collaboration service.',
  },
  {
    name: 'Telegram',
    icon: <TelegramIcon className="h-9 w-9" />,
    url: '/brand/brand-mark-4x.svg',
    content:
      'Send messages through a globally accessible freemium, cloud-based and centralized instant messaging service.',
  },
];

