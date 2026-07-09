/** Section keys for each legal/help document type. */
export const LEGAL_DOCUMENT_SECTION_KEYS = {
  terms: [
    'acceptance',
    'service',
    'accounts',
    'acceptableUse',
    'dataAndContent',
    'modelImprovement',
    'intellectualProperty',
    'availability',
    'liability',
    'changes',
    'contact',
  ],
  privacy: [
    'collection',
    'use',
    'modelTraining',
    'retention',
    'security',
    'sharing',
    'rights',
    'transfers',
    'children',
    'changes',
    'contact',
  ],
  help: [
    'gettingStarted',
    'signIn',
    'signUp',
    'forgotPassword',
    'language',
    'support',
    'security',
  ],
} as const;

export type LegalDocumentType = keyof typeof LEGAL_DOCUMENT_SECTION_KEYS;
