import axios from 'axios'
import type { ResumeData, JobData, ATSScore, OptimizeResponse, AutoOptimizeResponse } from '../types'

// Default to a RELATIVE base ("/api") so requests go through the same origin:
// the Vite dev proxy in development and the nginx `/api` proxy in the Docker
// production build. An absolute VITE_API_URL can still override it if needed.
// (Note: Vite inlines this at BUILD time, so it must be set as a build arg,
// not a runtime container env var.)
const API_BASE_URL = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Surface the backend's error message (FastAPI returns `{ detail: "..." }`)
// instead of axios's opaque "Request failed with status code 500".
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail
    if (detail) {
      error.message = typeof detail === 'string' ? detail : JSON.stringify(detail)
    }
    return Promise.reject(error)
  }
)

export const resumeApi = {
  uploadResume: async (file: File): Promise<{ success: boolean; data: ResumeData }> => {
    const formData = new FormData()
    formData.append('file', file)

    // Route by extension: .docx -> dedicated endpoint, otherwise PDF.
    const isDocx = (file.name || '').toLowerCase().endsWith('.docx')
    const url = isDocx ? '/resume/upload-docx' : '/resume/upload'

    const response = await api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  parseText: async (text: string): Promise<{ success: boolean; data: any }> => {
    const response = await api.post('/resume/parse-text', { text })
    return response.data
  },

  uploadLatex: async (
    latex: string
  ): Promise<{ success: boolean; data: ResumeData }> => {
    const response = await api.post('/resume/upload-latex', { latex })
    return response.data
  },
}

export const analysisApi = {
  analyzeJob: async (jobDescription: string): Promise<{ success: boolean; data: JobData }> => {
    const response = await api.post('/analysis/analyze-job', { job_description: jobDescription })
    return response.data
  },

  calculateScore: async (
    resumeData: ResumeData,
    jobData: JobData
  ): Promise<{ success: boolean; data: ATSScore }> => {
    const response = await api.post('/analysis/score', {
      resume_data: resumeData,
      job_data: jobData,
    })
    return response.data
  },

  generateSuggestions: async (
    resumeData: ResumeData,
    jobData: JobData
  ): Promise<{ success: boolean; data: OptimizeResponse }> => {
    const response = await api.post('/analysis/optimize', {
      resume_data: resumeData,
      job_data: jobData,
    })
    return response.data
  },

  autoOptimize: async (
    resumeData: ResumeData,
    jobData: JobData
  ): Promise<{ success: boolean; data: AutoOptimizeResponse }> => {
    const response = await api.post('/analysis/auto-optimize', {
      resume_data: resumeData,
      job_data: jobData,
    })
    return response.data
  },

  generateCoverLetter: async (
    resumeData: ResumeData,
    jobData: JobData,
    company?: string,
    title?: string
  ): Promise<{ success: boolean; data: { cover_letter: string } }> => {
    const response = await api.post('/analysis/cover-letter', {
      resume_data: resumeData,
      job_data: jobData,
      company,
      title,
    })
    return response.data
  },
}

export const exportApi = {
  exportToPDF: async (resumeData: ResumeData, template: string = 'classic'): Promise<Blob> => {
    const response = await api.post(
      '/export/pdf',
      {
        resume_data: resumeData,
        template,
      },
      {
        responseType: 'blob',
      }
    )
    return response.data
  },

  exportToDOCX: async (resumeData: ResumeData, template: string = 'classic'): Promise<Blob> => {
    const response = await api.post(
      '/export/docx',
      {
        resume_data: resumeData,
        template,
      },
      {
        responseType: 'blob',
      }
    )
    return response.data
  },

  exportToText: async (resumeData: ResumeData): Promise<Blob> => {
    const response = await api.post(
      '/export/text',
      {
        resume_data: resumeData,
      },
      {
        responseType: 'blob',
      }
    )
    return response.data
  },

  exportToLatex: async (
    resumeData: ResumeData,
    original: ResumeData | null
  ): Promise<Blob> => {
    const response = await api.post(
      '/export/latex',
      {
        resume_data: resumeData,
        original,
      },
      { responseType: 'blob' }
    )
    return response.data
  },
}

export default api
