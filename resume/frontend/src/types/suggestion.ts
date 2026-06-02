export enum SuggestionType {
  WEAK_VERB = 'weak_verb',
  MISSING_KEYWORD = 'missing_keyword',
  ADD_METRIC = 'add_metric',
  TONE_ADJUSTMENT = 'tone_adjustment',
  FORMATTING = 'formatting',
  SKILL_HIGHLIGHT = 'skill_highlight',
}

export interface Suggestion {
  id: string
  type: SuggestionType
  section: string
  original_text: string
  suggested_text: string
  reason: string
  impact: number
  keywords_added: string[]
  location?: Record<string, any>
  accepted: boolean
}

export interface OptimizeResponse {
  suggestions: Suggestion[]
  total_suggestions: number
  high_impact_count: number
  potential_score_increase: number
}

export interface OptimizeChanges {
  skills_added: string[]
  summary_keywords_added: string[]
  bullets_strengthened: {
    experience_index: number
    bullet_index: number
    before: string
    after: string
  }[]
  terminology_aligned: {
    before: string
    after: string
  }[]
}

export interface AutoOptimizeResponse {
  optimized_resume: import('./resume').ResumeData
  changes: OptimizeChanges
  score_before: import('./score').ATSScore
  score_after: import('./score').ATSScore
  passes_ats: boolean
  pass_threshold: number
}
