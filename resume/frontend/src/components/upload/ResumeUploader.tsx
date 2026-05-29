import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'

export function ResumeUploader() {
  const { uploadResume, uploadLatex, isLoading, originalResume } = useResumeStore()
  const { addToast } = useToast()
  const [fileName, setFileName] = useState<string | null>(null)
  const [latexText, setLatexText] = useState('')

  // ---- PDF dropzone -------------------------------------------------------
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        addToast({ title: 'Invalid file', description: 'Please upload a PDF file', variant: 'destructive' })
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast({ title: 'File too large', description: 'Max file size is 10MB', variant: 'destructive' })
        return
      }
      setFileName(file.name)
      try {
        await uploadResume(file)
        addToast({ title: 'Resume uploaded', description: 'Your resume has been parsed successfully', variant: 'success' })
      } catch {
        addToast({ title: 'Upload failed', description: 'Could not parse your resume. Try again.', variant: 'destructive' })
      }
    },
    [uploadResume, addToast]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: isLoading,
  })

  // ---- LaTeX paste / file ------------------------------------------------
  const submitLatex = useCallback(
    async (text: string, source: string) => {
      const trimmed = text.trim()
      if (trimmed.length < 50) {
        addToast({ title: 'LaTeX is too short', description: 'Paste your full .tex source', variant: 'destructive' })
        return
      }
      setFileName(source)
      try {
        await uploadLatex(trimmed)
        addToast({ title: 'LaTeX parsed', description: 'Original source preserved for export', variant: 'success' })
      } catch {
        addToast({ title: 'Parse failed', description: 'Could not parse the LaTeX source.', variant: 'destructive' })
      }
    },
    [uploadLatex, addToast]
  )

  const onLatexFile = useCallback(
    async (files: File[]) => {
      const file = files[0]
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.tex')) {
        addToast({ title: 'Invalid file', description: 'Please drop a .tex file', variant: 'destructive' })
        return
      }
      const text = await file.text()
      setLatexText(text)
      await submitLatex(text, file.name)
    },
    [submitLatex, addToast]
  )

  const latexDz = useDropzone({
    onDrop: onLatexFile,
    accept: { 'text/x-tex': ['.tex'], 'application/x-tex': ['.tex'] },
    maxFiles: 1,
    disabled: isLoading,
    noClick: true,
  })

  // ---- Success summary (shown in both tabs once a resume is loaded) ------
  const Summary = originalResume ? (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium">Parsed Sections</h4>
      <div className="flex flex-wrap gap-1.5">
        {originalResume.summary && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">Summary</span>
        )}
        {originalResume.experience.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
            Experience ({originalResume.experience.length})
          </span>
        )}
        {originalResume.education.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
            Education ({originalResume.education.length})
          </span>
        )}
        {originalResume.skills.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
            Skills ({originalResume.skills.length})
          </span>
        )}
        {originalResume.certifications.length > 0 && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
            Certifications ({originalResume.certifications.length})
          </span>
        )}
        <span className="px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground">
          Source: {originalResume.source_format === 'latex' ? 'LaTeX' : 'PDF'}
        </span>
      </div>
    </div>
  ) : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upload Your Resume</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Pick one: paste LaTeX (recommended for exact format on export) or upload a PDF.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="latex">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="latex">Paste LaTeX</TabsTrigger>
            <TabsTrigger value="pdf">Upload PDF</TabsTrigger>
          </TabsList>

          {/* LaTeX tab */}
          <TabsContent value="latex" className="space-y-3">
            <div
              {...latexDz.getRootProps()}
              className={`border-2 border-dashed rounded-lg p-3 transition-colors ${
                latexDz.isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <input {...latexDz.getInputProps()} />
              <Textarea
                value={latexText}
                onChange={(e) => setLatexText(e.target.value)}
                placeholder={'Paste your full .tex source here (\\documentclass... \\end{document})\nor drop a .tex file anywhere in this box.'}
                className="min-h-[220px] font-mono text-xs leading-relaxed border-0 focus-visible:ring-0"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => submitLatex(latexText, 'pasted.tex')}
                disabled={isLoading || latexText.trim().length < 50}
              >
                {isLoading ? 'Parsing...' : 'Use this LaTeX'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Your original .tex is preserved and exported back with your edits patched in (no template).
              </p>
            </div>
          </TabsContent>

          {/* PDF tab */}
          <TabsContent value="pdf">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Parsing resume...</p>
                </div>
              ) : originalResume?.source_format === 'pdf' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-3xl">&#10003;</div>
                  <p className="text-sm font-medium">{fileName || 'Resume uploaded'}</p>
                  <p className="text-xs text-muted-foreground">
                    {originalResume.name} &bull; {originalResume.skills.length} skills &bull;{' '}
                    {originalResume.experience.length} experiences
                  </p>
                  <Button variant="outline" size="sm">Upload different resume</Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-4xl">&#128196;</div>
                  <div>
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume PDF'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse (PDF, max 10MB)</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              PDF input cannot be exported back layout-exact. For an exact PDF, paste your LaTeX instead.
            </p>
          </TabsContent>
        </Tabs>

        {Summary}
      </CardContent>
    </Card>
  )
}
