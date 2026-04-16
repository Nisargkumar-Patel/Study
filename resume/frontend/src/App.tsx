import { useState, useEffect } from 'react'
import { useResumeStore } from '@/stores/resumeStore'
import { ToastProvider } from '@/components/ui/toast'
import { ProgressStepper } from '@/components/upload/ProgressStepper'
import { ResumeUploader } from '@/components/upload/ResumeUploader'
import { JobDescriptionInput } from '@/components/analysis/JobDescriptionInput'
import { ATSScoreCard } from '@/components/analysis/ATSScoreCard'
import { SideBySideEditor } from '@/components/editor/SideBySideEditor'
import { TemplateSelector } from '@/components/templates/TemplateSelector'
import { ExportOptions } from '@/components/export/ExportOptions'
import { Button } from '@/components/ui/button'

function AppContent() {
  const [darkMode, setDarkMode] = useState(true)
  const { currentStep, error, setError } = useResumeStore()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error, setError])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">ATS Resume Builder</h1>
            <p className="text-xs text-muted-foreground">Optimize your resume for Applicant Tracking Systems</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? 'Light' : 'Dark'}
          </Button>
        </header>

        {/* Progress Stepper */}
        <div className="mb-8">
          <ProgressStepper />
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Main Content — Step-Based */}
        <main className="space-y-6">
          {/* Step 0: Upload */}
          {currentStep === 0 && (
            <div className="max-w-2xl mx-auto">
              <ResumeUploader />
            </div>
          )}

          {/* Step 1: Analyze */}
          {currentStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <JobDescriptionInput />
              </div>
              <div>
                <ATSScoreCard />
              </div>
            </div>
          )}

          {/* Step 2: Optimize */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                  <SideBySideEditor />
                </div>
                <div>
                  <ATSScoreCard />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Export */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <TemplateSelector />
              <ExportOptions />
              <ATSScoreCard />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          ATS Resume Builder &bull; No paid APIs &bull; Powered by spaCy &amp; TF-IDF
        </footer>
      </div>
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}

export default App
