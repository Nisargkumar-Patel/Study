export interface ExperienceItem {
  title: string
  company: string
  location?: string
  start_date: string
  end_date: string
  bullets: string[]
  description?: string
}

export interface EducationItem {
  degree: string
  institution: string
  location?: string
  graduation_date: string
  gpa?: string
  honors?: string
}

export interface ResumeData {
  name: string
  email?: string
  phone?: string
  location?: string
  linkedin?: string
  website?: string
  summary?: string
  experience: ExperienceItem[]
  education: EducationItem[]
  skills: string[]
  certifications: string[]
  projects: any[]
  raw_text?: string
  keywords?: string[]
  formatting_issues?: string[]
}

export interface ParsedResume {
  data: ResumeData
  formatting_issues: string[]
  confidence: number
  sections_found: string[]
}
