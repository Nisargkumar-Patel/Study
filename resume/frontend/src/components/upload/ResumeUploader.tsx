import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export function ResumeUploader() {
  const { uploadResume, isLoading, originalResume } = useResumeStore()
  const { addToast } = useToast()
  const [fileName, setFileName] = useState<string | null>(null)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      if (!file.name.endsWith('.pdf')) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upload Your Resume</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />

          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Parsing resume...</p>
            </div>
          ) : originalResume ? (
            <div className="flex flex-col items-center gap-3">
              <div className="text-3xl">&#10003;</div>
              <p className="text-sm font-medium">{fileName || 'Resume uploaded'}</p>
              <p className="text-xs text-muted-foreground">
                {originalResume.name} &bull; {originalResume.skills.length} skills found &bull;{' '}
                {originalResume.experience.length} experiences
              </p>
              <Button variant="outline" size="sm">
                Upload different resume
              </Button>
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

        {originalResume && (
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
