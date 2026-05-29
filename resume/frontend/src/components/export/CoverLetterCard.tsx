import { useEffect, useState } from 'react'
import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/toast'

export function CoverLetterCard() {
  const {
    currentResume,
    jobDescription,
    coverLetterEnabled,
    coverLetter,
    isLoading,
    setCoverLetterEnabled,
    generateCoverLetter,
  } = useResumeStore()
  const { addToast } = useToast()

  const [company, setCompany] = useState(jobDescription?.company ?? '')
  const [title, setTitle] = useState(jobDescription?.title ?? '')
  const [text, setText] = useState('')

  // Keep the editable text in sync when a new letter is generated.
  useEffect(() => {
    setText(coverLetter ?? '')
  }, [coverLetter])

  const ready = !!currentResume && !!jobDescription

  const runGenerate = async () => {
    try {
      await generateCoverLetter(company.trim() || undefined, title.trim() || undefined)
      addToast({ title: 'Cover letter ready', description: 'Generated from your resume and the job', variant: 'success' })
    } catch {
      addToast({ title: 'Generation failed', description: 'Could not generate the cover letter', variant: 'destructive' })
    }
  }

  const handleToggle = async (enabled: boolean) => {
    setCoverLetterEnabled(enabled)
    if (enabled && !coverLetter && ready) {
      await runGenerate()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      addToast({ title: 'Copied', description: 'Cover letter copied to clipboard', variant: 'success' })
    } catch {
      addToast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cover_letter.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg">Cover Letter</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Optional &bull; generated from your resume and the job
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{coverLetterEnabled ? 'On' : 'Off'}</span>
          <Switch checked={coverLetterEnabled} onCheckedChange={handleToggle} disabled={!ready} />
        </div>
      </CardHeader>

      {coverLetterEnabled && (
        <CardContent className="space-y-4">
          {!ready && (
            <p className="text-sm text-muted-foreground">
              Upload a resume and analyze a job description first.
            </p>
          )}

          {ready && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Company</label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Shopify"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Role / Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                  />
                </div>
              </div>

              {isLoading && !coverLetter ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Generating...</div>
              ) : (
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[360px] font-mono text-xs leading-relaxed"
                  placeholder="Your cover letter will appear here."
                />
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={runGenerate} disabled={isLoading}>
                  {coverLetter ? 'Regenerate' : 'Generate'}
                </Button>
                <Button variant="outline" onClick={handleCopy} disabled={!text}>
                  Copy
                </Button>
                <Button variant="outline" onClick={handleDownload} disabled={!text}>
                  Download .txt
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Set the company and role above, then Generate. The text is fully editable before you copy or download.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
