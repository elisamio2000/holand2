// ============================================
// Case View — isolated mock data (never mixed into services)
// ============================================

export const CASE_VIEW_MOCK = {
  aiSummary: {
    executiveSummary:
      'This case contains 47 documents focused on organizational communications and financial transfers. Cross-referencing suggests recurring contact patterns between key individuals and two primary entities.',
    keyFindings: [
      '12 key individuals identified across document metadata',
      '3 organizations linked through shared references',
      'Financial transfer mentions in 8 documents',
      'Timeline cluster around Q4 activity',
    ],
    entities: {
      persons: ['Ahmad Mohammadi', 'Sara Karimi', 'Reza Hosseini'],
      organizations: ['Company Alpha', 'Org Beta', 'Foundation Gamma'],
      locations: ['Tehran', 'Mashhad', 'Tabriz'],
    },
    model: 'gpt-4-analysis-preview',
    timestamp: 1704067200,
    confidence: 0.87,
  },
  statistics: {
    timeHeatmap: [
      { hour: '08', count: 2 },
      { hour: '10', count: 5 },
      { hour: '12', count: 8 },
      { hour: '14', count: 12 },
      { hour: '16', count: 9 },
      { hour: '18', count: 4 },
      { hour: '20', count: 3 },
    ],
  },
} as const;

export type CaseViewMockData = typeof CASE_VIEW_MOCK;
