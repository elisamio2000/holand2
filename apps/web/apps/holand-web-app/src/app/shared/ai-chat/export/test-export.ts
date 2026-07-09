// ============================================
// Export Test Utility — Quick test for export functionality
// ============================================

import { exportConversation } from '../index';
import type { ConversationExportData, ExportFormat } from '../export-types';

/**
 * Create mock conversation data for testing
 */
function createMockConversationData(): ConversationExportData {
  return {
    sessionId: 'test-session-123',
    title: 'Test Conversation - Export Demo',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello! Can you help me test the export feature?',
        timestamp: new Date('2026-06-06T10:00:00Z').toISOString(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: `Of course! I'd be happy to help test the export feature.

Here's what we can test:

## Features to Test

1. **Text Formatting**
   - **Bold text**
   - *Italic text*
   - \`Inline code\`

2. **Code Blocks**

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet('World');
\`\`\`

3. **Lists**
   - Item 1
   - Item 2
   - Item 3

4. **Links**
Visit [Google](https://google.com) for more information.`,
        thinking: 'I need to provide a comprehensive test that covers all formatting features...',
        toolRuns: [
          {
            id: 'tool-1',
            name: 'search',
            status: 'completed',
          },
        ],
        timestamp: new Date('2026-06-06T10:01:00Z').toISOString(),
        processingTime: 1.5,
        totalTokens: 245,
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Perfect! Now let me try exporting this conversation.',
        timestamp: new Date('2026-06-06T10:02:00Z').toISOString(),
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content: `Great! When you export, you'll see all of this content formatted properly in your chosen format.

### What Gets Preserved

- ✅ Text formatting (bold, italic, code)
- ✅ Code blocks with syntax highlighting
- ✅ Lists and headings
- ✅ Links
- ✅ Thinking process (optional)
- ✅ Tool runs (optional)
- ✅ Timestamps and metadata

The export will look professional in all formats!`,
        thinking: 'Need to explain what will be preserved in the export...',
        toolRuns: [
          {
            id: 'tool-2',
            name: 'format_check',
            status: 'completed',
          },
        ],
        timestamp: new Date('2026-06-06T10:03:00Z').toISOString(),
        feedback: 'like',
        processingTime: 2.1,
        totalTokens: 189,
      },
    ],
    metadata: {
      exportedAt: new Date().toISOString(),
      totalMessages: 4,
      model: 'gpt-4',
    },
  };
}

/**
 * Test export functionality for all formats
 */
export async function testAllFormats() {
  const mockData = createMockConversationData();
  const formats: ExportFormat[] = ['md', 'json', 'html', 'pdf', 'docx'];
  
  console.log('🧪 Starting Export Tests...\n');
  
  for (const format of formats) {
    try {
      console.log(`📝 Testing ${format.toUpperCase()} export...`);
      
      // Mock the fetch function to return our test data
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      });
      
      const result = await exportConversation('test-session-123', {
        format,
        includeMetadata: true,
        includeThinking: true,
        includeToolRuns: true,
        includeArtifacts: true,
        stylesPreset: 'standard',
      });
      
      if (result.success) {
        console.log(`   ✅ ${format.toUpperCase()} export successful: ${result.filename}`);
      } else {
        console.error(`   ❌ ${format.toUpperCase()} export failed: ${result.error}`);
      }
    } catch (error) {
      console.error(`   ❌ ${format.toUpperCase()} error:`, error);
    }
    
    console.log('');
  }
  
  console.log('✨ Tests complete!');
}

/**
 * Test individual format
 */
export async function testFormat(format: ExportFormat) {
  const mockData = createMockConversationData();
  
  console.log(`\n🧪 Testing ${format.toUpperCase()} Export\n`);
  
  // Mock fetch
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockData,
  });
  
  const result = await exportConversation('test-session-123', {
    format,
    includeMetadata: true,
    includeThinking: true,
    includeToolRuns: true,
    includeArtifacts: true,
    stylesPreset: 'standard',
  });
  
  console.log('📊 Result:', result);
  
  if (result.success) {
    console.log(`\n✅ Export successful!`);
    console.log(`📄 Filename: ${result.filename}`);
  } else {
    console.error(`\n❌ Export failed!`);
    console.error(`Error: ${result.error}`);
  }
}

// Usage examples:
// testAllFormats();
// testFormat('pdf');
