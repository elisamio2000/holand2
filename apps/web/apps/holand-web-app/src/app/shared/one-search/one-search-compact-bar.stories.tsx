import type { Meta, StoryObj } from '@storybook/react';
import { useState, type FormEvent } from 'react';
import { OneSearchCompactBar } from '@/app/shared/one-search/one-search-chrome';

function CompactBarDemo() {
  const [query, setQuery] = useState('storybook sample');
  const onSubmit = (e: FormEvent) => e.preventDefault();
  return (
    <OneSearchCompactBar
      query={query}
      setQuery={setQuery}
      onSubmit={onSubmit}
      variant="default"
      onOpenAdvanced={() => {}}
      onOpenSimple={() => {}}
      onClearQuery={() => setQuery('')}
    />
  );
}

const meta: Meta<typeof CompactBarDemo> = {
  title: 'OneSearch/CompactBar',
  component: CompactBarDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CompactBarDemo>;

export const Default: Story = {};
