import axios from 'axios'
import type { ResumeData, JobData, ATSScore, OptimizeResponse } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const resumeApi = {
  uploadResume: async (file: File): Promise<{ success: boolean; data: ResumeData }> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/resume/upload', formData, {
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

  calculateLiveScore: async (
    resumeData: ResumeData,
    jobData: JobData
  ): Promise<{ success: boolean; data: any }> => {
    const response = await api.post('/analysis/score-live', {
      resume_data: resumeData,
      job_data: jobData,
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
}

export default api
