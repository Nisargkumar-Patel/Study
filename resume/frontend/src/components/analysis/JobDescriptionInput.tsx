import { useState } from 'react'
import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

export function JobDescriptionInput() {
  const [jobText, setJobText] = useState('')
  const { analyzeJob, isLoading, jobDescription } = useResumeStore()
  const { addToast } = useToast()

  const handleAnalyze = async () => {
    if (jobText.trim().length < 50) {
      addToast({ title: 'Too short', description: 'Please paste a complete job description', variant: 'destructive' })
      return
    }
    try {
      await analyzeJob(jobText)
      addToast({ title: 'Job analyzed', description: 'Keywords and requirements extracted', variant: 'success' })
    } catch {
      addToast({ title: 'Analysis failed', description: 'Could not analyze the job description', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Job Description</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Textarea
            placeholder="Paste the job description here..."
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            className="min-h-[200px] resize-y"
            disabled={isLoading}
          />
          <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {jobText.length} characters
          </span>
        </div>

        <Button onClick={handleAnalyze} disabled={isLoading || jobText.trim().length < 50} className="w-full">
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : (
            'Analyze Job Description'
          )}
        </Button>

        {jobDescription && (
          <div className="space-y-3 pt-2">
            {jobDescription.title && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Job Title</p>
                <p className="text-sm font-medium">{jobDescription.title}</p>
              </div>
            )}

            {jobDescription.keywords.required_skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Required Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {jobDescription.keywords.required_skills.slice(0, 15).map((skill, i) => (
                    <Badge key={i} variant="default" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {jobDescription.keywords.preferred_skills.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preferred Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {jobDescription.keywords.preferred_skills.slice(0, 10).map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {jobDescription.years_experience !== undefined && jobDescription.years_experience > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Experience Required</p>
                <p className="text-sm">{jobDescription.years_experience}+ years</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
