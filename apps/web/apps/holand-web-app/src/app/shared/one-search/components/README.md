# One Search Components

کامپوننت‌های جستجوی یکپارچه برای نمایش نتایج جستجو از منابع مختلف

## 📁 ساختار کامپوننت‌ها

```
components/
├── mode-selector.tsx          # انتخاب حالت جستجو (all/text/image/audio/video/file)
├── search-bar.tsx             # نوار جستجو با voice و image buttons
├── results-tabs.tsx           # تب‌های نمایش نتایج به تفکیک lane
├── all-results-tab.tsx        # نمایش همه نتایج با semantic grouping
├── sidebar-filters.tsx        # سایدبار فیلترها
├── filter-chips.tsx           # نمایش فیلترهای فعال به صورت chip
├── search-results-layout.tsx  # Layout اصلی نتایج
├── result-cards/              # کارت‌های نمایش نتایج
│   ├── chat-card.tsx
│   ├── case-card.tsx
│   ├── file-card.tsx
│   ├── user-card.tsx
│   └── graph-card.tsx
└── index.ts                   # Export همه کامپوننت‌ها
```

## 🎯 استفاده

### SearchResultsLayout (کامپوننت اصلی)

```tsx
import { SearchResultsLayout } from '@/app/shared/one-search/components';

<SearchResultsLayout
  response={mockResponse}
  loading={mockLoading}
  error={mockError}
  mode={mode}
  onModeChange={(newMode) => handleModeChange(newMode)}
/>
```

### ModeSelector

```tsx
import { ModeSelector } from '@/app/shared/one-search/components';

<ModeSelector
  activeMode="all"
  onChange={(mode) => setMode(mode)}
/>
```

### SearchBar

```tsx
import { SearchBar } from '@/app/shared/one-search/components';

<SearchBar
  value={query}
  onChange={setQuery}
  onSubmit={handleSubmit}
  size="large"
  features={{ voice: true, image: true }}
/>
```

### ResultsTabs

```tsx
import { ResultsTabs } from '@/app/shared/one-search/components';

<ResultsTabs
  activeTab="all"
  onChange={setActiveTab}
  counts={{
    all: 47,
    chat: 14,
    cases: 8,
    files: 14,
    storage: 8,
    users: 6,
    graph: 9,
  }}
  sticky
/>
```

### AllResultsTab

```tsx
import { AllResultsTab } from '@/app/shared/one-search/components';

<AllResultsTab
  response={searchResponse}
  onViewAllLane={(lane) => setActiveTab(lane)}
/>
```

### SidebarFilters

```tsx
import { SidebarFilters } from '@/app/shared/one-search/components';

<SidebarFilters
  facets={response.facets}
  selectedLanes={selectedLanes}
  onLanesChange={setSelectedLanes}
  selectedDateRange={dateRange}
  onDateRangeChange={setDateRange}
  selectedFileTypes={fileTypes}
  onFileTypesChange={setFileTypes}
/>
```

### FilterChips

```tsx
import { FilterChips } from '@/app/shared/one-search/components';

<FilterChips
  selectedLanes={['chat', 'files']}
  onRemoveLane={(lane) => removeLane(lane)}
  selectedDateRange="last_week"
  onRemoveDateRange={() => clearDateRange()}
  selectedFileTypes={['pdf', 'docx']}
  onRemoveFileType={(type) => removeFileType(type)}
  onClearAll={() => clearAllFilters()}
/>
```

### Result Cards

```tsx
import { 
  ChatCard, 
  CaseCard, 
  FileCard, 
  UserCard, 
  GraphCard 
} from '@/app/shared/one-search/components';

// Chat Card
<ChatCard 
  data={hit} 
  onClick={() => navigateToChat(hit.id)} 
/>

// Case Card
<CaseCard 
  data={hit} 
  onClick={() => navigateToCase(hit.id)} 
/>

// File Card
<FileCard 
  data={hit} 
  onClick={() => openFile(hit.id)} 
/>

// User Card
<UserCard 
  data={hit} 
  onClick={() => viewProfile(hit.id)} 
/>

// Graph Card
<GraphCard 
  data={hit} 
  onClick={() => exploreGraph(hit.id)} 
/>
```

## 🎨 ویژگی‌های طراحی

### Dark Mode Support
همه کامپوننت‌ها از dark mode پشتیبانی می‌کنند:
- استفاده از `dark:` prefix در Tailwind
- رنگ‌های سازگار با هر دو حالت

### RTL/LTR Support
- استفاده از `useTranslation` برای i18n
- Layout در بیشتر کامپوننت‌ها با logical properties (`start`/`end`) سازگار است؛ پوشش کامل RTL در همه زیرصفحه‌ها تضمین نشده

### Responsive Design
- Mobile: Sidebar به صورت drawer
- Tablet: Sidebar collapsible
- Desktop: Sidebar ثابت

### Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support

## 🔧 Utility Functions

```tsx
import { 
  formatRelativeDate, 
  formatFileSize, 
  getFileIcon 
} from '@/app/shared/one-search/utils/format-date';

// Format date
formatRelativeDate('2026-05-12T10:00:00Z', 'fa'); // "2 ساعت پیش"

// Format file size
formatFileSize(1024 * 1024); // "1.0 MB"

// Get file icon
getFileIcon('application/pdf'); // "📄"
```

## 📊 Mock vs live data

`check-and-run.ps1` writes One Search env before starting the dev server (Section 7 wizard or auto probe):

```powershell
.\check-and-run.ps1                    # auto: live if plugins OK, else mock
.\check-and-run.ps1 -OneSearchMode mock
.\check-and-run.ps1 -OneSearchMode real
```

Manual override in `.env.local`:

```bash
NEXT_PUBLIC_ONE_SEARCH_MODE=auto
NEXT_PUBLIC_ONE_SEARCH_PROVIDER=temp-federated
NEXT_PUBLIC_ONE_SEARCH_MOCK=false
NEXT_PUBLIC_ONE_SEARCH_LANE_FALLBACK_MOCK=true
```

```tsx
import { isOneSearchMockEnabled } from '@/app/shared/one-search/mock/config';
import { runMockOneSearch } from '@/app/shared/one-search/mock/mock-one-search';

if (isOneSearchMockEnabled()) {
  const response = await runMockOneSearch({ 
    query: 'احمد', 
    mode: 'all' 
  });
}
```

## 🎯 TypeScript Types

```tsx
import type {
  OneSearchMode,
  OneSearchLaneId,
  OneSearchHit,
  OneSearchResponse,
  OneSearchFacets,
  OneSearchSuggestions,
} from '@/types/one-search.types';
```

## 🚀 Performance

### Optimizations
- Memoization با `useMemo` و `useCallback`
- Lazy loading برای تصاویر
- Virtual scrolling برای لیست‌های بلند (آینده)

### Best Practices
- استفاده از `key` prop برای لیست‌ها
- جلوگیری از re-render غیرضروری
- Code splitting برای کامپوننت‌های سنگین

## 📝 Translation Keys

همه translation keys در `src/locales/fa.ts` تحت `searchHub`:

```typescript
searchHub: {
  modes: { all, text, image, audio, video, file },
  lanes: { all, chat, cases, files, storage, users, graph },
  filters: 'فیلترها',
  activeFilters: 'فیلترهای فعال',
  featuredResult: 'نتیجه برجسته',
  // ... و بقیه
}
```

## ✅ Checklist پیاده‌سازی

- [x] TypeScript types
- [x] Mock data system
- [x] Core components (ModeSelector, SearchBar)
- [x] Result cards (Chat, Case, File, User, Graph)
- [x] ResultsTabs & AllResultsTab
- [x] Sidebar & Filters
- [x] FilterChips
- [x] SearchResultsLayout
- [x] Translation keys
- [x] Dark mode support
- [x] RTL support
- [x] Responsive design
- [x] Unit tests (90+ vitest in `one-search/` — run `pnpm vitest run src/app/shared/one-search`)
- [x] E2E spec (`e2e/one-search.spec.ts` — requires Playwright + dev server)
- [ ] Storybook stories
- [x] Backend integration (temp-federated + check-and-run auto mode)

## 🔗 مستندات مرتبط

- [Design Spec Part 1](../../../../docs/one-search-design-spec-part1.md)
- [Design Spec Part 2](../../../../docs/one-search-design-spec-part2.md)
- [Component Specs](../../../../docs/one-search-component-specs.md)
- [Main README](../../../../docs/one-search-README.md)

## 📞 پشتیبانی

برای سوالات و مشکلات:
1. مراجعه به مستندات بالا
2. بررسی Mock data در `mock/mock-one-search.ts`
3. تست با `NEXT_PUBLIC_ONE_SEARCH_MOCK=true`
