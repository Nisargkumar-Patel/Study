import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResumeView } from './ResumeView'

export function SideBySideEditor() {
  const {
    originalResume,
    optimizedResume,
    currentResume,
    optimizeChanges,
    scoreBefore,
    scoreAfter,
    passesAts,
    passThreshold,
    isLoading,
    useOriginalResume,
  } = useResumeStore()

  if (!originalResume) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Upload a resume and analyze a job to start optimizing
      </div>
    )
  }

  const before = scoreBefore?.overall_score ?? null
  const after = scoreAfter?.overall_score ?? null
  const delta = before != null && after != null ? Math.round((after - before) * 10) / 10 : null

  // Count of automatic improvements applied to the original.
  const improvementCount = optimizeChanges
    ? optimizeChanges.skills_added.length +
      optimizeChanges.summary_keywords_added.length +
      optimizeChanges.bullets_strengthened.length +
      (optimizeChanges.terminology_aligned?.length ?? 0)
    : 0

  // Whether the user is currently exporting the original (reverted) version.
  const usingOriginal = currentResume === originalResume

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {passesAts != null && (
            <span
              className={
                'px-3 py-1 rounded-full text-sm font-semibold ' +
                (passesAts
                  ? 'bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30')
              }
            >
              {passesAts ? '✓ Passes ATS' : 'Below ATS pass mark'}
            </span>
          )}
          {before != null && after != null && (
            <span className="text-sm text-muted-foreground">
              ATS score {before}% → <span className="font-semibold text-foreground">{after}%</span>
              {delta != null && delta > 0 && (
                <span className="text-green-600 dark:text-green-400"> (+{delta})</span>
              )}
              <span className="text-xs"> · pass mark {passThreshold}%</span>
            </span>
          )}
          {improvementCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
              {improvementCount} auto-improvement{improvementCount > 1 ? 's' : ''} applied
            </span>
          )}
        </div>
      </div>

      {/* What the optimizer changed */}
      {optimizeChanges && (
        <Card>
          <CardContent className="py-3 text-xs space-y-1.5">
            <p className="font-medium text-sm">What was changed (automatically, to pass ATS):</p>
            {optimizeChanges.skills_added.length > 0 && (
              <p>
                <span className="text-muted-foreground">Added missing required skills: </span>
                {optimizeChanges.skills_added.join(', ')}
              </p>
            )}
            {optimizeChanges.summary_keywords_added.length > 0 && (
              <p>
                <span className="text-muted-foreground">Wove keywords into summary: </span>
                {optimizeChanges.summary_keywords_added.join(', ')}
              </p>
            )}
            {optimizeChanges.bullets_strengthened.length > 0 && (
              <p>
                <span className="text-muted-foreground">Strengthened action verbs in </span>
                {optimizeChanges.bullets_strengthened.length} bullet
                {optimizeChanges.bullets_strengthened.length > 1 ? 's' : ''}.
              </p>
            )}
            {(optimizeChanges.terminology_aligned?.length ?? 0) > 0 && (
              <p>
                <span className="text-muted-foreground">
                  Aligned wording to the job description:{' '}
                </span>
                {optimizeChanges.terminology_aligned
                  .map((t) => `${t.before} → ${t.after}`)
                  .join(', ')}
              </p>
            )}
            {improvementCount === 0 && (
              <p className="text-muted-foreground">
                No changes needed — your resume already covers this job well.
              </p>
            )}
            <p className="text-muted-foreground pt-1">
              Only truthful edits are applied — no fabricated jobs, dates, or metrics. Education
              and experience history are preserved exactly as uploaded.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Original — faithful to upload */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">
              Original Resume{' '}
              <span className="font-normal">(exactly as uploaded)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto pr-1">
            <ResumeView resume={originalResume} />
          </CardContent>
        </Card>

        {/* Auto-optimized — read-only */}
        <Card className={usingOriginal ? '' : 'ring-2 ring-primary/30'}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm">
                Your Final Resume{' '}
                <span className="font-normal text-muted-foreground">(this is what gets exported)</span>
              </CardTitle>
            </div>
            {improvementCount > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant={usingOriginal ? 'outline' : 'default'}
                  onClick={() => {
                    if (optimizedResume) useOriginalResume(false)
                  }}
                  disabled={!usingOriginal}
                >
                  Use optimized
                </Button>
                <Button
                  size="sm"
                  variant={usingOriginal ? 'default' : 'outline'}
                  onClick={() => useOriginalResume(true)}
                  disabled={usingOriginal}
                >
                  Use original instead
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto pr-1">
            {currentResume ? (
              <ResumeView
                resume={currentResume}
                highlightSkills={usingOriginal ? [] : optimizeChanges?.skills_added ?? []}
              />
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isLoading ? 'Generating optimized resume…' : 'Analyze a job to generate the optimized resume.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
