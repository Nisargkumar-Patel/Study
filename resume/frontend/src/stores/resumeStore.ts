import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ResumeData, JobData, ATSScore, Suggestion, OptimizeChanges } from '../types'
import { resumeApi, analysisApi } from '../utils/api'

function applySuggestionToResume(
  resume: ResumeData,
  suggestion: Suggestion,
  text: string
): ResumeData {
  switch (suggestion.section) {
    case 'summary':
      return { ...resume, summary: text }

    case 'experience': {
      const expIndex = suggestion.location?.experience_index
      const bulletIndex = suggestion.location?.bullet_index
      if (expIndex == null || bulletIndex == null) return resume
      const experience = resume.experience.map((exp, i) =>
        i === expIndex
          ? { ...exp, bullets: exp.bullets.map((b, j) => (j === bulletIndex ? text : b)) }
          : exp
      )
      return { ...resume, experience }
    }

    case 'skills': {
      if (suggestion.keywords_added.length > 0) {
        const existing = new Set(resume.skills.map((s) => s.toLowerCase()))
        const additions = suggestion.keywords_added.filter(
          (kw) => !existing.has(kw.toLowerCase())
        )
        return { ...resume, skills: [...resume.skills, ...additions] }
      }
      const skills = text
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean)
      return { ...resume, skills }
    }

    default:
      return resume
  }
}

interface ResumeState {
  // State
  originalResume: ResumeData | null
  currentResume: ResumeData | null
  optimizedResume: ResumeData | null
  optimizeChanges: OptimizeChanges | null
  scoreBefore: ATSScore | null
  scoreAfter: ATSScore | null
  passesAts: boolean | null
  passThreshold: number
  jobDescription: JobData | null
  atsScore: ATSScore | null
  suggestions: Suggestion[]
  history: ResumeData[]
  historyIndex: number
  selectedTemplate: string
  coverLetterEnabled: boolean
  coverLetter: string | null
  isLoading: boolean
  error: string | null
  currentStep: number

  // Actions
  setOriginalResume: (resume: ResumeData) => void
  updateResume: (resume: ResumeData) => void
  setJobDescription: (job: JobData) => void
  setATSScore: (score: ATSScore) => void
  setSuggestions: (suggestions: Suggestion[]) => void
  acceptSuggestion: (id: string, editedText?: string) => void
  rejectSuggestion: (id: string) => void
  undo: () => void
  redo: () => void
  reset: () => void
  setSelectedTemplate: (template: string) => void
  setCoverLetterEnabled: (enabled: boolean) => void
  setCoverLetter: (text: string | null) => void
  setCurrentStep: (step: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Switch the exported resume between the optimized and original versions.
  useOriginalResume: (useOriginal: boolean) => void

  // Async actions
  uploadResume: (file: File) => Promise<void>
  uploadLatex: (latex: string) => Promise<void>
  analyzeJob: (jobText: string) => Promise<void>
  autoOptimize: () => Promise<void>
  calculateScore: () => Promise<void>
  generateSuggestions: () => Promise<void>
  generateCoverLetter: (company?: string, title?: string) => Promise<void>
}

export const useResumeStore = create<ResumeState>()(
  devtools(
    (set, get) => ({
      // Initial state
      originalResume: null,
      currentResume: null,
      optimizedResume: null,
      optimizeChanges: null,
      scoreBefore: null,
      scoreAfter: null,
      passesAts: null,
      passThreshold: 75,
      jobDescription: null,
      atsScore: null,
      suggestions: [],
      history: [],
      historyIndex: -1,
      selectedTemplate: 'classic',
      coverLetterEnabled: false,
      coverLetter: null,
      isLoading: false,
      error: null,
      currentStep: 0,

      // Synchronous actions
      setOriginalResume: (resume) =>
        set(() => ({
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

      acceptSuggestion: (id, editedText) =>
        set((state) => {
          const suggestion = state.suggestions.find((s) => s.id === id)
          if (!suggestion || !state.currentResume) return state

          const text = editedText ?? suggestion.suggested_text
          const updatedResume = applySuggestionToResume(state.currentResume, suggestion, text)

          const updatedSuggestions = state.suggestions.filter((s) => s.id !== id)

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
          // Clear all job/optimize-derived state so the UI doesn't show stale
          // before/after scores or "improvements applied" against a resume
          // that has been reverted to the original.
          jobDescription: null,
          optimizedResume: null,
          optimizeChanges: null,
          scoreBefore: null,
          scoreAfter: null,
          passesAts: null,
          coverLetter: null,
          coverLetterEnabled: false,
          error: null,
          currentStep: state.originalResume ? 1 : 0,
        })),

      setSelectedTemplate: (template) => set({ selectedTemplate: template }),

      setCoverLetterEnabled: (enabled) => set({ coverLetterEnabled: enabled }),

      setCoverLetter: (text) => set({ coverLetter: text }),

      useOriginalResume: (useOriginal) =>
        set((state) => {
          // Don't blank the editor if the optimized version isn't available.
          if (!useOriginal && !state.optimizedResume) return state
          return {
            currentResume: useOriginal ? state.originalResume : state.optimizedResume,
            atsScore: useOriginal ? state.scoreBefore : state.scoreAfter,
          }
        }),

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

      uploadLatex: async (latex) => {
        set({ isLoading: true, error: null })
        try {
          const response = await resumeApi.uploadLatex(latex)
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
          set({ error: error.message || 'Failed to parse LaTeX resume' })
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

            // Auto-generate the optimized resume (also computes before/after
            // scores). Falls back to a plain score if optimization fails.
            const { originalResume } = get()
            if (originalResume) {
              try {
                await get().autoOptimize()
              } catch {
                // autoOptimize set an error; recover with a plain score and
                // clear the banner so a recovered failure isn't surfaced.
                await get().calculateScore()
                set({ error: null })
              }
            }
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to analyze job description' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      autoOptimize: async () => {
        // Always optimize from the ORIGINAL upload so re-runs are idempotent.
        const { originalResume, jobDescription } = get()
        if (!originalResume || !jobDescription) return

        set({ isLoading: true, error: null })
        try {
          const response = await analysisApi.autoOptimize(originalResume, jobDescription)
          if (response.success) {
            const d = response.data
            set({
              optimizedResume: d.optimized_resume,
              // The optimized resume is what gets scored and exported.
              currentResume: d.optimized_resume,
              optimizeChanges: d.changes,
              scoreBefore: d.score_before,
              scoreAfter: d.score_after,
              atsScore: d.score_after,
              passesAts: d.passes_ats,
              passThreshold: d.pass_threshold,
            })
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to optimize resume' })
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

      generateCoverLetter: async (company, title) => {
        const { currentResume, jobDescription } = get()
        if (!currentResume || !jobDescription) return

        set({ isLoading: true, error: null })
        try {
          const response = await analysisApi.generateCoverLetter(
            currentResume,
            jobDescription,
            company,
            title
          )
          if (response.success) {
            set({ coverLetter: response.data.cover_letter })
          }
        } catch (error: any) {
          set({ error: error.message || 'Failed to generate cover letter' })
          throw error
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    { name: 'ResumeStore' }
  )
)
