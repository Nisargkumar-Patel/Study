export interface ScoreBreakdown {
  score: number
  percentage: number
  details: Record<string, any>
}

export interface ATSScore {
  overall_score: number
  keyword_match: ScoreBreakdown
  skills_match: ScoreBreakdown
  experience_match: ScoreBreakdown
  education_match: ScoreBreakdown
  formatting_score: ScoreBreakdown
  missing_keywords: string[]
  matched_keywords: string[]
  missing_skills: string[]
  matched_skills: string[]
  formatting_issues: string[]
  suggestions_summary: string[]
  calculated_at?: string
}
