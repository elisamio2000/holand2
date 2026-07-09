export type AuthoringAssessmentType = 'holland' | 'mbti';

export type AuthoringVersionStatus =
  | 'draft'
  | 'reviewed'
  | 'approved'
  | 'published'
  | 'archived';

export type AuthoringQuestionKind = 'likert' | 'forced_choice';

export interface AuthoringQuestionOption {
  id: string;
  label: string;
  value: number;
  pole: string;
  weight: number;
  order_index: number;
}

export interface AuthoringQuestion {
  id: string;
  kind: AuthoringQuestionKind;
  dimension: string;
  text: string;
  order_index: number;
  is_reverse_scored: boolean;
  options: AuthoringQuestionOption[];
}

export interface AssessmentVersionSummary {
  id: string;
  assessment_type: AuthoringAssessmentType;
  version: number;
  status: AuthoringVersionStatus;
  title: string;
  notes: string | null;
  created_by: string | null;
}

export interface AssessmentVersionDetail extends AssessmentVersionSummary {
  questions: AuthoringQuestion[];
}

export interface FormulaVersion {
  id: string;
  formula_key: string;
  assessment_type: AuthoringAssessmentType;
  version: number;
  status: AuthoringVersionStatus;
  expression: Record<string, unknown>;
  input_variables: string[];
  output_metric: string;
}

export interface PreflightIssue {
  code: string;
  message: string;
  blocking: boolean;
  path: string | null;
}

export interface VersionPreflight {
  ready_to_publish: boolean;
  blocking_issue_count: number;
  warning_count: number;
  issues: PreflightIssue[];
}

export interface VersionActionInput {
  actor: string;
  note?: string;
}
