# AI Chat Export Module

This module provides comprehensive export functionality for AI chat conversations in multiple formats.

## 🚀 Quick Start

```typescript
import { exportConversation } from '@/app/shared/ai-chat/export';

// Export to PDF
await exportConversation(sessionId, {
  format: 'pdf',
  includeMetadata: true,
  includeThinking: true,
});
```

## 📁 Module Structure

```
export/
├── exporters/          # Format-specific exporters
├── utils/              # Helper utilities
├── export-types.ts     # TypeScript definitions
├── export-menu.tsx     # UI component
├── index.ts            # Main entry point
└── test-export.ts      # Test utilities
```

## 📦 Supported Formats

| Format | Description | Requires |
|--------|-------------|----------|
| `.md` | Markdown | None |
| `.json` | JSON | None |
| `.html` | HTML | None |
| `.pdf` | PDF | pdfmake |
| `.docx` | Word | docshift |

## 🔧 Installation

```bash
npm install pdfmake docshift
```

## 📖 Documentation

- Full Implementation: `docs/AI-CHAT-EXPORT-IMPLEMENTATION-PLAN.md`
- User Guide (FA): `docs/AI-CHAT-EXPORT-USER-GUIDE-FA.md`
- Summary: `docs/AI-CHAT-EXPORT-SUMMARY.md`

## 🧪 Testing

```typescript
import { testFormat } from './test-export';

// Test PDF export
testFormat('pdf');
```

## 🎯 Features

✅ Fully offline (no external APIs)  
✅ Preserves all formatting and styles  
✅ Supports RTL/LTR text  
✅ Includes thinking process  
✅ Includes tool runs  
✅ Includes attachments  
✅ Loading states and error handling

## 📝 Usage

### UI Component

```tsx
import ExportMenu from '@/app/shared/ai-chat/export/export-menu';

<ExportMenu sessionId={sessionId} sessionTitle={title} />
```

### Programmatic

```typescript
import { exportConversation } from '@/app/shared/ai-chat/export';

const result = await exportConversation(sessionId, options);
if (result.success) {
  console.log(`Exported: ${result.filename}`);
}
```

## ⚙️ Options

```typescript
{
  format: 'md' | 'json' | 'pdf' | 'docx' | 'html',
  includeMetadata?: boolean,
  includeThinking?: boolean,
  includeToolRuns?: boolean,
  includeArtifacts?: boolean,
  stylesPreset?: 'compact' | 'standard' | 'detailed',
}
```

## 🔒 Security

- ✅ Authentication check
- ✅ Authorization validation
- ✅ Input sanitization
- ⚠️ Add rate limiting (recommended)

## 📞 Support

Issues? Check:
1. Browser console
2. Network tab
3. Dependencies installed
4. API endpoint configured

---

**Version:** 1.0.0  
**Last Updated:** 2026-06-06
