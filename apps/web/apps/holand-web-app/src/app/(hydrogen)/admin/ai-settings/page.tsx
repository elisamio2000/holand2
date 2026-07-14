'use client';

import { useState } from 'react';
import { Title, Text, Tab } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import ProvidersTab from './providers-tab';
import TemplatesTab from './templates-tab';
import TestTab from './test-tab';

const pageHeader = {
  title: 'تنظیمات LLM',
  breadcrumb: [
    {
      href: '/admin',
      name: 'مدیریت',
    },
    {
      name: 'تنظیمات LLM',
    },
  ],
};

export default function AdminAISettingsPage() {
  return (
    <div>
      <PageHeader
        title={pageHeader.title}
        breadcrumb={pageHeader.breadcrumb}
      >
        <Text className="mt-2 text-gray-600 dark:text-gray-400">
          مدیریت Providers، Templates و تولید گزارش‌های AI
        </Text>
      </PageHeader>

      <div className="@container">
        <Tab>
          <Tab.List>
            <Tab.ListItem>Providers</Tab.ListItem>
            <Tab.ListItem>Templates</Tab.ListItem>
            <Tab.ListItem>تست</Tab.ListItem>
          </Tab.List>
          <Tab.Panels>
            <Tab.Panel>
              <ProvidersTab />
            </Tab.Panel>
            <Tab.Panel>
              <TemplatesTab />
            </Tab.Panel>
            <Tab.Panel>
              <TestTab />
            </Tab.Panel>
          </Tab.Panels>
        </Tab>
      </div>
    </div>
  );
}
