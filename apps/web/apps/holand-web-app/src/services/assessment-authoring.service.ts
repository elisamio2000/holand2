import { gatewayClient } from '@/lib/api-client';
import type {
  AssessmentVersionDiff,
  AssessmentVersionDetail,
  AssessmentVersionSummary,
  AuditLogEntry,
  AuthoringAssessmentType,
  FormulaVersion,
  VersionActionInput,
  VersionPreflight,
} from '@/types/assessment-authoring.types';

interface CreateAssessmentDraftInput {
  assessment_type: AuthoringAssessmentType;
  title: string;
  created_by: string;
}

interface AddQuestionInput {
  kind: 'likert' | 'forced_choice';
  dimension: string;
  text: string;
  order_index: number;
  is_reverse_scored: boolean;
  options: Array<{
    label: string;
    value: number;
    pole: string;
    weight: number;
    order_index: number;
  }>;
}

interface UpdateQuestionInput {
  text?: string;
  dimension?: string;
  order_index?: number;
}

interface AddOptionInput {
  label: string;
  value: number;
  pole: string;
  weight: number;
  order_index: number;
}

interface CreateFormulaDraftInput {
  formula_key: string;
  assessment_type: AuthoringAssessmentType;
  expression: { expr: string };
  input_variables: string[];
  output_metric: string;
  created_by: string;
}

interface UpdateFormulaDraftInput {
  expression: { expr: string };
  input_variables: string[];
  output_metric: string;
}

export const assessmentAuthoringService = {
  async listAssessmentVersions(): Promise<AssessmentVersionSummary[]> {
    const { data } = await gatewayClient.get<AssessmentVersionSummary[]>('/admin/assessment-versions');
    return data;
  },

  async getAssessmentVersion(versionId: string): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.get<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}`
    );
    return data;
  },

  async createAssessmentDraft(input: CreateAssessmentDraftInput): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      '/admin/assessment-versions/draft',
      {
        ...input,
        questions: [],
      }
    );
    return data;
  },

  async addQuestion(versionId: string, input: AddQuestionInput): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions`,
      input
    );
    return data;
  },

  async updateQuestion(
    versionId: string,
    questionId: string,
    input: UpdateQuestionInput
  ): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.patch<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/${questionId}`,
      input
    );
    return data;
  },

  async deleteQuestion(versionId: string, questionId: string): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.delete<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/${questionId}`
    );
    return data;
  },

  async reorderQuestions(
    versionId: string,
    items: Array<{ question_id: string; order_index: number }>
  ): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/reorder`,
      { items }
    );
    return data;
  },

  async addOption(
    versionId: string,
    questionId: string,
    input: AddOptionInput
  ): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/${questionId}/options`,
      input
    );
    return data;
  },

  async deleteOption(
    versionId: string,
    questionId: string,
    optionId: string
  ): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.delete<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/${questionId}/options/${optionId}`
    );
    return data;
  },

  async reorderOptions(
    versionId: string,
    questionId: string,
    items: Array<{ option_id: string; order_index: number }>
  ): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/questions/${questionId}/options/reorder`,
      { items }
    );
    return data;
  },

  async preflightAssessment(versionId: string): Promise<VersionPreflight> {
    const { data } = await gatewayClient.get<VersionPreflight>(
      `/admin/assessment-versions/${versionId}/preflight`
    );
    return data;
  },

  async diffAssessmentVersions(
    versionId: string,
    compareTo: string
  ): Promise<AssessmentVersionDiff> {
    const { data } = await gatewayClient.get<AssessmentVersionDiff>(
      `/admin/assessment-versions/${versionId}/diff`,
      { params: { compare_to: compareTo } }
    );
    return data;
  },

  async reviewAssessmentVersion(versionId: string, action: VersionActionInput): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/review`,
      action
    );
    return data;
  },

  async approveAssessmentVersion(versionId: string, action: VersionActionInput): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/approve`,
      action
    );
    return data;
  },

  async publishAssessmentVersion(versionId: string, action: VersionActionInput): Promise<AssessmentVersionDetail> {
    const { data } = await gatewayClient.post<AssessmentVersionDetail>(
      `/admin/assessment-versions/${versionId}/publish`,
      action
    );
    return data;
  },

  async listFormulaVersions(): Promise<FormulaVersion[]> {
    const { data } = await gatewayClient.get<FormulaVersion[]>('/admin/formula-versions');
    return data;
  },

  async getFormulaVersion(formulaId: string): Promise<FormulaVersion> {
    const { data } = await gatewayClient.get<FormulaVersion>(`/admin/formula-versions/${formulaId}`);
    return data;
  },

  async createFormulaDraft(input: CreateFormulaDraftInput): Promise<FormulaVersion> {
    const { data } = await gatewayClient.post<FormulaVersion>('/admin/formula-versions/draft', input);
    return data;
  },

  async updateFormulaDraft(formulaId: string, input: UpdateFormulaDraftInput): Promise<FormulaVersion> {
    const { data } = await gatewayClient.patch<FormulaVersion>(
      `/admin/formula-versions/${formulaId}`,
      input
    );
    return data;
  },

  async preflightFormula(formulaId: string): Promise<VersionPreflight> {
    const { data } = await gatewayClient.get<VersionPreflight>(
      `/admin/formula-versions/${formulaId}/preflight`
    );
    return data;
  },

  async simulateFormula(formulaId: string, variables: Record<string, number>): Promise<{ result: number }> {
    const { data } = await gatewayClient.post<{ result: number }>(
      `/admin/formula-versions/${formulaId}/simulate`,
      { variables }
    );
    return data;
  },

  async reviewFormulaVersion(formulaId: string, action: VersionActionInput): Promise<FormulaVersion> {
    const { data } = await gatewayClient.post<FormulaVersion>(
      `/admin/formula-versions/${formulaId}/review`,
      action
    );
    return data;
  },

  async approveFormulaVersion(formulaId: string, action: VersionActionInput): Promise<FormulaVersion> {
    const { data } = await gatewayClient.post<FormulaVersion>(
      `/admin/formula-versions/${formulaId}/approve`,
      action
    );
    return data;
  },

  async publishFormulaVersion(formulaId: string, action: VersionActionInput): Promise<FormulaVersion> {
    const { data } = await gatewayClient.post<FormulaVersion>(
      `/admin/formula-versions/${formulaId}/publish`,
      action
    );
    return data;
  },

  async listAuditLogs(entityId?: string): Promise<AuditLogEntry[]> {
    const { data } = await gatewayClient.get<AuditLogEntry[]>('/admin/version-audit-logs', {
      params: entityId ? { entity_id: entityId } : undefined,
    });
    return data;
  },
};
