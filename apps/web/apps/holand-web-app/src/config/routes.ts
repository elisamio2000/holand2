// ============================================
// Holand Platform — Route Configuration
// Central route definitions for all pages
// ============================================

export const routes = {
  // ==========================================
  // Holand Career Guidance Routes (active product)
  // ==========================================
  home: '/',
  careerGuidance: {
    root: '/career-guidance',
    assessments: '/career-guidance/assessments',
    reports: '/career-guidance/reports',
    expertLab: '/career-guidance/expert-lab',
  },

  // ==========================================
  // Legacy Template Routes (kept only for reference; pages removed)
  // ==========================================
  aiChat: {
    root: '/ai-chat',
    session: (sessionId: string) => `/ai-chat/${sessionId}`,
    shared: (token: string) => `/ai-chat/shared/${token}`,
  },
  /**
   * One Search hub — federated search across gateway-backed domains.
   * Query string examples: `?q=...`, `?mode=text|image|audio|file|all`
   */
  oneSearch: {
    root: '/one-search',
    advanced: '/one-search/advanced',
  },
  caseImporter: {
    dashboard: '/case-importer',
    detail: (caseId: string) => `/case-importer/${caseId}`,
    import: (mode: 'upload' | 'server-path' | 'batch' | 'staging' = 'upload') => `/case-importer/import/${mode}`,
    settings: '/case-importer/settings',
    preferences: '/case-importer/preferences',
  },

  // ==========================================
  // Cases & File Management
  // ==========================================
  cases: {
    list: '/cases',
    detail: (caseId: string) => `/cases/${caseId}`,
    create: '/cases/create',
    categories: '/cases/categories',
    templates: '/cases/templates',
    tracking: (id: string) => `/cases/tracking/${id}`,
    search: '/cases/search',
  },
  fileManager: '/file-manager',
  fileExplorer: '/file-explorer',
  /** @deprecated Use userBoards.hub — kept for redirects */
  imageViewer: '/image-viewer',
  /** Personal whiteboard workspace (not projects Kanban board) */
  userBoards: {
    hub: '/boards',
    detail: (boardId: string) => `/boards/${boardId}`,
    new: '/boards/new',
  },
  storage: '/storage',

  // ==========================================
  // Projects & Tasks
  // ==========================================
  projects: {
    feed: '/projects/feed',
    myTasks: '/projects/my-tasks',
    myTasksAssigned: '/projects/my-tasks/assigned',
    myTasksToday: '/projects/my-tasks/today',
    myTasksPersonal: '/projects/my-tasks/personal',
    board: '/projects/board',
    archive: '/projects/archive',
    detail: (id: string) => `/projects/${id}`,
    task: (projectId: string, taskId: string) => `/projects/${projectId}/tasks/${taskId}`,
  },

  // ==========================================
  // Communication
  // ==========================================
  messages: '/messages',
  messagesCompose: '/messages/compose',
  /** Full compose with optional pre-filled recipient (user id) */
  messagesComposeTo: (userId: string, subject?: string) => {
    const params = new URLSearchParams({ to: userId });
    if (subject?.trim()) params.set('subject', subject.trim());
    return `/messages/compose?${params.toString()}`;
  },
  /** Open People (chat) view with a conversation partner */
  messagesPeopleChat: (partnerId: string) => {
    const params = new URLSearchParams({ view: 'people', partner: partnerId });
    return `/messages?${params.toString()}`;
  },
  messagesThread: (messageId: string) =>
    `/messages?id=${encodeURIComponent(messageId)}`,
  eventCalendar: '/event-calendar',

  // ==========================================
  // Reports
  // ==========================================
  reports: {
    builder: '/reports/builder',
  },

  // ==========================================
  // Plugins / Apps
  // ==========================================
  plugins: {
    dashboard: '/plugins',
    /** Gateway-registered tool detail (hyphenated slug) */
    detail: (pluginId: string) => `/plugins/${pluginId.replace(/\./g, '-')}`,
    run: (pluginId: string) => `/plugins/${pluginId.replace(/\./g, '-')}/run`,
    /** Canonical native UI bundles shipped inside the Holand web app */
    internalNative: (pluginSlug: string) =>
      `/plugins/internal-plugin/${pluginSlug.replace(/\./g, '-').replace(/_/g, '-')}`,
    /** External / dev-plugin dynamic UI (auth + optional iframe/tool detail) */
    externalNative: (pluginSlug: string) =>
      `/plugins/external-plugins/${pluginSlug.replace(/\./g, '-').replace(/_/g, '-')}`,
    fileMeta: '/plugins/external-plugins/file-meta',
    imageOcr: '/plugins/external-plugins/image-ocr',
  },

  // ==========================================
  // Graph Explorer â€” Knowledge Graph
  // ==========================================
  graphExplorer: '/graph-explorer',

  // ==========================================
  // Geo-Location & Maps
  // ==========================================
  /** Canonical native plugin UIs */
  geoLocation: '/plugins/external-plugins/geo-location',
  offlineMap: '/plugins/external-plugins/offline-map',
  /** Legacy full standalone apps (iframe); set NEXT_PUBLIC_STANDALONE_MAP_APP_ORIGIN */
  geoLocationOld: '/plugins/external-plugins/geo-location-old',
  offlineMapOld: '/plugins/external-plugins/offline-map-old',

  // ==========================================
  // Admin Panel (statistics + settings)
  // ==========================================
  adminPanel: {
    root: '/admin-panel',
    statistics: '/admin-panel/statistics',
    settings: '/admin-panel/settings',
    settingsTab: (tab: 'registration' | 'system' | 'llm' | 'appearance') =>
      `/admin-panel/settings/${tab}`,
  },

  // ==========================================
  // Administration
  // ==========================================
  admin: {
    dashboard: '/admin/dashboard',
    widgets: '/admin/widgets',
    widgetDetail: (widgetId: string) => `/admin/widgets/${widgetId}`,
    /** @deprecated use adminPanel.statistics */
    stats: '/admin-panel/statistics',
    statistics: '/admin-panel/statistics',
    settings: '/admin-panel/settings',
    settingsTab: (tab: 'registration' | 'system' | 'llm' | 'appearance') =>
      `/admin-panel/settings/${tab}`,
    permissions: '/admin/permissions',
    gpu: '/admin/gpu',
    activityLog: '/admin/activity-log',
    sessions: '/admin/sessions',
    security: '/admin/security',
    llmRouting: '/admin/llm-routing',
    pipeline: '/admin/pipeline',
    nodes: '/admin/nodes',
    workflows: '/admin/workflows',
  },
  rolesPermissions: '/roles-permissions',

  // ==========================================
  // Workspace (user-facing group settings)
  // ==========================================
  workspace: {
    hub: (id: string) => `/workspace/${id}`,
    preferences: '/workspace/preferences',
    settings: (id: string, tab?: string) =>
      tab ? `/workspace/${id}/settings/${tab}` : `/workspace/${id}/settings`,
    inviteAccept: (token: string) => `/invite/${token}`,
  },

  // ==========================================
  // User Profile & Settings
  // ==========================================
  account: {
    profile: '/account/profile',
    security: '/account/security',
    activity: '/account/activity',
  },
  profile: '/profile',
  forms: {
    profileSettings: '/forms/profile-settings',
    notificationPreference: '/forms/profile-settings/notification',
    personalInformation: '/forms/profile-settings/profile',
    newsletter: '/forms/newsletter',
  },

  // ==========================================
  // Legacy Template Routes (kept for compatibility)
  // ==========================================
  eCommerce: {
    dashboard: '/ecommerce',
    products: '/ecommerce/products',
    createProduct: '/ecommerce/products/create',
    productDetails: (slug: string) => `/ecommerce/products/${slug}`,
    ediProduct: (slug: string) => `/ecommerce/products/${slug}/edit`,
    categories: '/ecommerce/categories',
    createCategory: '/ecommerce/categories/create',
    editCategory: (id: string) => `/ecommerce/categories/${id}/edit`,
    orders: '/ecommerce/orders',
    createOrder: '/ecommerce/orders/create',
    orderDetails: (id: string) => `/ecommerce/orders/${id}`,
    editOrder: (id: string) => `/ecommerce/orders/${id}/edit`,
    reviews: '/ecommerce/reviews',
    shop: '/ecommerce/shop',
    cart: '/ecommerce/cart',
    checkout: '/ecommerce/checkout',
    trackingId: (id: string) => `/ecommerce/tracking/${id}`,
  },
  searchAndFilter: {
    realEstate: '/search/real-estate',
    nft: '/search/nft',
    flight: '/search/flight',
  },
  support: {
    dashboard: '/support',
    inbox: '/support/inbox',
    supportCategory: (category: string) => `/support/inbox/${category}`,
    messageDetails: (id: string) => `/support/inbox/${id}`,
    snippets: '/support/snippets',
    createSnippet: '/support/snippets/create',
    viewSnippet: (id: string) => `/support/snippets/${id}`,
    editSnippet: (id: string) => `/support/snippets/${id}/edit`,
    templates: '/support/templates',
    createTemplate: '/support/templates/create',
    viewTemplate: (id: string) => `/support/templates/${id}`,
    editTemplate: (id: string) => `/support/templates/${id}/edit`,
  },
  logistics: {
    dashboard: '/logistics',
    shipmentList: '/logistics/shipments',
    customerProfile: '/logistics/customer-profile',
    createShipment: '/logistics/shipments/create',
    editShipment: (id: string) => `/logistics/shipments/${id}/edit`,
    shipmentDetails: (id: string) => `/logistics/shipments/${id}`,
    tracking: (id: string) => `/logistics/tracking/${id}`,
  },
  appointment: {
    dashboard: '/appointment',
    appointmentList: '/appointment/list',
  },
  crm: {
    dashboard: '/crm',
  },
  affiliate: {
    dashboard: '/logo.png',
  },
  executive: {
    dashboard: '/executive',
  },
  project: {
    dashboard: '/project',
  },
  socialMedia: {
    dashboard: '/social-media',
  },
  jobBoard: {
    dashboard: '/job-board',
    jobFeed: '/job-board/feed',
  },
  analytics: '/analytics',
  financial: {
    dashboard: '/financial',
  },
  file: {
    dashboard: '/file',
    manager: '/file-manager',
    upload: '/file-manager/upload',
    create: '/file-manager/create',
  },
  pos: {
    index: '/point-of-sale',
  },
  invoice: {
    home: '/invoice',
    create: '/invoice/create',
    details: (id: string) => `/invoice/${id}`,
    edit: (id: string) => `/invoice/${id}/edit`,
    builder: '/invoice/builder',
  },
  widgets: {
    cards: '/widgets/cards',
    icons: '/widgets/icons',
    charts: '/widgets/charts',
    maps: '/widgets/maps',
    banners: '/widgets/banners',
  },
  tables: {
    basic: '/tables/basic',
    collapsible: '/tables/collapsible',
    enhanced: '/tables/enhanced',
    pagination: '/tables/pagination',
    search: '/tables/search',
    stickyHeader: '/tables/sticky-header',
    resizable: '/tables/resizable',
    pinning: '/tables/pinning',
    dnd: '/tables/dnd',
  },
  multiStep: '/multi-step',
  emailTemplates: '/email-templates',
  welcome: '/welcome',
  comingSoon: '/coming-soon',
  accessDenied: '/access-denied',
  notFound: '/not-found',
  maintenance: '/maintenance',
  blank: '/blank',
  legal: {
    terms: '/legal/terms',
    privacy: '/legal/privacy',
    help: '/legal/help',
  },
  auth: {
    signUp1: '/auth/sign-up-1',
    signUp2: '/auth/sign-up-2',
    signUp3: '/auth/sign-up-3',
    /** Primary app sign-up. */
    signUp: '/auth/sign-up',
    signUp4: '/auth/sign-up',
    signUp5: '/auth/sign-up-5',
    /** Primary app login (credentials). */
    signIn: '/auth/sign-in',
    signIn1: '/auth/sign-in-1',
    signIn2: '/auth/sign-in-2',
    signIn3: '/auth/sign-in-3',
    signIn5: '/auth/sign-in-5',
    forgotPassword1: '/auth/forgot-password-1',
    forgotPassword2: '/auth/forgot-password-2',
    forgotPassword3: '/auth/forgot-password-3',
    /** Primary app forgot-password flow. */
    forgotPassword: '/auth/forgot-password',
    forgotPassword4: '/auth/forgot-password',
    forgotPassword5: '/auth/forgot-password-5',
    otp1: '/auth/otp-1',
    otp2: '/auth/otp-2',
    otp3: '/auth/otp-3',
    otp4: '/auth/otp-4',
    otp5: '/auth/otp-5',
  },
  signIn: '/auth/sign-in',
};
