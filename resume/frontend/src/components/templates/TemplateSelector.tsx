import { useResumeStore } from '@/stores/resumeStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TEMPLATES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional single-column layout',
    preview: 'bg-gradient-to-b from-muted/50 to-muted',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean with subtle color accents',
    preview: 'bg-gradient-to-br from-blue-500/10 to-purple-500/10',
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Optimized for engineering/dev roles',
    preview: 'bg-gradient-to-b from-green-500/10 to-emerald-500/10',
  },
  {
    id: 'executive',
    name: 'Executive',
    description: 'For senior/leadership roles',
    preview: 'bg-gradient-to-b from-amber-500/10 to-orange-500/10',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Maximum readability',
    preview: 'bg-gradient-to-b from-gray-500/5 to-gray-500/10',
  },
]

export function TemplateSelector() {
  const { selectedTemplate, setSelectedTemplate } = useResumeStore()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resume Template</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={`text-left rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                selectedTemplate === template.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-transparent hover:border-muted-foreground/25'
              }`}
            >
              {/* Mini preview */}
              <div className={`rounded-md h-20 mb-2 ${template.preview} flex flex-col gap-1 p-2`}>
                <div className="w-2/3 h-1.5 rounded bg-foreground/20" />
                <div className="w-full h-1 rounded bg-foreground/10" />
                <div className="w-full h-1 rounded bg-foreground/10" />
                <div className="w-3/4 h-1 rounded bg-foreground/10" />
                <div className="w-full h-1 rounded bg-foreground/10 mt-1" />
                <div className="w-2/3 h-1 rounded bg-foreground/10" />
              </div>

              <p className="text-xs font-medium">{template.name}</p>
              <p className="text-xs text-muted-foreground leading-tight">{template.description}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
