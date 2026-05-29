import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SuggestionCard } from './SuggestionCard'
import { EditableResume } from './EditableResume'

export function SideBySideEditor() {
  const {
    originalResume,
    suggestions,
    generateSuggestions,
    isLoading,
    undo,
    redo,
    historyIndex,
    history,
  } = useResumeStore()

  if (!originalResume) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Upload a resume and analyze a job to start optimizing
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={undo} disabled={historyIndex <= 0}>
            Undo
          </Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={historyIndex >= history.length - 1}>
            Redo
          </Button>
        </div>
        <Button onClick={generateSuggestions} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Suggestions'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Original (read-only) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Original Resume</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {originalResume.name && <p className="font-bold text-lg">{originalResume.name}</p>}

            {originalResume.summary && (
              <div>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Summary</h4>
                <p>{originalResume.summary}</p>
              </div>
            )}

            {originalResume.experience.map((exp, i) => (
              <div key={i}>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">
                  {i === 0 ? 'Experience' : ''}
                </h4>
                <p className="font-medium">
                  {exp.title} — {exp.company}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exp.start_date} - {exp.end_date}
                </p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {exp.bullets.map((b, j) => (
                    <li key={j} className="text-xs">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {originalResume.skills.length > 0 && (
              <div>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Skills</h4>
                <p className="text-xs">{originalResume.skills.join(', ')}</p>
              </div>
            )}

            {originalResume.education.map((edu, i) => (
              <div key={i}>
                <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">
                  {i === 0 ? 'Education' : ''}
                </h4>
                <p className="font-medium">
                  {edu.degree} — {edu.institution}
                </p>
                <p className="text-xs text-muted-foreground">{edu.graduation_date}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Updated (editable) + Suggestions, tabbed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Updated Resume</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="suggestions">Suggestions ({suggestions.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="edit">
                <div className="max-h-[640px] overflow-y-auto pr-1">
                  <EditableResume />
                </div>
              </TabsContent>

              <TabsContent value="suggestions">
                {suggestions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Click "Generate Suggestions" to get optimization recommendations
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
                    {suggestions.map((suggestion) => (
                      <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
