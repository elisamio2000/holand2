import { useCallback, useMemo, useRef, useState } from 'react';
import type { BoardSnapshot, BoardViewBox } from '../lib/board-types';
import { cloneDocument, extractDocument, withViewBox, type BoardDocumentState } from '../lib/board-snapshot';

const MAX_HISTORY = 50;

interface HistoryEntry {
  document: BoardDocumentState;
  viewBox: BoardViewBox;
}

function cloneViewBox(vb: BoardViewBox): BoardViewBox {
  return { ...vb };
}

function cloneEntry(document: BoardDocumentState, viewBox: BoardViewBox): HistoryEntry {
  return { document: cloneDocument(document), viewBox: cloneViewBox(viewBox) };
}

/** Lightweight fingerprint for gesture equality (avoids full JSON compare when unchanged). */
export function documentFingerprint(doc: BoardDocumentState): string {
  return `${doc.objects.length}|${doc.inkStrokes?.length ?? 0}|${JSON.stringify(doc.graphLayout ?? {})}`;
}

function entriesEqual(a: HistoryEntry, b: HistoryEntry): boolean {
  if (documentFingerprint(a.document) !== documentFingerprint(b.document)) return false;
  if (JSON.stringify(a.viewBox) !== JSON.stringify(b.viewBox)) return false;
  return JSON.stringify(a.document) === JSON.stringify(b.document);
}

export function useBoardHistory(initial: BoardSnapshot) {
  const [viewBox, setViewBoxState] = useState<BoardViewBox>(initial.viewBox);
  const [document, setDocument] = useState(() => extractDocument(initial));
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const gestureBaselineRef = useRef<HistoryEntry | null>(null);
  const documentRef = useRef(document);
  const viewBoxRef = useRef(viewBox);
  documentRef.current = document;
  viewBoxRef.current = viewBox;
  const [historyVersion, setHistoryVersion] = useState(0);

  const bumpHistory = useCallback(() => setHistoryVersion((v) => v + 1), []);

  const snapshot = useMemo<BoardSnapshot>(
    () => withViewBox(document, viewBox),
    [document, viewBox]
  );

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  void historyVersion;

  const pushPast = useCallback((entry: HistoryEntry) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), entry];
    futureRef.current = [];
  }, []);

  const commitDocument = useCallback(
    (next: BoardDocumentState) => {
      pushPast(cloneEntry(documentRef.current, viewBoxRef.current));
      documentRef.current = next;
      setDocument(next);
      bumpHistory();
    },
    [pushPast, bumpHistory]
  );

  const replaceDocument = useCallback((next: BoardDocumentState) => {
    documentRef.current = next;
    setDocument(next);
  }, []);

  const replaceDuringGesture = useCallback((next: BoardDocumentState) => {
    documentRef.current = next;
    setDocument(next);
  }, []);

  const setViewBox = useCallback((vb: BoardViewBox) => {
    viewBoxRef.current = vb;
    setViewBoxState(vb);
  }, []);

  const setSnapshot = useCallback(
    (next: BoardSnapshot) => {
      commitDocument(extractDocument(next));
      setViewBox(next.viewBox);
    },
    [commitDocument, setViewBox]
  );

  const beginGesture = useCallback(() => {
    gestureBaselineRef.current = cloneEntry(documentRef.current, viewBoxRef.current);
  }, []);

  const endGesture = useCallback(() => {
    if (!gestureBaselineRef.current) return;
    const baseline = gestureBaselineRef.current;
    gestureBaselineRef.current = null;
    const current = cloneEntry(documentRef.current, viewBoxRef.current);
    if (!entriesEqual(baseline, current)) {
      pushPast(baseline);
      bumpHistory();
    }
  }, [pushPast, bumpHistory]);

  const beginDrag = beginGesture;
  const endDrag = endGesture;

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return false;
    futureRef.current = [cloneEntry(documentRef.current, viewBoxRef.current), ...futureRef.current];
    documentRef.current = prev.document;
    viewBoxRef.current = prev.viewBox;
    setDocument(prev.document);
    setViewBoxState(prev.viewBox);
    bumpHistory();
    return true;
  }, [bumpHistory]);

  const redo = useCallback(() => {
    const next = futureRef.current.shift();
    if (!next) return false;
    pastRef.current = [...pastRef.current, cloneEntry(documentRef.current, viewBoxRef.current)];
    documentRef.current = next.document;
    viewBoxRef.current = next.viewBox;
    setDocument(next.document);
    setViewBoxState(next.viewBox);
    bumpHistory();
    return true;
  }, [bumpHistory]);

  return {
    snapshot,
    document,
    viewBox,
    setSnapshot,
    commitDocument,
    replaceDocument,
    replaceDuringGesture,
    setViewBox,
    beginGesture,
    endGesture,
    beginDrag,
    endDrag,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
