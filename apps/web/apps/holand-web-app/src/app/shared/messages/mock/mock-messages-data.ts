// ============================================
// User Messenger — sample data (OpenAPI-shaped)
// ============================================

import type {
  MessageDetail,
  MessageFolder,
  MessageItem,
  MessagePriority,
} from '@/types/messages.types';

export const MOCK_CURRENT_USER_ID = 'user-self';

const USERS = {
  self: { id: MOCK_CURRENT_USER_ID, name: 'You', email: 'you@example.com' },
  sara: { id: 'user-sara', name: 'Sara Ahmadi', email: 'sara@example.com' },
  reza: { id: 'user-reza', name: 'Reza Karimi', email: 'reza@example.com' },
  admin: { id: 'user-admin', name: 'Admin Team', email: 'admin@example.com' },
  support: {
    id: 'user-support',
    name: 'Support Team',
    email: 'support@example.com',
  },
} as const;

export const MOCK_SUPPORT_USER_ID = USERS.support.id;

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function buildItem(partial: {
  id: string;
  from: (typeof USERS)[keyof typeof USERS];
  to: (typeof USERS)[keyof typeof USERS];
  subject: string;
  preview: string;
  body?: string;
  read: boolean;
  priority?: MessagePriority;
  folder: MessageFolder;
  created_at: string;
  reply_count?: number;
  thread_root_id?: string;
  attachments?: MessageItem['attachments'];
  content_type?: MessageItem['content_type'];
  voice_duration_ms?: number;
  delivery_status?: MessageItem['delivery_status'];
}): MessageItem {
  return {
    priority: 'normal',
    ...partial,
  };
}

/** Seed inbox/sent/drafts/archived/trash + thread replies (mutable at runtime). */
export function createMockMessageStore(): {
  messages: Map<string, MessageDetail>;
  replies: Map<string, MessageItem[]>;
} {
  const messages = new Map<string, MessageDetail>();
  const replies = new Map<string, MessageItem[]>();

  const msg1 = buildItem({
    id: 'msg-001',
    from: USERS.sara,
    to: USERS.self,
    subject: 'Q2 report review',
    preview: 'Please review the attached draft before Friday…',
    body: '<p>Hi,</p><p>Please review the attached Q2 report draft before <strong>Friday</strong>. Let me know if the revenue section needs changes.</p>',
    read: false,
    priority: 'high',
    folder: 'inbox',
    created_at: hoursAgo(2),
    reply_count: 7,
    thread_root_id: 'msg-001',
    attachments: [
      {
        id: 'art-q2-report',
        name: 'Q2-report-draft.pdf',
        size: 245_000,
        mime_type: 'application/pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      },
    ],
  });

  const msg2 = buildItem({
    id: 'msg-002',
    from: USERS.reza,
    to: USERS.self,
    subject: 'Meeting tomorrow at 10:00',
    preview: 'Can we sync on the pipeline migration plan?',
    body: '<p>Can we sync tomorrow at 10:00 on the pipeline migration plan?</p>',
    read: false,
    folder: 'inbox',
    created_at: hoursAgo(5),
    reply_count: 2,
    thread_root_id: 'msg-002',
  });

  const msg3 = buildItem({
    id: 'msg-003',
    from: USERS.self,
    to: USERS.sara,
    subject: 'Re: Budget approval',
    preview: 'Approved — proceed with phase 2.',
    body: '<p>Approved — proceed with phase 2.</p>',
    read: true,
    folder: 'sent',
    created_at: daysAgo(1),
  });

  const msg4 = buildItem({
    id: 'msg-004',
    from: USERS.self,
    to: USERS.admin,
    subject: 'Draft: Access request',
    preview: 'Requesting viewer role for case team…',
    body: '<p>Requesting viewer role for case team…</p>',
    read: true,
    folder: 'drafts',
    created_at: hoursAgo(12),
  });

  const msg5 = buildItem({
    id: 'msg-005',
    from: USERS.admin,
    to: USERS.self,
    subject: 'Scheduled maintenance',
    preview: 'Gateway maintenance window this Sunday.',
    body: '<p>Gateway maintenance window this Sunday 02:00–04:00 UTC.</p>',
    read: true,
    folder: 'archived',
    created_at: daysAgo(3),
  });

  const msg6 = buildItem({
    id: 'msg-006',
    from: USERS.support,
    to: USERS.self,
    subject: 'Support — how can we help?',
    preview: 'Hi! I am your support agent. Describe the issue and we will help.',
    body: '<p>Hi!</p><p>I am your dedicated support agent. Describe any issue and we will help you right away.</p>',
    read: false,
    folder: 'inbox',
    created_at: hoursAgo(0.25),
    reply_count: 1,
    thread_root_id: 'msg-006',
  });

  [msg1, msg2, msg3, msg4, msg5, msg6].forEach((m) => {
    messages.set(m.id, { ...m, body: m.body ?? m.preview });
  });

  replies.set('msg-006', [
    buildItem({
      id: 'reply-support-001',
      from: USERS.support,
      to: USERS.self,
      subject: 'Re: Support — how can we help?',
      preview: 'You can also attach screenshots from the bug reporter.',
      body: '<p>You can also attach screenshots from the bug reporter if something looks wrong in the UI.</p>',
      read: false,
      folder: 'inbox',
      created_at: hoursAgo(0.1),
      thread_root_id: 'msg-006',
    }),
  ]);

  replies.set('msg-001', [
    buildItem({
      id: 'reply-001',
      from: USERS.sara,
      to: USERS.self,
      subject: 'Re: Q2 report review',
      preview: 'Thanks — I updated the revenue table.',
      body: '<p>Thanks — I updated the revenue table in section 3.</p>',
      read: true,
      folder: 'inbox',
      created_at: hoursAgo(1),
      thread_root_id: 'msg-001',
    }),
    buildItem({
      id: 'reply-002',
      from: USERS.self,
      to: USERS.sara,
      subject: 'Re: Q2 report review',
      preview: 'Looks good. One note on margins…',
      body: '<p>Looks good. One note on margins in page 12 — can you double-check?</p>',
      read: true,
      folder: 'sent',
      created_at: hoursAgo(0.5),
      thread_root_id: 'msg-001',
      delivery_status: 'read',
    }),
    buildItem({
      id: 'reply-003-voice',
      from: USERS.sara,
      to: USERS.self,
      subject: 'Re: Q2 report review',
      preview: '🎤 Voice message (0:12)',
      body: '<p>Voice note attached</p>',
      read: true,
      folder: 'inbox',
      created_at: hoursAgo(0.3),
      thread_root_id: 'msg-001',
      content_type: 'voice',
      voice_duration_ms: 12000,
      attachments: [
        {
          id: 'art-voice-001',
          name: 'voice-note.webm',
          size: 48_000,
          mime_type: 'audio/webm',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
        },
      ],
    }),
    buildItem({
      id: 'reply-004-image',
      from: USERS.sara,
      to: USERS.self,
      subject: 'Re: Q2 report review',
      preview: 'Screenshot of chart',
      body: '<p>Here is the updated chart</p>',
      read: true,
      folder: 'inbox',
      created_at: hoursAgo(0.2),
      thread_root_id: 'msg-001',
      content_type: 'image',
      attachments: [
        {
          id: 'art-img-001',
          name: 'chart-preview.png',
          size: 120_000,
          mime_type: 'image/png',
          url: 'https://placehold.co/400x240/png?text=Chart+Preview',
        },
      ],
    }),
    buildItem({
      id: 'reply-005-video',
      from: USERS.sara,
      to: USERS.self,
      subject: 'Re: Q2 report review',
      preview: '🎬 Walkthrough video',
      body: '<p>Quick screen recording of the dashboard</p>',
      read: true,
      folder: 'inbox',
      created_at: hoursAgo(0.15),
      thread_root_id: 'msg-001',
      content_type: 'video',
      attachments: [
        {
          id: 'art-vid-001',
          name: 'dashboard-walkthrough.mp4',
          size: 2_400_000,
          mime_type: 'video/mp4',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        },
      ],
    }),
    buildItem({
      id: 'reply-006-file',
      from: USERS.self,
      to: USERS.sara,
      subject: 'Re: Q2 report review',
      preview: '📎 Updated spreadsheet',
      body: '<p>Attached the revised numbers</p>',
      read: true,
      folder: 'sent',
      created_at: hoursAgo(0.12),
      thread_root_id: 'msg-001',
      content_type: 'file',
      delivery_status: 'delivered',
      attachments: [
        {
          id: 'art-xlsx-001',
          name: 'Q2-revenue-v2.xlsx',
          size: 89_000,
          mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          url: 'https://go.microsoft.com/fwlink/?LinkId=521962',
        },
      ],
    }),
    buildItem({
      id: 'reply-007-audio',
      from: USERS.sara,
      to: USERS.self,
      subject: 'Re: Q2 report review',
      preview: '🎵 Audio note',
      body: '<p>Voice comment on section 4</p>',
      read: true,
      folder: 'inbox',
      created_at: hoursAgo(0.08),
      thread_root_id: 'msg-001',
      content_type: 'audio',
      attachments: [
        {
          id: 'art-audio-001',
          name: 'comment-section4.mp3',
          size: 156_000,
          mime_type: 'audio/mpeg',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
        },
      ],
    }),
  ]);

  replies.set('msg-002', [
    buildItem({
      id: 'reply-reza-001',
      from: USERS.reza,
      to: USERS.self,
      subject: 'Re: Meeting tomorrow',
      preview: 'Architecture diagram attached',
      body: '<p>See the migration diagram below</p>',
      read: false,
      folder: 'inbox',
      created_at: hoursAgo(4.5),
      thread_root_id: 'msg-002',
      content_type: 'image',
      attachments: [
        {
          id: 'art-diag-001',
          name: 'pipeline-diagram.png',
          size: 340_000,
          mime_type: 'image/png',
          url: 'https://placehold.co/480x320/png?text=Pipeline+Diagram',
        },
      ],
    }),
    buildItem({
      id: 'reply-reza-002',
      from: USERS.self,
      to: USERS.reza,
      subject: 'Re: Meeting tomorrow',
      preview: 'Looks good — see recording',
      body: '<p>Recording from yesterday sync</p>',
      read: true,
      folder: 'sent',
      created_at: hoursAgo(4.2),
      thread_root_id: 'msg-002',
      content_type: 'video',
      delivery_status: 'read',
      attachments: [
        {
          id: 'art-vid-reza',
          name: 'sync-recording.webm',
          size: 1_800_000,
          mime_type: 'video/webm',
          url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        },
      ],
    }),
  ]);

  return { messages, replies };
}
