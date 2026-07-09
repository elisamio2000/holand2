// ============================================
// PluginsView — Legacy wrapper: tabs + grid by URL (prefer page-level composition)
// ============================================
'use client';

import { usePathname } from 'next/navigation';
import PluginsTabsNav from './plugins-tabs-nav';
import InternalPluginsGrid from './internal-plugins-grid';
import ExternalPluginsHub from './external-plugins-hub';

export default function PluginsView() {
  const pathname = usePathname();
  const isExternal =
    pathname.includes('/external-plugins') || pathname.includes('/plugins/external');
  const activeTab = isExternal ? 'external' : 'internal';

  return (
    <div className="space-y-6">
      <PluginsTabsNav />
      <div className="mt-6">
        {activeTab === 'internal' ? <InternalPluginsGrid /> : <ExternalPluginsHub />}
      </div>
    </div>
  );
}
