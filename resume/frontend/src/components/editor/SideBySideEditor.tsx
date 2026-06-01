import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ResumeView } from './ResumeView'

export function SideBySideEditor() {
  const {
    originalResume,
    optimizedResume,
    optimizeChanges,
    scoreBefore,
    scoreAfter,
    passesAts,
    passThreshold,
    isLoading,
    autoOptimize,
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

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
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
        </div>
        <Button size="sm" variant="outline" onClick={autoOptimize} disabled={isLoading}>
          {isLoading ? 'Optimizing…' : 'Re-run optimization'}
        </Button>
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
            {optimizeChanges.skills_added.length === 0 &&
              optimizeChanges.summary_keywords_added.length === 0 &&
              optimizeChanges.bullets_strengthened.length === 0 && (
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
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Updated Resume{' '}
              <span className="font-normal text-muted-foreground">
                (auto-optimized — this is what exports)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[640px] overflow-y-auto pr-1">
            {optimizedResume ? (
              <ResumeView
                resume={optimizedResume}
                highlightSkills={optimizeChanges?.skills_added ?? []}
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
