import { useState, useEffect } from 'react'

function App() {
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    // Apply dark mode by default
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">ATS Resume Builder</h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="px-4 py-2 rounded bg-primary text-primary-foreground"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </header>

        <main>
          <div className="text-center py-20">
            <h2 className="text-2xl mb-4">Welcome to ATS Resume Builder</h2>
            <p className="text-muted-foreground">
              Optimize your resume for Applicant Tracking Systems with AI-powered suggestions
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
