import { useState } from 'react'
import { useResumeStore } from '@/stores/resumeStore'
import { exportApi } from '@/utils/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export function ExportOptions() {
  const { currentResume, originalResume, selectedTemplate } = useResumeStore()
  const { addToast } = useToast()
  const [exporting, setExporting] = useState<string | null>(null)

  const sourceFormat = originalResume?.source_format ?? null

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExport = async (format: 'pdf' | 'docx' | 'text' | 'latex') => {
    if (!currentResume) {
      addToast({ title: 'No resume', description: 'Upload a resume first', variant: 'destructive' })
      return
    }

    setExporting(format)
    try {
      let blob: Blob
      let filename: string

      if (format === 'pdf') {
        blob = await exportApi.exportToPDF(currentResume, selectedTemplate)
        filename = `resume_${selectedTemplate}.pdf`
      } else if (format === 'docx') {
        blob = await exportApi.exportToDOCX(currentResume, selectedTemplate)
        filename = `resume_${selectedTemplate}.docx`
      } else if (format === 'latex') {
        blob = await exportApi.exportToLatex(currentResume, originalResume)
        filename = 'resume.tex'
      } else {
        blob = await exportApi.exportToText(currentResume)
        filename = 'resume.txt'
      }

      downloadBlob(blob, filename)
      addToast({ title: 'Exported', description: `Resume downloaded as ${format.toUpperCase()}`, variant: 'success' })
    } catch {
      addToast({ title: 'Export failed', description: `Could not export as ${format.toUpperCase()}`, variant: 'destructive' })
    } finally {
      setExporting(null)
    }
  }

  const handleCopyText = async () => {
    if (!currentResume) return
    try {
      const blob = await exportApi.exportToText(currentResume)
      const text = await blob.text()
      await navigator.clipboard.writeText(text)
      addToast({ title: 'Copied', description: 'Resume text copied to clipboard', variant: 'success' })
    } catch {
      addToast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  const fidelityNote = sourceFormat === 'latex'
    ? 'Source: LaTeX. The LaTeX export is your original .tex with your edits patched in — open in Overleaf to compile your exact PDF. PDF/Word here are ATS-plain regenerations and will not match your LaTeX styling.'
    : sourceFormat === 'pdf'
      ? 'Source: PDF. PDF/Word/LaTeX exports here are ATS-plain regenerations from the parsed content — they cannot reproduce your original PDF layout. For an exact format, re-upload as LaTeX.'
      : 'Upload a resume to enable exports.'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Export Resume</CardTitle>
      </CardHeader>
      <CardContent>
        {currentResume && (
          <div className="mb-4 p-3 rounded-md bg-muted/50 text-xs">
            <span className="font-medium">Exporting: </span>
            {currentResume.name || 'Resume'} · {currentResume.experience?.length ?? 0} experience
            {(currentResume.experience?.length ?? 0) === 1 ? '' : 's'} · {currentResume.skills?.length ?? 0} skills
            {originalResume && currentResume === originalResume && (
              <span className="text-amber-600 dark:text-amber-400"> · original (un-optimized) version</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={() => handleExport('pdf')}
            disabled={!currentResume || exporting !== null}
          >
            <span className="text-2xl">&#128196;</span>
            <span className="text-xs font-medium">
              {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
            </span>
            <span className="text-xs text-muted-foreground">ATS-plain</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={() => handleExport('docx')}
            disabled={!currentResume || exporting !== null}
          >
            <span className="text-2xl">&#128462;</span>
            <span className="text-xs font-medium">
              {exporting === 'docx' ? 'Exporting...' : 'Word'}
            </span>
            <span className="text-xs text-muted-foreground">ATS-plain</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={() => handleExport('latex')}
            disabled={!currentResume || exporting !== null}
          >
            <span className="text-2xl">&#128221;</span>
            <span className="text-xs font-medium">
              {exporting === 'latex' ? 'Exporting...' : 'LaTeX'}
            </span>
            <span className="text-xs text-muted-foreground">
              {sourceFormat === 'latex' ? 'patched source' : 'Overleaf template'}
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={() => handleExport('text')}
            disabled={!currentResume || exporting !== null}
          >
            <span className="text-2xl">&#128196;</span>
            <span className="text-xs font-medium">
              {exporting === 'text' ? 'Exporting...' : 'Text'}
            </span>
            <span className="text-xs text-muted-foreground">Plain text</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-4 flex flex-col gap-1.5"
            onClick={handleCopyText}
            disabled={!currentResume}
          >
            <span className="text-2xl">&#128203;</span>
            <span className="text-xs font-medium">Copy</span>
            <span className="text-xs text-muted-foreground">Clipboard</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">{fidelityNote}</p>
      </CardContent>
    </Card>
  )
}
