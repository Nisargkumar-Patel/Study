import { useState } from 'react'
import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { Suggestion } from '@/types'

interface SuggestionCardProps {
  suggestion: Suggestion
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const { acceptSuggestion, rejectSuggestion } = useResumeStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(suggestion.suggested_text)

  const impactColors: Record<number, string> = {
    5: 'bg-red-500',
    4: 'bg-orange-500',
    3: 'bg-yellow-500',
    2: 'bg-blue-500',
    1: 'bg-gray-500',
  }

  const typeLabels: Record<string, string> = {
    weak_verb: 'Verb',
    missing_keyword: 'Keyword',
    add_metric: 'Metric',
    tone_adjustment: 'Tone',
    formatting: 'Format',
    skill_highlight: 'Skill',
  }

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {typeLabels[suggestion.type] || suggestion.type}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {suggestion.section}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Impact</span>
            <span className={`w-5 h-5 rounded-full text-white text-xs flex items-center justify-center ${impactColors[suggestion.impact] || 'bg-gray-500'}`}>
              {suggestion.impact}
            </span>
          </div>
        </div>

        {suggestion.original_text && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Original</p>
            <p className="text-sm bg-destructive/10 rounded p-2 line-through">{suggestion.original_text}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-muted-foreground mb-1">Suggested</p>
          {isEditing ? (
            <Textarea value={editedText} onChange={(e) => setEditedText(e.target.value)} className="text-sm" />
          ) : (
            <p className="text-sm bg-green-500/10 rounded p-2">{suggestion.suggested_text}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground italic">{suggestion.reason}</p>

        {suggestion.keywords_added.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {suggestion.keywords_added.map((kw, i) => (
              <Badge key={i} className="text-xs bg-green-600">
                +{kw}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => acceptSuggestion(suggestion.id)} className="flex-1">
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? 'Preview' : 'Edit'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => rejectSuggestion(suggestion.id)}>
            Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
