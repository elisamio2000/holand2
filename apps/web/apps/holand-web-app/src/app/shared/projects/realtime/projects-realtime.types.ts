export type ProjectsRealtimeEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.status_changed'
  | 'task.deleted'
  | 'project.updated'
  | 'activity.new'
  | 'comment.new';

export interface ProjectsRealtimeEvent {
  type: ProjectsRealtimeEventType;
  projectId?: string;
  taskId?: string;
  status?: string;
  payload?: Record<string, unknown>;
  ts?: number;
}

export type ProjectsRealtimeScope = 'global' | 'project' | 'task';

export interface ProjectsRealtimeConfig {
  enabled: boolean;
  pollMs: number;
}
