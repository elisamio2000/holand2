// ============================================
// Graph Data Parsers — Multi-format graph data ingestion
// Converts JSON, CSV, and text files into GraphData format
// ============================================

import type {
  GraphData,
  GraphNode,
  GraphLink,
  RawGraphData,
  EntityType,
  RelationType,
  Community,
  GraphStats,
} from '@/types/graph-explorer.types';
import { transformRawToGraphData } from '@/services/graph-explorer.service';
import { normalizeNeo4jExportPayload } from '@/services/graph-payload-normalize';
import { getCommunityColor } from '@/config/graph-config';

// ─── Supported File Types ─────────────────────────────────────────────────────

/** File formats accepted by the graph data connector */
export type SupportedFileFormat = 'json' | 'csv' | 'tsv' | 'text' | 'graphml' | 'gexf' | 'xlsx' | 'xls';

/** Result of a parse operation */
export interface ParseResult {
  success: boolean;
  data: GraphData | null;
  error?: string;
  /** Number of nodes parsed */
  nodeCount: number;
  /** Number of links parsed */
  linkCount: number;
  /** Source format detected */
  format: SupportedFileFormat | 'unknown';
  /** Warnings during parsing (non-fatal) */
  warnings: string[];
}

// ─── CSV Format Templates ─────────────────────────────────────────────────────

/** Unique identifier for each CSV format template */
export type CsvFormatTemplateId = 'auto' | 'call_record' | 'sms_record';

/** Describes a predefined CSV column mapping & parsing strategy */
export interface CsvFormatTemplate {
  id: CsvFormatTemplateId;
  /** i18n key for the template name shown in UI */
  labelKey: string;
  /** i18n key for the short description shown in UI */
  descriptionKey: string;
  /** Example header row shown in UI to help users identify the format */
  exampleHeader: string;
  /** Icon name hint for UI (react-icons/pi) */
  icon: 'auto' | 'phone' | 'table' | 'chat';
}

/** Registry of all available CSV format templates */
export const CSV_FORMAT_TEMPLATES: CsvFormatTemplate[] = [
  {
    id: 'auto',
    labelKey: 'graphExplorer.dataSource.formatAuto',
    descriptionKey: 'graphExplorer.dataSource.formatAutoDesc',
    exampleHeader: 'source,target,relation | id,label,type',
    icon: 'auto',
  },
  {
    id: 'call_record',
    labelKey: 'graphExplorer.dataSource.formatCallRecord',
    descriptionKey: 'graphExplorer.dataSource.formatCallRecordDesc',
    exampleHeader: 'Id,Type,Number,Name,DateTime,Duration,Location',
    icon: 'phone',
  },
  {
    id: 'sms_record',
    labelKey: 'graphExplorer.dataSource.formatSmsRecord',
    descriptionKey: 'graphExplorer.dataSource.formatSmsRecordDesc',
    exampleHeader: 'Id,Type,Address,Person,Body,Date,Status,Read',
    icon: 'chat',
  },
];

// ─── Detect Format ────────────────────────────────────────────────────────────

/**
 * Detect file format from extension or content sniffing.
 *
 * @param filename - Name of the file
 * @param content - Raw file content (first 500 chars used for sniffing)
 * @returns Detected format
 */
export function detectFormat(filename: string, content: string): SupportedFileFormat | 'unknown' {
  const ext = filename.split('.').pop()?.toLowerCase();

  if (ext === 'json' || ext === 'geojson') return 'json';
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv') return 'tsv';
  if (ext === 'txt' || ext === 'text') return 'text';
  if (ext === 'graphml' || ext === 'xml') return 'graphml';
  if (ext === 'gexf') return 'gexf';
  if (ext === 'xlsx' || ext === 'xlsm' || ext === 'xlsb') return 'xlsx';
  if (ext === 'xls') return 'xls';

  // Content sniffing fallback
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.includes('\t') && trimmed.split('\n')[0].split('\t').length > 2) return 'tsv';
  if (trimmed.includes(',') && trimmed.split('\n')[0].split(',').length > 2) return 'csv';

  return 'text';
}

// ─── Main Parser Entry Point ──────────────────────────────────────────────────

/**
 * Parse file content into GraphData based on detected or specified format.
 *
 * @param content - Raw file text content
 * @param filename - Original filename (used for format detection)
 * @param format - Explicit format override (optional)
 * @param csvTemplate - CSV format template ID; when not 'auto', bypasses auto-detect for CSV/TSV
 * @returns ParseResult with graph data or error
 */
export function parseGraphFile(
  content: string,
  filename: string,
  format?: SupportedFileFormat,
  csvTemplate: CsvFormatTemplateId = 'auto'
): ParseResult {
  const detectedFormat = format || detectFormat(filename, content);
  console.info('[GraphParser] Parsing file:', { filename, format: detectedFormat, csvTemplate });

  try {
    switch (detectedFormat) {
      case 'json':
        return parseJsonGraph(content);
      case 'csv':
      case 'xlsx':
      case 'xls':
        // Excel files are pre-converted to CSV by readGraphDataFile
        return parseCsvGraph(content, ',', csvTemplate);
      case 'tsv':
        return parseCsvGraph(content, '\t', csvTemplate);
      case 'text':
        return parseTextGraph(content);
      default:
        return {
          success: false,
          data: null,
          error: `Unsupported format: ${detectedFormat}`,
          nodeCount: 0,
          linkCount: 0,
          format: detectedFormat,
          warnings: [],
        };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown parse error';
    console.error('[GraphParser] Parse failed:', { filename, error: msg });
    return {
      success: false,
      data: null,
      error: msg,
      nodeCount: 0,
      linkCount: 0,
      format: detectedFormat,
      warnings: [],
    };
  }
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

/**
 * Parse JSON content into GraphData.
 *
 * Supports multiple JSON structures:
 * 1. Neo4j Export: {nodes: [...], relationships: [...]}
 * 2. RawGraphData (backend format with entities/relationships)
 * 3. GraphData (frontend format with nodes/links)
 * 4. Simple {nodes, edges} format
 * 5. D3 format {nodes, links}
 * 6. Array of edges [{source, target, ...}]
 *
 * @param content - Raw JSON string
 * @returns ParseResult
 */
function parseJsonGraph(content: string): ParseResult {
  const warnings: string[] = [];
  const parsed = JSON.parse(content) as Record<string, any> | Array<Record<string, any>>;

  // ── Check for nested rawdata structure ──
  // WHY support array-wrapped payloads:
  // some exports provide [{ nodes, relationships, ... }] instead of an object root.
  const firstObject = Array.isArray(parsed)
    ? (parsed.find((x) => x && typeof x === 'object') as Record<string, any> | undefined)
    : undefined;
  const data: any = (firstObject?.rawdata ?? firstObject) ?? ((parsed as any).rawdata ?? parsed);

  // ── Format 0: Neo4j Export Format ──
  // WHY: Direct Neo4j database exports have {nodes: [...], relationships: [...]}
  // with identity/labels/properties structure, not our RawEntity/RawRelationship format
  if (data.nodes && Array.isArray(data.nodes) && data.relationships && Array.isArray(data.relationships)) {
    console.info('[GraphParser] Detected Neo4j export format');
    try {
      const rawData = normalizeNeo4jExportPayload(data, 'uploaded-file');
      const graphData = transformRawToGraphData(rawData);
      return {
        success: true,
        data: graphData,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
        format: 'json',
        warnings,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to normalize Neo4j export';
      return {
        success: false,
        data: null,
        error: `Neo4j export format error: ${msg}`,
        nodeCount: 0,
        linkCount: 0,
        format: 'json',
        warnings,
      };
    }
  }

  // ── Format 1: RawGraphData (backend format) ──
  if (data.entities && Array.isArray(data.entities) && data.relationships) {
    console.info('[GraphParser] Detected RawGraphData format');
    const graphData = transformRawToGraphData(data as RawGraphData);
    return {
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      format: 'json',
      warnings,
    };
  }

  // ── Format 2: GraphData (frontend format) ──
  if (data.nodes && Array.isArray(data.nodes) && data.links && Array.isArray(data.links)) {
    console.info('[GraphParser] Detected GraphData (nodes/links) format');
    const graphData = normalizeGraphData(data.nodes, data.links, data.communities, warnings);
    return {
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      format: 'json',
      warnings,
    };
  }

  // ── Format 3: {nodes, edges} format ──
  if (data.nodes && Array.isArray(data.nodes) && data.edges && Array.isArray(data.edges)) {
    console.info('[GraphParser] Detected {nodes, edges} format');
    const links = data.edges.map((e: Record<string, unknown>, i: number) => ({
      ...e,
      id: (e.id as string) || `edge_${i}`,
      source: e.source || e.from,
      target: e.target || e.to,
    }));
    const graphData = normalizeGraphData(data.nodes, links, data.communities, warnings);
    return {
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      format: 'json',
      warnings,
    };
  }

  // ── Format 4: Array of edges ──
  if (Array.isArray(data) && data.length > 0 && ((data[0] as any).source || (data[0] as any).from)) {
    console.info('[GraphParser] Detected edge-list array format');
    const { nodes, links } = extractNodesFromEdgeList(data as any, warnings);
    const graphData = normalizeGraphData(nodes, links, [], warnings);
    return {
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      linkCount: graphData.links.length,
      format: 'json',
      warnings,
    };
  }

  // ── Format 5: Array of nodes ──
  if (Array.isArray(data) && data.length > 0 && ((data[0] as any).id || (data[0] as any).name)) {
    console.info('[GraphParser] Detected node-list array format');
    warnings.push('Only nodes found, no relationships detected');
    const graphData = normalizeGraphData(data as any, [], [], warnings);
    return {
      success: true,
      data: graphData,
      nodeCount: graphData.nodes.length,
      linkCount: 0,
      format: 'json',
      warnings,
    };
  }

  return {
    success: false,
    data: null,
    error: 'Unrecognized JSON structure. Expected: {nodes, links}, {entities, relationships}, or edge array.',
    nodeCount: 0,
    linkCount: 0,
    format: 'json',
    warnings,
  };
}

// ─── CSV/TSV Parser ───────────────────────────────────────────────────────────

/**
 * Parse CSV/TSV into GraphData.
 *
 * Supports multiple CSV layouts:
 * 1. Edge list: source,target,relation,weight,...
 * 2. Node list: id,label,type,...
 * 3. Call Record: Id,Type,Number,Name,DateTime,Duration,Location
 * Auto-detects based on header columns, or uses explicit template.
 *
 * @param content - Raw CSV/TSV string
 * @param delimiter - Column delimiter (',' or '\t')
 * @param csvTemplate - Template ID; 'auto' means auto-detect
 * @returns ParseResult
 */
function parseCsvGraph(content: string, delimiter: string, csvTemplate: CsvFormatTemplateId = 'auto'): ParseResult {
  const warnings: string[] = [];
  const lines = content.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    return {
      success: false,
      data: null,
      error: 'CSV file must have at least a header row and one data row.',
      nodeCount: 0,
      linkCount: 0,
      format: delimiter === '\t' ? 'tsv' : 'csv',
      warnings,
    };
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));

  // If a specific template is selected, route to it directly
  if (csvTemplate === 'call_record') {
    console.info('[GraphParser] CSV using call_record template');
    return parseCsvCallRecord(headers, rows, delimiter, warnings);
  }

  if (csvTemplate === 'sms_record') {
    console.info('[GraphParser] CSV using sms_record template');
    return parseCsvSmsRecord(headers, rows, delimiter, warnings);
  }

  // Auto-detect: check for SMS record fingerprint first (before call record)
  if (csvTemplate === 'auto' && detectSmsRecordHeaders(headers)) {
    console.info('[GraphParser] CSV auto-detected as SMS record');
    return parseCsvSmsRecord(headers, rows, delimiter, warnings);
  }

  // Auto-detect: check for call record fingerprint
  if (csvTemplate === 'auto' && detectCallRecordHeaders(headers)) {
    console.info('[GraphParser] CSV auto-detected as call record');
    return parseCsvCallRecord(headers, rows, delimiter, warnings);
  }

  // Detect if this is an edge list or node list
  const hasSource = headers.includes('source') || headers.includes('from');
  const hasTarget = headers.includes('target') || headers.includes('to');
  const isEdgeList = hasSource && hasTarget;

  if (isEdgeList) {
    console.info('[GraphParser] CSV detected as edge list');
    return parseCsvEdgeList(headers, rows, delimiter, warnings);
  }

  // Assume node list
  console.info('[GraphParser] CSV detected as node list');
  return parseCsvNodeList(headers, rows, delimiter, warnings);
}

/**
 * Parse a single CSV line respecting quoted fields.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse CSV edge list into GraphData.
 */
function parseCsvEdgeList(
  headers: string[],
  rows: string[][],
  delimiter: string,
  warnings: string[]
): ParseResult {
  const srcIdx = headers.indexOf('source') !== -1 ? headers.indexOf('source') : headers.indexOf('from');
  const tgtIdx = headers.indexOf('target') !== -1 ? headers.indexOf('target') : headers.indexOf('to');
  const relIdx = headers.indexOf('relation') !== -1 ? headers.indexOf('relation')
    : headers.indexOf('type') !== -1 ? headers.indexOf('type')
    : headers.indexOf('relationship');
  const weightIdx = headers.indexOf('weight') !== -1 ? headers.indexOf('weight') : headers.indexOf('strength');
  const labelIdx = headers.indexOf('label');

  const links: Partial<GraphLink>[] = [];
  const nodeSet = new Set<string>();

  rows.forEach((cols, i) => {
    const source = cols[srcIdx];
    const target = cols[tgtIdx];
    if (!source || !target) {
      warnings.push(`Row ${i + 2}: missing source or target, skipped`);
      return;
    }

    nodeSet.add(source);
    nodeSet.add(target);

    const link: Partial<GraphLink> = {
      id: `csv_edge_${i}`,
      source,
      target,
      relation: (relIdx >= 0 ? cols[relIdx] : 'RELATED_TO') as RelationType,
      strength: weightIdx >= 0 ? parseFloat(cols[weightIdx]) || 5 : 5,
      description: labelIdx >= 0 ? cols[labelIdx] : '',
    };
    links.push(link);
  });

  const nodes: Partial<GraphNode>[] = Array.from(nodeSet).map((name) => ({
    id: name,
    label: name,
    type: 'unknown' as EntityType,
  }));

  const data = normalizeGraphData(nodes, links, [], warnings);
  return {
    success: true,
    data,
    nodeCount: data.nodes.length,
    linkCount: data.links.length,
    format: delimiter === '\t' ? 'tsv' : 'csv',
    warnings,
  };
}

/**
 * Parse CSV node list into GraphData (no edges).
 */
function parseCsvNodeList(
  headers: string[],
  rows: string[][],
  delimiter: string,
  warnings: string[]
): ParseResult {
  const idIdx = headers.indexOf('id') !== -1 ? headers.indexOf('id') : 0;
  const labelIdx = headers.indexOf('label') !== -1 ? headers.indexOf('label')
    : headers.indexOf('name') !== -1 ? headers.indexOf('name') : idIdx;
  const typeIdx = headers.indexOf('type') !== -1 ? headers.indexOf('type')
    : headers.indexOf('entity_type') !== -1 ? headers.indexOf('entity_type') : -1;

  const nodes: Partial<GraphNode>[] = rows.map((cols, i) => {
    const props: Record<string, unknown> = {};
    headers.forEach((h, hIdx) => {
      if (hIdx !== idIdx && hIdx !== labelIdx && hIdx !== typeIdx) {
        props[h] = cols[hIdx];
      }
    });

    return {
      id: cols[idIdx] || `node_${i}`,
      label: cols[labelIdx] || cols[idIdx] || `Node ${i}`,
      type: (typeIdx >= 0 ? cols[typeIdx] : 'unknown') as EntityType,
      properties: props,
    };
  });

  warnings.push('Node list detected — no relationships. Consider uploading an edge list CSV as well.');

  const data = normalizeGraphData(nodes, [], [], warnings);
  return {
    success: true,
    data,
    nodeCount: data.nodes.length,
    linkCount: 0,
    format: delimiter === '\t' ? 'tsv' : 'csv',
    warnings,
  };
}

// ─── Call Record Parser ───────────────────────────────────────────────────────

/** Header keywords that fingerprint a call/SMS record CSV */
const CALL_RECORD_KEYWORDS = {
  type: ['type', 'call type', 'call_type', 'calltype', 'نوع'],
  number: ['number', 'phone', 'phone number', 'phone_number', 'phonenumber', 'شماره'],
  name: ['name', 'contact', 'contact name', 'contact_name', 'نام', 'اسم'],
};

/**
 * Heuristic: does this header row look like a call/SMS record?
 * Requires at least type + number columns.
 */
function detectCallRecordHeaders(headers: string[]): boolean {
  const hasType = headers.some((h) =>
    CALL_RECORD_KEYWORDS.type.some((kw) => h === kw || h.includes(kw))
  );
  const hasNumber = headers.some((h) =>
    CALL_RECORD_KEYWORDS.number.some((kw) => h === kw || h.includes(kw))
  );
  return hasType && hasNumber;
}

/**
 * Find the first matching column index from a set of candidate names.
 */
function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx !== -1) return idx;
  }
  for (const c of candidates) {
    const idx = headers.findIndex((h) => h.includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Parse call/SMS record CSV into a star-topology graph.
 *
 * Graph model:
 *   - One central "Phone Owner" node
 *   - One node per unique contact (Number+Name)
 *   - One link per call row (direction from Type column)
 *   - DateTime, Duration, Location stored as link properties
 */
function parseCsvCallRecord(
  headers: string[],
  rows: string[][],
  delimiter: string,
  warnings: string[]
): ParseResult {
  const typeIdx  = findCol(headers, ['type', 'call type', 'call_type', 'calltype', 'نوع']);
  const numIdx   = findCol(headers, ['number', 'phone', 'phone number', 'phone_number', 'phonenumber', 'شماره']);
  const nameIdx  = findCol(headers, ['name', 'contact', 'contact name', 'contact_name', 'نام', 'اسم']);
  const dateIdx  = findCol(headers, ['datetime', 'date', 'time', 'timestamp', 'تاریخ']);
  const durIdx   = findCol(headers, ['duration', 'call duration', 'call_duration', 'مدت']);
  const locIdx   = findCol(headers, ['geo coded location', 'location', 'geo', 'geo_coded_location', 'مکان', 'موقعیت']);
  const idIdx    = findCol(headers, ['id', 'internal id', 'internal_id', 'row_id']);

  if (typeIdx === -1 || numIdx === -1) {
    return {
      success: false,
      data: null,
      error: 'Call record format requires at least "Type" and "Number" columns.',
      nodeCount: 0,
      linkCount: 0,
      format: delimiter === '\t' ? 'tsv' : 'csv',
      warnings,
    };
  }

  const OWNER_ID = '__phone_owner__';
  const ownerNode: Partial<GraphNode> = {
    id: OWNER_ID,
    label: 'Phone Owner',
    type: 'person' as EntityType,
    description: 'Owner of the analyzed device',
  };

  const contactMap = new Map<string, Partial<GraphNode>>();
  const links: Partial<GraphLink>[] = [];
  const locationSet = new Set<string>();

  rows.forEach((cols, i) => {
    const callType = (cols[typeIdx] || '').trim().toLowerCase();
    const number   = (cols[numIdx] || '').trim();
    const name     = nameIdx >= 0 ? (cols[nameIdx] || '').trim() : '';
    const dateTime = dateIdx >= 0 ? (cols[dateIdx] || '').trim() : '';
    const duration = durIdx >= 0 ? (cols[durIdx] || '').trim() : '';
    const location = locIdx >= 0 ? (cols[locIdx] || '').trim() : '';
    const rowId    = idIdx >= 0 ? (cols[idIdx] || '').trim() : String(i);

    if (!number) {
      warnings.push(`Row ${i + 2}: missing phone number, skipped`);
      return;
    }

    // Build a unique contact node keyed by phone number
    const contactId = `contact_${number}`;
    if (!contactMap.has(contactId)) {
      contactMap.set(contactId, {
        id: contactId,
        label: name || number,
        type: 'person' as EntityType,
        description: name ? `${name} (${number})` : number,
        properties: { phone_number: number },
      });
    }

    // Collect unique locations for location nodes
    if (location) {
      locationSet.add(location);
    }

    // Determine direction
    const isIncoming = callType.includes('incoming') || callType.includes('ورودی');
    const isOutgoing = callType.includes('outgoing') || callType.includes('خروجی');
    const isMissed   = callType.includes('missed') || callType.includes('بی‌پاسخ') || callType.includes('از دست رفته');
    const isSms      = callType.includes('sms') || callType.includes('message') || callType.includes('پیامک');

    let source: string;
    let target: string;
    let relation: string;

    if (isIncoming) {
      source = contactId;
      target = OWNER_ID;
      relation = 'INCOMING_CALL';
    } else if (isOutgoing) {
      source = OWNER_ID;
      target = contactId;
      relation = 'OUTGOING_CALL';
    } else if (isMissed) {
      source = contactId;
      target = OWNER_ID;
      relation = 'MISSED_CALL';
    } else if (isSms) {
      source = OWNER_ID;
      target = contactId;
      relation = 'SMS';
    } else {
      source = OWNER_ID;
      target = contactId;
      relation = callType || 'COMMUNICATION';
    }

    const props: Record<string, unknown> = {
      call_type: cols[typeIdx],
      row_id: rowId,
    };
    if (dateTime) props.datetime = dateTime;
    if (duration) props.duration = duration;
    if (location) props.location = location;

    // Remaining columns as extra properties
    headers.forEach((h, hIdx) => {
      if ([typeIdx, numIdx, nameIdx, dateIdx, durIdx, locIdx, idIdx].includes(hIdx)) return;
      if (cols[hIdx]) props[h] = cols[hIdx];
    });

    links.push({
      id: `call_${rowId}_${i}`,
      source,
      target,
      relation: relation as RelationType,
      strength: duration ? Math.min(10, Math.max(1, Math.ceil(Number(duration) / 30))) : 3,
      description: `${cols[typeIdx] || relation} — ${dateTime}${duration ? ` (${duration}s)` : ''}`,
      properties: props,
    });
  });

  // Build node list: owner + contacts + location nodes
  const nodes: Partial<GraphNode>[] = [ownerNode, ...contactMap.values()];

  locationSet.forEach((loc) => {
    const locId = `loc_${loc}`;
    nodes.push({
      id: locId,
      label: loc,
      type: 'location' as EntityType,
      description: loc,
    });
  });

  // Add location links: each contact gets a link to their most frequent location
  const contactLocationMap = new Map<string, Map<string, number>>();
  rows.forEach((cols) => {
    const number = (cols[numIdx] || '').trim();
    const location = locIdx >= 0 ? (cols[locIdx] || '').trim() : '';
    if (!number || !location) return;
    const contactId = `contact_${number}`;
    if (!contactLocationMap.has(contactId)) contactLocationMap.set(contactId, new Map());
    const locMap = contactLocationMap.get(contactId)!;
    locMap.set(location, (locMap.get(location) || 0) + 1);
  });

  contactLocationMap.forEach((locMap, contactId) => {
    locMap.forEach((count, loc) => {
      links.push({
        id: `loc_link_${contactId}_${loc}`,
        source: contactId,
        target: `loc_${loc}`,
        relation: 'LOCATED_IN' as RelationType,
        strength: Math.min(10, count),
        description: `${count} call(s) from this location`,
      });
    });
  });

  const data = normalizeGraphData(nodes, links, [], warnings);
  return {
    success: true,
    data,
    nodeCount: data.nodes.length,
    linkCount: data.links.length,
    format: delimiter === '\t' ? 'tsv' : 'csv',
    warnings,
  };
}

// ─── SMS Record Parser ────────────────────────────────────────────────────────

/** Header keywords that fingerprint a SMS/message record CSV */
const SMS_RECORD_KEYWORDS = {
  type: ['type', 'نوع'],
  address: ['address', 'sender', 'recipient', 'phone', 'آدرس', 'فرستنده'],
  body: ['body', 'message', 'content', 'text', 'متن', 'پیام'],
};

/**
 * Heuristic: does this header row look like a SMS/message record?
 * Requires at least type + address + body columns.
 */
function detectSmsRecordHeaders(headers: string[]): boolean {
  const hasType = headers.some((h) =>
    SMS_RECORD_KEYWORDS.type.some((kw) => h === kw || h.includes(kw))
  );
  const hasAddress = headers.some((h) =>
    SMS_RECORD_KEYWORDS.address.some((kw) => h === kw || h.includes(kw))
  );
  const hasBody = headers.some((h) =>
    SMS_RECORD_KEYWORDS.body.some((kw) => h === kw || h.includes(kw))
  );
  return hasType && hasAddress && hasBody;
}

/**
 * Parse SMS/message record CSV into a star-topology graph.
 *
 * Graph model:
 *   - One central "Phone Owner" node
 *   - One node per unique sender/recipient (Address)
 *   - One link per message row (direction from Type column: Inbox/Sent)
 *   - Body, Date, Status stored as link properties
 */
function parseCsvSmsRecord(
  headers: string[],
  rows: string[][],
  delimiter: string,
  warnings: string[]
): ParseResult {
  const typeIdx    = findCol(headers, ['type', 'نوع']);
  const addrIdx    = findCol(headers, ['address', 'sender', 'recipient', 'phone', 'آدرس', 'فرستنده']);
  const personIdx  = findCol(headers, ['person', 'contact', 'name', 'شخص', 'نام']);
  const bodyIdx    = findCol(headers, ['body', 'message', 'content', 'text', 'متن', 'پیام']);
  const subjectIdx = findCol(headers, ['subject', 'subject (mms)', 'موضوع']);
  const dateIdx    = findCol(headers, ['date', 'datetime', 'time', 'timestamp', 'تاریخ']);
  const statusIdx  = findCol(headers, ['status', 'وضعیت']);
  const readIdx    = findCol(headers, ['read', 'خوانده شده']);
  const threadIdx  = findCol(headers, ['thread id', 'thread_id', 'threadid', 'thread']);
  const idIdx      = findCol(headers, ['id', 'internal id', 'internal_id', 'row_id']);

  if (typeIdx === -1 || addrIdx === -1) {
    return {
      success: false,
      data: null,
      error: 'SMS record format requires at least "Type" and "Address" columns.',
      nodeCount: 0,
      linkCount: 0,
      format: delimiter === '\t' ? 'tsv' : 'csv',
      warnings,
    };
  }

  const OWNER_ID = '__phone_owner__';
  const ownerNode: Partial<GraphNode> = {
    id: OWNER_ID,
    label: 'Phone Owner',
    type: 'person' as EntityType,
    description: 'Owner of the analyzed device',
  };

  const contactMap = new Map<string, Partial<GraphNode>>();
  const links: Partial<GraphLink>[] = [];

  rows.forEach((cols, i) => {
    const msgType = (cols[typeIdx] || '').trim().toLowerCase();
    const address = (cols[addrIdx] || '').trim();
    const person  = personIdx >= 0 ? (cols[personIdx] || '').trim() : '';
    const body    = bodyIdx >= 0 ? (cols[bodyIdx] || '').trim() : '';
    const subject = subjectIdx >= 0 ? (cols[subjectIdx] || '').trim() : '';
    const date    = dateIdx >= 0 ? (cols[dateIdx] || '').trim() : '';
    const status  = statusIdx >= 0 ? (cols[statusIdx] || '').trim() : '';
    const read    = readIdx >= 0 ? (cols[readIdx] || '').trim() : '';
    const thread  = threadIdx >= 0 ? (cols[threadIdx] || '').trim() : '';
    const rowId   = idIdx >= 0 ? (cols[idIdx] || '').trim() : String(i);

    if (!address) {
      warnings.push(`Row ${i + 2}: missing address, skipped`);
      return;
    }

    // Build a unique contact node keyed by address
    const contactId = `contact_${address}`;
    if (!contactMap.has(contactId)) {
      const isServiceNumber = /^[A-Za-z]+$/.test(address); // MCI, MTN, etc.
      contactMap.set(contactId, {
        id: contactId,
        label: person || address,
        type: isServiceNumber ? 'organization' as EntityType : 'person' as EntityType,
        description: person ? `${person} (${address})` : address,
        properties: { address, thread_id: thread },
      });
    }

    // Determine direction based on Type
    const isInbox = msgType.includes('inbox') || msgType.includes('received') || msgType.includes('دریافتی');
    const isSent  = msgType.includes('sent') || msgType.includes('outbox') || msgType.includes('ارسالی');
    const isDraft = msgType.includes('draft') || msgType.includes('پیش‌نویس');

    let source: string;
    let target: string;
    let relation: string;

    if (isInbox) {
      source = contactId;
      target = OWNER_ID;
      relation = 'SMS_RECEIVED';
    } else if (isSent) {
      source = OWNER_ID;
      target = contactId;
      relation = 'SMS_SENT';
    } else if (isDraft) {
      source = OWNER_ID;
      target = contactId;
      relation = 'SMS_DRAFT';
    } else {
      source = contactId;
      target = OWNER_ID;
      relation = msgType.toUpperCase() || 'SMS';
    }

    const props: Record<string, unknown> = {
      message_type: cols[typeIdx],
      row_id: rowId,
    };
    if (body) props.body = body.length > 100 ? body.substring(0, 100) + '...' : body;
    if (subject) props.subject = subject;
    if (date) props.datetime = date;
    if (status) props.status = status;
    if (read) props.read = read;
    if (thread) props.thread_id = thread;

    // Remaining columns as extra properties
    headers.forEach((h, hIdx) => {
      if ([typeIdx, addrIdx, personIdx, bodyIdx, subjectIdx, dateIdx, statusIdx, readIdx, threadIdx, idIdx].includes(hIdx)) return;
      if (cols[hIdx]) props[h] = cols[hIdx];
    });

    // Calculate link strength based on message length
    const msgLength = body.length;
    const strength = Math.min(10, Math.max(1, Math.ceil(msgLength / 50)));

    links.push({
      id: `sms_${rowId}_${i}`,
      source,
      target,
      relation: relation as RelationType,
      strength,
      description: body.length > 50 ? body.substring(0, 50) + '...' : body,
      properties: props,
    });
  });

  // Build node list: owner + contacts
  const nodes: Partial<GraphNode>[] = [ownerNode, ...contactMap.values()];

  const data = normalizeGraphData(nodes, links, [], warnings);
  return {
    success: true,
    data,
    nodeCount: data.nodes.length,
    linkCount: data.links.length,
    format: delimiter === '\t' ? 'tsv' : 'csv',
    warnings,
  };
}

// ─── Text Parser ──────────────────────────────────────────────────────────────

/**
 * Parse plain text into GraphData.
 *
 * Supports formats:
 * 1. "A -> B" or "A → B" (directed edge)
 * 2. "A -- B" or "A — B" (undirected edge)
 * 3. "A B" (space-separated edge list)
 * 4. "A,B" (comma-separated edge list per line)
 *
 * @param content - Raw text string
 * @returns ParseResult
 */
function parseTextGraph(content: string): ParseResult {
  const warnings: string[] = [];
  const lines = content.trim().split('\n').map((l) => l.trim()).filter(Boolean);

  // Skip comment lines (# or //)
  const dataLines = lines.filter((l) => !l.startsWith('#') && !l.startsWith('//'));

  if (dataLines.length === 0) {
    return {
      success: false,
      data: null,
      error: 'No data lines found in text file.',
      nodeCount: 0,
      linkCount: 0,
      format: 'text',
      warnings,
    };
  }

  const links: Partial<GraphLink>[] = [];
  const nodeSet = new Set<string>();

  dataLines.forEach((line, i) => {
    let source: string | null = null;
    let target: string | null = null;
    let relation: RelationType = 'RELATED_TO';

    // Pattern: "A -> B" or "A → B" or "A -> B [RELATION]"
    const arrowMatch = line.match(/^(.+?)\s*(?:->|→|=>)\s*(.+?)(?:\s*\[(.+?)\])?$/);
    if (arrowMatch) {
      source = arrowMatch[1].trim();
      target = arrowMatch[2].trim();
      if (arrowMatch[3]) relation = arrowMatch[3].trim() as RelationType;
    }

    // Pattern: "A -- B" or "A — B"
    if (!source) {
      const dashMatch = line.match(/^(.+?)\s*(?:--|—|~~)\s*(.+?)(?:\s*\[(.+?)\])?$/);
      if (dashMatch) {
        source = dashMatch[1].trim();
        target = dashMatch[2].trim();
        if (dashMatch[3]) relation = dashMatch[3].trim() as RelationType;
      }
    }

    // Pattern: "A,B" (single comma)
    if (!source) {
      const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        source = parts[0];
        target = parts[1];
        if (parts[2]) relation = parts[2] as RelationType;
      }
    }

    // Pattern: "A B" (space separated, at least 2 tokens)
    if (!source) {
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        source = parts[0];
        target = parts[1];
        if (parts[2]) relation = parts[2] as RelationType;
      }
    }

    if (source && target) {
      nodeSet.add(source);
      nodeSet.add(target);
      links.push({
        id: `text_edge_${i}`,
        source,
        target,
        relation,
        strength: 5,
        description: '',
      });
    } else {
      warnings.push(`Line ${i + 1}: could not parse "${line}"`);
    }
  });

  if (links.length === 0) {
    return {
      success: false,
      data: null,
      error: 'Could not extract any relationships from text. Expected: "A -> B", "A -- B", or "A,B" format.',
      nodeCount: 0,
      linkCount: 0,
      format: 'text',
      warnings,
    };
  }

  const nodes: Partial<GraphNode>[] = Array.from(nodeSet).map((name) => ({
    id: name,
    label: name,
    type: 'unknown' as EntityType,
  }));

  const data = normalizeGraphData(nodes, links, [], warnings);
  return {
    success: true,
    data,
    nodeCount: data.nodes.length,
    linkCount: data.links.length,
    format: 'text',
    warnings,
  };
}

// ─── Helper: Extract Nodes from Edge List ─────────────────────────────────────

/**
 * Create node list from an array of edges by collecting all unique source/targets.
 */
function extractNodesFromEdgeList(
  edges: Record<string, unknown>[],
  warnings: string[]
): { nodes: Partial<GraphNode>[]; links: Partial<GraphLink>[] } {
  const nodeSet = new Set<string>();
  const links: Partial<GraphLink>[] = [];

  edges.forEach((edge, i) => {
    const source = String(edge.source || edge.from || '');
    const target = String(edge.target || edge.to || '');

    if (!source || !target) {
      warnings.push(`Edge ${i}: missing source or target, skipped`);
      return;
    }

    nodeSet.add(source);
    nodeSet.add(target);
    links.push({
      id: String(edge.id || `edge_${i}`),
      source,
      target,
      relation: (edge.relation || edge.type || edge.label || 'RELATED_TO') as RelationType,
      strength: Number(edge.strength || edge.weight || 5),
      description: String(edge.description || edge.label || ''),
    });
  });

  const nodes: Partial<GraphNode>[] = Array.from(nodeSet).map((name) => ({
    id: name,
    label: name,
    type: 'unknown' as EntityType,
  }));

  return { nodes, links };
}

// ─── Helper: Normalize to GraphData ───────────────────────────────────────────

/**
 * Normalize partial nodes and links into a complete GraphData object.
 *
 * Fills missing fields with defaults, deduplicates nodes, runs basic
 * community detection (connected components), and builds stats.
 *
 * @param rawNodes - Partial node definitions
 * @param rawLinks - Partial link definitions
 * @param rawCommunities - Optional community metadata
 * @param warnings - Mutable array for non-fatal warnings
 * @returns Complete GraphData
 */
function normalizeGraphData(
  rawNodes: Partial<GraphNode>[],
  rawLinks: Partial<GraphLink>[],
  rawCommunities: Partial<Community>[] | undefined,
  warnings: string[]
): GraphData {
  // Deduplicate nodes by ID
  const nodeMap = new Map<string, GraphNode>();

  rawNodes.forEach((n, i) => {
    const id = n.id || n.label || `node_${i}`;
    if (nodeMap.has(id)) return;

    nodeMap.set(id, {
      id,
      label: n.label || id,
      type: n.type || 'unknown',
      description: n.description || '',
      community_id: n.community_id ?? null,
      case_id: n.case_id || 'local',
      artifact_id: n.artifact_id || 'uploaded',
      origin: n.origin || 'file_import',
      properties: n.properties,
      metrics: n.metrics,
      timestamps: n.timestamps,
      tags: n.tags,
      status: n.status,
      visibility: n.visibility,
      connectionCount: 0,
      communityColor: getCommunityColor(n.community_id ?? null),
      hidden: false,
      pinned: false,
      locked: false,
      expanded: true,
    });
  });

  // Build links; count connections
  const links: GraphLink[] = rawLinks.map((l, i) => {
    const source = String(l.source || '');
    const target = String(l.target || '');

    const srcNode = nodeMap.get(source);
    const tgtNode = nodeMap.get(target);
    if (srcNode) srcNode.connectionCount = (srcNode.connectionCount ?? 0) + 1;
    if (tgtNode) tgtNode.connectionCount = (tgtNode.connectionCount ?? 0) + 1;

    return {
      id: l.id || `link_${i}`,
      source,
      target,
      relation: l.relation || ('RELATED_TO' as RelationType),
      description: l.description || '',
      strength: l.strength ?? 5,
      weight: l.weight,
      confidence: l.confidence,
      case_id: l.case_id || 'local',
      artifact_id: l.artifact_id || 'uploaded',
      origin: l.origin || 'file_import',
      properties: l.properties,
      metrics: l.metrics,
      timestamps: l.timestamps,
      tags: l.tags,
      status: l.status,
      bidirectional: l.bidirectional,
      visibility: l.visibility,
      selected: false,
      highlighted: false,
      hidden: false,
    };
  });

  const nodes = Array.from(nodeMap.values());

  // Simple community detection if no communities provided
  const communities: Community[] =
    rawCommunities && rawCommunities.length > 0
      ? (rawCommunities as Community[])
      : detectSimpleCommunities(nodes, links);

  // Assign community colors
  nodes.forEach((node) => {
    node.communityColor = getCommunityColor(node.community_id);
  });

  // Build stats
  const stats = buildGraphStats(nodes, links, communities);

  console.info('[GraphParser] Normalized:', {
    nodes: nodes.length,
    links: links.length,
    communities: communities.length,
  });

  return {
    nodes,
    links,
    communities,
    community_reports: [],
    stats,
  };
}

// ─── Simple Community Detection (Connected Components) ────────────────────────

/**
 * Detect communities via connected components using union-find.
 * Only used when no community data is provided.
 */
function detectSimpleCommunities(nodes: GraphNode[], links: GraphLink[]): Community[] {
  if (nodes.length === 0) return [];

  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  function find(x: string): string {
    if (!parent.has(x)) {
      parent.set(x, x);
      rank.set(x, 0);
    }
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)!));
    }
    return parent.get(x)!;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra) ?? 0;
    const rankB = rank.get(rb) ?? 0;
    if (rankA < rankB) { parent.set(ra, rb); }
    else if (rankA > rankB) { parent.set(rb, ra); }
    else { parent.set(rb, ra); rank.set(ra, rankA + 1); }
  }

  nodes.forEach((n) => find(n.id));
  links.forEach((l) => {
    const src = typeof l.source === 'string' ? l.source : l.source.id;
    const tgt = typeof l.target === 'string' ? l.target : l.target.id;
    union(src, tgt);
  });

  // Group nodes by root
  const groups = new Map<string, string[]>();
  nodes.forEach((n) => {
    const root = find(n.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(n.id);
  });

  // Sort communities by size descending
  const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  const communities: Community[] = sorted.map(([, memberIds], idx) => {
    // Assign community_id to nodes
    memberIds.forEach((id) => {
      const node = nodes.find((n) => n.id === id);
      if (node) node.community_id = idx;
    });

    return {
      community_id: idx,
      level: 0,
      size: memberIds.length,
      title: `Community ${idx + 1}`,
      description: `Auto-detected cluster with ${memberIds.length} members`,
      entity_names: memberIds,
      entity_ids: memberIds,
    };
  });

  return communities;
}

// ─── Build Stats ──────────────────────────────────────────────────────────────

/**
 * Build GraphStats from node and link arrays.
 */
function buildGraphStats(nodes: GraphNode[], links: GraphLink[], communities: Community[]): GraphStats {
  const typeCounts: Record<string, number> = {};
  nodes.forEach((n) => {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  });

  return {
    entity_count: nodes.length,
    relationship_count: links.length,
    community_count: communities.length,
    report_count: 0,
    person_count: typeCounts['person'] || 0,
    organization_count: typeCounts['organization'] || 0,
    location_count: typeCounts['location'] || 0,
    financial_entity_count: typeCounts['financial_entity'] || 0,
    document_count: typeCounts['document'] || 0,
    event_count: typeCounts['event'] || 0,
    product_count: typeCounts['product'] || 0,
    project_count: typeCounts['project'] || 0,
  };
}

// ─── URL Fetcher ──────────────────────────────────────────────────────────────

/**
 * Fetch graph data from a remote URL.
 *
 * @param url - URL to fetch graph data from
 * @returns ParseResult
 * @throws Never — errors are captured in ParseResult
 */
export async function fetchAndParseGraphUrl(url: string): Promise<ParseResult> {
  console.info('[GraphParser] Fetching from URL:', { url });
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        nodeCount: 0,
        linkCount: 0,
        format: 'unknown',
        warnings: [],
      };
    }

    const text = await response.text();
    const filename = url.split('/').pop() || 'remote.json';
    return parseGraphFile(text, filename);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch URL';
    console.error('[GraphParser] URL fetch failed:', { url, error: msg });
    return {
      success: false,
      data: null,
      error: msg,
      nodeCount: 0,
      linkCount: 0,
      format: 'unknown',
      warnings: [],
    };
  }
}
