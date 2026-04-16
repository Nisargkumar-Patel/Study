export interface JobKeywords {
  required_skills: string[]
  preferred_skills: string[]
  technologies: string[]
  keywords: Array<[string, number]> | string[]
  all_skills: string[]
}

export interface JobData {
  title?: string
  company?: string
  description: string
  years_experience?: number
  education_requirements: string[]
  keywords: JobKeywords
  raw_text: string
}
