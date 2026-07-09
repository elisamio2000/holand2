import type { BoardApiStatus } from '../services/board.service';

export interface BoardApiRequirement {
  id: string;
  phase: string;
  method: string;
  path: string;
  description: string;
  status: BoardApiStatus;
  requestExample?: string;
  responseExample?: string;
}

export const BOARD_API_REQUIREMENTS: BoardApiRequirement[] = [
  {
    id: 'list-boards',
    phase: '2',
    method: 'GET',
    path: '/boards',
    description: 'List boards owned by or shared with the current user',
    status: 'mock',
    responseExample: JSON.stringify({ items: [{ id: 'uuid', title: 'Analysis', updatedAt: '2026-06-21T00:00:00Z' }], total: 1 }, null, 2),
  },
  {
    id: 'create-board',
    phase: '2',
    method: 'POST',
    path: '/boards',
    description: 'Create a new board',
    status: 'mock',
    requestExample: JSON.stringify({ title: 'My board', purpose: 'analysis' }, null, 2),
  },
  {
    id: 'get-board',
    phase: '2',
    method: 'GET',
    path: '/boards/{id}',
    description: 'Load full board snapshot',
    status: 'mock',
  },
  {
    id: 'upsert-board',
    phase: '2',
    method: 'PUT',
    path: '/boards/{id}',
    description: 'Debounced snapshot upsert with snapshotVersion',
    status: 'mock',
    requestExample: JSON.stringify({ title: 'Board', snapshot: { version: 1, objects: [] } }, null, 2),
  },
  {
    id: 'delete-board',
    phase: '2',
    method: 'DELETE',
    path: '/boards/{id}',
    description: 'Delete board',
    status: 'mock',
  },
  {
    id: 'share-board',
    phase: '4',
    method: 'POST',
    path: '/boards/{id}/share',
    description: 'Share board read/edit with users or groups',
    status: 'blocked',
    requestExample: JSON.stringify({ mode: 'read', userIds: ['user-1'] }, null, 2),
  },
  {
    id: 'board-comments',
    phase: '4',
    method: 'POST',
    path: '/boards/{id}/comments',
    description: 'Pin comment at canvas coordinates',
    status: 'blocked',
    requestExample: JSON.stringify({ x: 120, y: 80, text: 'Review this' }, null, 2),
  },
  {
    id: 'board-activity',
    phase: '6',
    method: 'GET',
    path: '/boards/{id}/activity',
    description: 'Audit log for legal hold / compliance',
    status: 'optional',
  },
];
