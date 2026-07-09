// ============================================
// Projects mock provider
// ============================================

import { mockProjectsApi } from '../mock/mock-projects-api';
import { getProjectsMockMode } from '../mock/config';
import { MOCK_CURRENT_USER_ID } from '../mock/mock-projects-data';
import { ProjectsProvider, ProjectsProviderContext, buildMeta } from './types';


export const mockProjectsProvider: ProjectsProvider = {
  id: 'mock',

  async listProjects(params) {
    return mockProjectsApi.listProjects(params);
  },

  async getProject(id) {
    return mockProjectsApi.getProject(id);
  },

  async createProject(request) {
    return mockProjectsApi.createProject(request);
  },

  async updateProject(id, request) {
    return mockProjectsApi.updateProject(id, request);
  },

  async deleteProject(id) {
    return mockProjectsApi.deleteProject(id);
  },

  async listMyTasks(params, ctx?: ProjectsProviderContext) {
    return mockProjectsApi.listMyTasks(params, ctx?.currentUserId ?? MOCK_CURRENT_USER_ID);
  },

  async listProjectTasks(projectId, params) {
    return mockProjectsApi.listProjectTasks(projectId, params);
  },

  async getTask(id) {
    return mockProjectsApi.getTask(id);
  },

  async createTask(request) {
    return mockProjectsApi.createTask(request);
  },

  async updateTask(id, request) {
    return mockProjectsApi.updateTask(id, request);
  },

  async updateTaskStatus(id, request) {
    return mockProjectsApi.updateTaskStatus(id, request);
  },

  async deleteTask(id) {
    return mockProjectsApi.deleteTask(id);
  },

  async getBoard(projectId) {
    return mockProjectsApi.getBoard(projectId);
  },

  async addComment(taskId, body, ctx?: ProjectsProviderContext) {
    return mockProjectsApi.addComment(
      taskId,
      body,
      ctx?.currentUserId ?? MOCK_CURRENT_USER_ID
    );
  },

  async addLink(taskId, link) {
    return mockProjectsApi.addLink(taskId, link);
  },

  async listActivity(projectId, limit) {
    return mockProjectsApi.listActivity(projectId, limit);
  },

  async getFeedStats() {
    return mockProjectsApi.getFeedStats();
  },

  async listDiscussion(projectId) {
    return mockProjectsApi.listDiscussion(projectId);
  },

  async createDiscussionThread(projectId, title, body) {
    return mockProjectsApi.createDiscussionThread(projectId, title, body);
  },

  async listDocs(projectId) {
    return mockProjectsApi.listDocs(projectId);
  },

  async createDoc(projectId, title, content, folderId) {
    return mockProjectsApi.createDoc(projectId, title, content, folderId);
  },

  async updateDoc(docId, patch) {
    return mockProjectsApi.updateDoc(docId, patch);
  },

  async listBoards(projectId) {
    return mockProjectsApi.listBoards(projectId);
  },

  async listSprints(projectId) {
    return mockProjectsApi.listSprints(projectId);
  },

  async assignTaskToSprint(taskId, sprintId) {
    mockProjectsApi.assignTaskToSprint(taskId, sprintId);
    return { ok: true };
  },

  async getAnalytics(projectId) {
    return mockProjectsApi.getAnalytics(projectId);
  },

  async getWorkload(projectId) {
    return mockProjectsApi.getWorkload(projectId);
  },

  async listResources(projectId) {
    return mockProjectsApi.listResources(projectId);
  },
};

export function mockProviderMeta(targetApi?: string) {
  return buildMeta('mock', getProjectsMockMode(), targetApi ?? 'local/mock-projects-api.ts');
}
