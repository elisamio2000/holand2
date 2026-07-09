// ============================================
// JsonViewer — Collapsible JSON tree viewer
// Renders JSON data as an interactive tree with syntax highlighting
// ============================================

'use client';

import { useState, useMemo } from 'react';
import { PiCaretRight, PiCaretDown } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface JsonViewerProps {
  /** JSON string or object */
  data: string | object;
}

/**
 * JsonViewer — Interactive JSON tree viewer component.
 *
 * Features:
 * - Collapsible nested objects/arrays
 * - Syntax highlighting for types (string, number, boolean, null)
 * - Tree structure with indentation
 * - Click to expand/collapse nodes
 *
 * @example
 * ```tsx
 * <JsonViewer data={jsonString} />
 * <JsonViewer data={jsonObject} />
 * ```
 */
export default function JsonViewer({ data }: JsonViewerProps) {
  const parsedData = useMemo(() => {
    console.info('[JsonViewer] Parsing JSON data');
    try {
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
      console.error('[JsonViewer] Failed to parse JSON:', err);
      return null;
    }
  }, [data]);

  if (!parsedData) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        Invalid JSON data
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-100/70">
      <JsonNode data={parsedData} name="" level={0} />
    </div>
  );
}

interface JsonNodeProps {
  /** Node value */
  data: unknown;
  /** Property name */
  name: string;
  /** Indentation level */
  level: number;
}

/**
 * JsonNode — Recursive component for rendering JSON nodes.
 *
 * Handles objects, arrays, and primitive types with collapsible UI.
 */
function JsonNode({ data, name, level }: JsonNodeProps) {
  const [collapsed, setCollapsed] = useState(level > 2); // Auto-collapse deep levels

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  const isArray = Array.isArray(data);
  const isExpandable = isObject || isArray;

  const renderValue = (value: unknown) => {
    if (value === null) {
      return <span className="text-purple-600 dark:text-purple-400">null</span>;
    }
    if (typeof value === 'boolean') {
      return <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-orange-600 dark:text-orange-400">{value}</span>;
    }
    if (typeof value === 'string') {
      return <span className="text-green-600 dark:text-green-400">&quot;{value}&quot;</span>;
    }
    return <span className="text-gray-500">undefined</span>;
  };

  const getPreview = () => {
    if (isArray) return `Array[${data.length}]`;
    if (isObject) return `Object{${Object.keys(data as Record<string, unknown>).length}}`;
    return '';
  };

  if (!isExpandable) {
    return (
      <div className="leading-relaxed" style={{ paddingLeft: `${level * 16}px` }}>
        {name && (
          <span className="text-blue-700 dark:text-blue-300">{name}: </span>
        )}
        {renderValue(data)}
      </div>
    );
  }

  const entries = isArray
    ? (data as unknown[]).map((item, idx) => [String(idx), item] as [string, unknown])
    : Object.entries(data as Record<string, unknown>);

  return (
    <div style={{ paddingLeft: level > 0 ? `${level * 16}px` : '0' }}>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-1 leading-relaxed hover:bg-gray-100/50 dark:hover:bg-gray-200/10',
          collapsed && 'mb-1'
        )}
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <PiCaretRight className="h-3 w-3 flex-shrink-0 text-gray-400" />
        ) : (
          <PiCaretDown className="h-3 w-3 flex-shrink-0 text-gray-400" />
        )}
        {name && (
          <span className="text-blue-700 dark:text-blue-300">{name}: </span>
        )}
        <span className="text-gray-600">
          {isArray ? '[' : '{'}
        </span>
        {collapsed && (
          <span className="text-xs text-gray-400">{getPreview()}</span>
        )}
      </div>

      {!collapsed && (
        <>
          {entries.map(([key, value]) => (
            <JsonNode key={key} data={value} name={key} level={level + 1} />
          ))}
          <div style={{ paddingLeft: `${(level + 1) * 16}px` }}>
            <span className="text-gray-600">
              {isArray ? ']' : '}'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
