export interface Assessment {
  id: string;
  title: string;
  description?: string;
  is_age_branched?: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  question_type: string;
  section_index: number;
}
