// ============================================
// Holand Assessment Types
// Shared contract between the frontend assessment flow (Phase 6)
// and the report/counselor surfaces (Phase 7).
//
// NOTE: The Assessment/Recommendation/Reporting services (Phase 2-5) are
// being implemented in parallel branches. These types describe the REST
// contract the frontend expects; adjust field names here first if the
// backend contract changes, then update `assessment.service.ts` /
// `report.service.ts` / `counselor.service.ts` accordingly.
// ============================================

export type TestType = 'holland' | 'mbti' | 'combined';

export type RiasecDimension = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export type MbtiDimensionPair = 'EI' | 'SN' | 'TF' | 'JP';

/** Product age bands — drive tone, vocabulary and visual density. */
export type AgeBand = '13-17' | '18-24' | '25-30' | '30+';

export type QuestionKind = 'likert5' | 'binary_choice';

export interface QuestionOption {
  value: number | string;
  label: string;
}

export interface AssessmentQuestion {
  id: string;
  order: number;
  testType: TestType;
  /** RIASEC letter or MBTI pair this question contributes to. */
  dimension: RiasecDimension | MbtiDimensionPair;
  /** For MBTI binary questions: which pole this option maps to. */
  pole?: string;
  kind: QuestionKind;
  prompt: string;
  /** Age-adapted phrasing overrides, keyed by age band (optional). */
  promptByAgeBand?: Partial<Record<AgeBand, string>>;
  options: QuestionOption[];
}

export interface AssessmentAnswer {
  questionId: string;
  value: number | string;
  answeredAt: string;
}

export type AssessmentSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface AssessmentSession {
  sessionId: string;
  testType: TestType;
  ageBand: AgeBand;
  status: AssessmentSessionStatus;
  totalQuestions: number;
  questions: AssessmentQuestion[];
  createdAt: string;
}

export interface StartAssessmentRequest {
  testType: TestType;
  ageBand: AgeBand;
  displayName?: string;
}

export interface SubmitAnswerRequest {
  sessionId: string;
  questionId: string;
  value: number | string;
}

export interface DimensionScore {
  dimension: string;
  label: string;
  rawScore: number;
  normalizedScore: number;
  /** 0-1, how decisive this dimension is relative to its neighbors. */
  certainty?: number;
}

export interface AssessmentResult {
  sessionId: string;
  testType: TestType;
  ageBand: AgeBand;
  completedAt: string;
  holland?: {
    dimensions: DimensionScore[];
    top3Code: string;
  };
  mbti?: {
    dimensions: DimensionScore[];
    typeCode: string;
  };
}

export interface RecommendationItem {
  title: string;
  fitScore: number;
  why: string;
}

export interface ActionPlanStep {
  horizon: '3m' | '6m' | '12m';
  title: string;
  description: string;
}

export interface AssessmentReport extends AssessmentResult {
  strengths: string[];
  growthAreas: string[];
  careers: RecommendationItem[];
  majors: RecommendationItem[];
  actionPlan: ActionPlanStep[];
  disclaimer: string;
}

export interface CounselorStudentSummary {
  sessionId: string;
  studentName: string;
  ageBand: AgeBand;
  testType: TestType;
  status: AssessmentSessionStatus;
  progressPercent: number;
  topCode?: string;
  updatedAt: string;
}

export interface CounselorDashboardStats {
  totalStudents: number;
  completedAssessments: number;
  inProgressAssessments: number;
  averageCompletionPercent: number;
  dimensionAverages: DimensionScore[];
}

export interface CounselorDashboardData {
  stats: CounselorDashboardStats;
  students: CounselorStudentSummary[];
}
