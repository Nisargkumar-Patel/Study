import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function ScoreCircle({ score }: { score: number }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444'

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

function ScoreSection({ label, score, max }: { label: string; score: number; max: number }) {
  const percentage = max > 0 ? (score / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">{Math.round(percentage)}%</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  )
}

export function ATSScoreCard() {
  const { atsScore, isLoading } = useResumeStore()

  if (isLoading && !atsScore) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ATS Score</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="w-36 h-36 rounded-full mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!atsScore) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ATS Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground text-sm">
            Upload a resume and analyze a job description to see your ATS score
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ATS Compatibility Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <ScoreCircle score={atsScore.overall_score} />

        <div className="space-y-3">
          <ScoreSection label="Keyword Match" score={atsScore.keyword_match.score} max={100} />
          <ScoreSection label="Skills Match" score={atsScore.skills_match.score} max={100} />
          <ScoreSection label="Experience" score={atsScore.experience_match.score} max={100} />
          <ScoreSection label="Education" score={atsScore.education_match.score} max={100} />
          <ScoreSection label="Formatting" score={atsScore.formatting_score.score} max={100} />
        </div>

        {atsScore.missing_keywords.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2">Missing Keywords</p>
            <div className="flex flex-wrap gap-1">
              {atsScore.missing_keywords.slice(0, 12).map((kw, i) => (
                <Badge key={i} variant="destructive" className="text-xs">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {atsScore.matched_keywords.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2">Matched Keywords</p>
            <div className="flex flex-wrap gap-1">
              {atsScore.matched_keywords.slice(0, 12).map((kw, i) => (
                <Badge key={i} variant="default" className="text-xs bg-green-600">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const missingKw = atsScore.missing_keywords.slice(0, 5)
          const missingSk = atsScore.missing_skills.slice(0, 5)
          const tips: string[] = []

          if (missingSk.length > 0) {
            tips.push(`Add these required skills to your Skills section: ${missingSk.join(', ')}.`)
          }
          if (missingKw.length > 0) {
            tips.push(`Work these keywords into your experience/summary: ${missingKw.join(', ')}.`)
          }
          if (atsScore.experience_match.percentage < 80) {
            tips.push('Make relevant experience more prominent (titles, recent roles).')
          }
          if (atsScore.education_match.percentage < 90) {
            tips.push('State your education/degree clearly so the parser can read it.')
          }
          if (atsScore.formatting_score.percentage < 100 && atsScore.formatting_issues.length > 0) {
            tips.push(`Fix formatting: ${atsScore.formatting_issues.slice(0, 2).join('; ')}.`)
          }
          if (tips.length === 0) {
            tips.push('Strong match — no major gaps detected for this job.')
          }

          return (
            <div>
              <p className="text-xs font-medium mb-2">How to improve this score</p>
              <ul className="space-y-1.5">
                {tips.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary">&#8226;</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}
