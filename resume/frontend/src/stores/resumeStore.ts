import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ResumeData, JobData, ATSScore, Suggestion } from '../types'
import { resumeApi, analysisApi } from '../utils/api'

interface ResumeState {
  // State
  originalResume: ResumeData | null
  currentResume: ResumeData | null
  jobDescription: JobData | null
  atsScore: ATSScore | null
  suggestions: Suggestion[]
  history: ResumeData[]
  historyIndex: number
  selectedTemplate: string
  isLoading: boolean
  error: string | null
  currentStep: number

  // Actions
  setOriginalResume: (resume: ResumeData) => void
  updateResume: (resume: ResumeData) => void
  setJobDescription: (job: JobData) => void
  setATSScore: (score: ATSScore) => void
  setSuggestions: (suggestions: Suggestion[]) => void
  acceptSuggestion: (id: string) => void
  rejectSuggestion: (id: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
  setSelectedTemplate: (template: string) => void
  setCurrentStep: (step: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Async actions
  uploadResume: (file: File) => Promise<void>
  analyzeJob: (jobText: string) => Promise<void>
  calculateScore: () => Promise<void>
  generateSuggestions: () => Promise<void>
}

export const useResumeStore = create<ResumeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      originalResume: null,
      currentResume: null,
      jobDescription: null,
      atsScore: null,
      suggestions: [],
      history: [],
      historyIndex: -1,
      selectedTemplate: 'classic',
      isLoading: false,
      error: null,
      currentStep: 0,

      // Synchronous actions
      setOriginalResume: (resume) =>
        set((state) => ({
          originalResume: resume,
          currentResume: resume,
          history: [resume],
          historyIndex: 0,
        })),

      updateResume: (resume) =>
        set((state) => {
          const newHistory = state.history.slice(0, state.historyIndex + 1)
          newHistory.push(resume)
          return {
            currentResume: resume,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          }
        }),

      setJobDescription: (job) => set({ jobDescription: job }),

      setATSScore: (score) => set({ atsScore: score }),

      setSuggestions: (suggestions) => set({ suggestions }),

      acceptSuggestion: (id) =>
        set((state) => {
          const suggestion = state.suggestions.find((s) => s.id === id)
          if (!suggestion || !state.currentResume) return state

          // Apply suggestion to resume (simplified)
          const updatedResume = { ...state.currentResume }

          // Mark suggestion as accepted
          const updatedSuggestions = state.suggestions.filter((s) => s.id !== id)

          // Add to history
          const newHistory = state.history.slice(0, state.historyIndex + 1)
          newHistory.push(updatedResume)

          return {
            currentResume: updatedResume,
            suggestions: updatedSuggestions,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          }
        }),

      rejectSuggestion: (id) =>
        set((state) => ({
          suggestions: state.suggestions.filter((s) => s.id !== id),
        })),

      undo: () =>
        set((state) => {
          if (state.historyIndex > 0) {
            return {
              historyIndex: state.historyIndex - 1,
              currentResume: state.history[state.historyIndex - 1],
            }
          }
          return state
        }),

      redo: () =>
        set((state) => {
          if (state.historyIndex < state.history.length - 1) {
            return {
              historyIndex: state.historyIndex + 1,
              currentResume: state.history[state.historyIndex + 1],
            }
          }
          return state
        }),

      reset: () =>
        set((state) => ({
          currentResume: state.originalResume,
          history: state.originalResume ? [state.originalResume] : [],
          historyIndex: 0,
          suggestions: [],
          atsScore: null,
        })),

      setSelectedTemplate: (template) => set({ selectedTemplate: template }),

      setCurrentStep: (step) => set({ currentStep: step }),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      // Async actions
      uploadResume: async (file) => {
        set({ isLoading: true, error: null })
        try {
          const response = await resumeApi.uploadResume(file)
          if (response.success) {
            set({
              originalResume: response.data,
              currentResume: response.data,
              history: [response.data],
              historyIndex: 0,
              currentStep: 1,
            })
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to upload resume' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      analyzeJob: async (jobText) => {
        set({ isLoading: true, error: null })
        try {
          const response = await analysisApi.analyzeJob(jobText)
          if (response.success) {
            set({
              jobDescription: response.data,
              currentStep: 2,
            })

            // Auto-calculate score if resume exists
            const { currentResume } = get()
            if (currentResume) {
              await get().calculateScore()
            }
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to analyze job description' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      calculateScore: async () => {
        const { currentResume, jobDescription } = get()
        if (!currentResume || !jobDescription) return

        set({ isLoading: true, error: null })
        try {
          const response = await analysisApi.calculateScore(currentResume, jobDescription)
          if (response.success) {
            set({ atsScore: response.data })
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to calculate score' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      generateSuggestions: async () => {
        const { currentResume, jobDescription } = get()
        if (!currentResume || !jobDescription) return

        set({ isLoading: true, error: null })
        try {
          const response = await analysisApi.generateSuggestions(currentResume, jobDescription)
          if (response.success) {
            set({
              suggestions: response.data.suggestions,
              currentStep: 3,
            })
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to generate suggestions' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    { name: 'ResumeStore' }
  )
)
