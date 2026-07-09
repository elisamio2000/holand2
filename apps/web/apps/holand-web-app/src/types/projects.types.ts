// ============================================
// Projects & Tasks Types
// Target API: GET/POST /projects · GET/PATCH /tasks/*
// ============================================

export type ProjectStatus = 'active' | 'archived' | 'completed' | 'on_hold';

export type TaskStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'canceled';

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export type ProjectViewId =
  | 'list'
  | 'board'
  | 'calendar'
  | 'table'
  | 'timeline'
  | 'activity'
  | 'workload'
  | 'discussion'
  | 'docs'
  | 'sprint'
  | 'analytics'
  | 'resources';

export type MyTasksTab = 'assigned' | 'today' | 'personal';

export type TaskLinkType =
  | 'case'
  | 'file'
  | 'message'
  | 'calendar_event'
  | 'graph_node';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'labels'
  | 'relationship'
  | 'progress';

export type DependencyType = 'blocking' | 'blocked_by';

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'assigned'
  | 'commented'
  | 'linked'
  | 'completed';

export type ProjectsProviderId = 'mock' | 'api';

export type ProjectsMockMode = 'off' | 'only' | 'fallback';

export type ProjectsModePref = 'auto' | 'mock' | 'real';

export interface ProjectMember {
  user_id: string;
  name: string;
  role: 'owner' | 'member' | 'viewer';
  avatar?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  owner_id: string;
  owner_name?: string;
  task_count: number;
  completed_task_count: number;
  open_task_count: number;
  overdue_task_count: number;
  member_count: number;
  linked_case_ids: string[];
  target_date?: string;
  updated_at: string;
  created_at: string;
}

export interface ProjectDetail extends ProjectSummary {
  members: ProjectMember[];
  milestone_ids?: string[];
}

export interface TaskLink {
  id: string;
  type: TaskLinkType;
  target_id: string;
  label?: string;
  href?: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

export interface TaskChecklist {
  id: string;
  title: string;
  items: TaskChecklistItem[];
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
}

export interface CustomFieldValue {
  key: string;
  label: string;
  type: CustomFieldType;
  value: string | number | string[] | null;
}

export interface TaskDependency {
  id: string;
  type: DependencyType;
  task_id: string;
  related_task_id: string;
  related_task_title?: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface TaskSummary {
  id: string;
  project_id: string | null;
  project_name?: string;
  parent_task_id?: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  assignee_name?: string;
  due_at?: string;
  start_at?: string;
  position: number;
  case_id?: string;
  case_title?: string;
  labels: string[];
  subtask_count: number;
  completed_subtask_count: number;
  checklist_progress?: number;
  comment_count: number;
  attachment_count: number;
  is_blocked: boolean;
  is_personal: boolean;
  updated_at: string;
  created_at: string;
}

export interface TaskDetail extends TaskSummary {
  description?: string;
  custom_fields: CustomFieldValue[];
  subtasks: TaskSummary[];
  checklists: TaskChecklist[];
  links: TaskLink[];
  dependencies: TaskDependency[];
  comments: TaskComment[];
  time_estimate_hours?: number;
  time_tracked_hours?: number;
}

export interface ProjectBoardColumn {
  status: TaskStatus;
  title: string;
  wip_limit?: number;
  tasks: TaskSummary[];
}

export interface ProjectBoardData {
  project_id: string;
  project_name: string;
  columns: ProjectBoardColumn[];
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  project_id?: string;
  task_id?: string;
  actor_id: string;
  actor_name: string;
  action: ActivityAction;
  summary: string;
  created_at: string;
  meta?: Record<string, unknown>;
}

export interface ProjectsListParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus | 'all';
  q?: string;
  owner_id?: string;
  has_case?: boolean;
}

export interface TasksListParams {
  page?: number;
  limit?: number;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  project_id?: string;
  assignee_id?: string;
  due_before?: string;
  due_after?: string;
  q?: string;
  personal_only?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectsListData extends PaginatedResponse<ProjectSummary> {
  facets?: {
    active: number;
    archived: number;
    mine: number;
  };
}

export interface TasksListData extends PaginatedResponse<TaskSummary> {
  facets?: {
    todo: number;
    in_progress: number;
    done: number;
    overdue: number;
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  member_ids?: string[];
  case_ids?: string[];
  target_date?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  target_date?: string;
  case_ids?: string[];
}

export interface CreateTaskRequest {
  title: string;
  project_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_at?: string;
  case_id?: string;
  parent_task_id?: string | null;
  description?: string;
  is_personal?: boolean;
}

export interface UpdateTaskRequest {
  title?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_at?: string | null;
  start_at?: string | null;
  position?: number;
  case_id?: string | null;
  description?: string;
  custom_fields?: CustomFieldValue[];
}

export interface UpdateTaskStatusRequest {
  status: TaskStatus;
  position?: number;
}

export interface ProjectsServiceMeta {
  provider: ProjectsProviderId;
  mock_mode: ProjectsMockMode;
  target_api?: string;
}

export interface ProjectsServiceResult<T> {
  ok: boolean;
  data: T;
  meta: ProjectsServiceMeta;
}

export const DEFAULT_BOARD_STATUSES: TaskStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
];

export const TASK_STATUS_LABEL_KEYS: Record<TaskStatus, string> = {
  backlog: 'projects.status.backlog',
  todo: 'projects.myTasks.todo',
  in_progress: 'projects.myTasks.inProgress',
  review: 'projects.board.review',
  done: 'projects.myTasks.done',
  canceled: 'projects.status.canceled',
};

export interface DiscussionThread {
  id: string;
  project_id: string;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  reply_count: number;
  last_reply_at?: string;
  message_partner_id?: string;
  created_at: string;
}

export interface ProjectDocFolder {
  id: string;
  project_id: string;
  name: string;
  parent_id?: string | null;
}

export interface ProjectDoc {
  id: string;
  project_id: string;
  folder_id?: string | null;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  updated_at: string;
  created_at: string;
}

export interface ProjectBoardMeta {
  id: string;
  project_id: string;
  name: string;
  type: 'kanban' | 'scrum';
  is_default: boolean;
}

export type SprintStatus = 'planned' | 'active' | 'completed';

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_at: string;
  end_at: string;
  status: SprintStatus;
  task_ids: string[];
}

export interface ProjectAnalytics {
  project_id: string;
  velocity: number;
  completion_rate: number;
  overdue_trend: { date: string; count: number }[];
  member_workload: { user_id: string; name: string; open_tasks: number; hours: number }[];
}

export interface ProjectResource {
  id: string;
  project_id: string;
  type: 'case' | 'file' | 'doc' | 'message';
  label: string;
  href: string;
}

export interface WorkloadEntry {
  user_id: string;
  name: string;
  capacity_hours: number;
  assigned_hours: number;
  tasks: TaskSummary[];
}
