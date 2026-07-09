import type { ChatProject } from '@/types/chat.types';

const STORAGE_KEY = 'chat-dev:projects';
const SESSION_ASSIGN_KEY = 'chat-dev:session-project';

function readProjects(): ChatProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatProject[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeProjects(projects: ChatProject[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function readAssignments(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SESSION_ASSIGN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeAssignments(map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_ASSIGN_KEY, JSON.stringify(map));
}

export const projectsDevStore = {
  list(): ChatProject[] {
    return readProjects();
  },

  create(body: Partial<ChatProject> & { name: string }): ChatProject {
    const project: ChatProject = {
      id: `dev-project-${crypto.randomUUID()}`,
      name: body.name.trim(),
      description: body.description,
      system_rules: body.system_rules,
      default_model: body.default_model,
      created_at: new Date().toISOString(),
    };
    writeProjects([...readProjects(), project]);
    return project;
  },

  update(id: string, patch: Partial<ChatProject>): ChatProject {
    const projects = readProjects();
    const idx = projects.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error('Project not found');
    const updated = { ...projects[idx], ...patch, id };
    projects[idx] = updated;
    writeProjects(projects);
    return updated;
  },

  delete(id: string): void {
    writeProjects(readProjects().filter((p) => p.id !== id));
    const assignments = readAssignments();
    for (const [sessionId, projectId] of Object.entries(assignments)) {
      if (projectId === id) delete assignments[sessionId];
    }
    writeAssignments(assignments);
  },

  getSessionProjectId(sessionId: string): string | null {
    return readAssignments()[sessionId] ?? null;
  },

  assignSession(sessionId: string, projectId: string | null): void {
    const map = readAssignments();
    if (projectId) map[sessionId] = projectId;
    else delete map[sessionId];
    writeAssignments(map);
  },

  listSessionIdsForProject(projectId: string): string[] {
    return Object.entries(readAssignments())
      .filter(([, pid]) => pid === projectId)
      .map(([sid]) => sid);
  },
};
