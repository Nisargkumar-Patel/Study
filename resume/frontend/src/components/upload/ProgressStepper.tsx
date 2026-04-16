import { useResumeStore } from '@/stores/resumeStore'
import { cn } from '@/utils/cn'

const STEPS = [
  { label: 'Upload', description: 'Upload resume PDF' },
  { label: 'Analyze', description: 'Paste job description' },
  { label: 'Optimize', description: 'Review suggestions' },
  { label: 'Export', description: 'Download resume' },
]

export function ProgressStepper() {
  const { currentStep, setCurrentStep, originalResume, jobDescription } = useResumeStore()

  const canNavigate = (stepIndex: number) => {
    if (stepIndex === 0) return true
    if (stepIndex === 1) return !!originalResume
    if (stepIndex === 2) return !!originalResume && !!jobDescription
    if (stepIndex === 3) return !!originalResume && !!jobDescription
    return false
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <div key={index} className="flex items-center flex-1">
            <button
              onClick={() => canNavigate(index) && setCurrentStep(index)}
              disabled={!canNavigate(index)}
              className={cn(
                'flex items-center gap-2 group',
                canNavigate(index) ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              )}
            >
              {/* Step circle */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-colors shrink-0',
                  index < currentStep
                    ? 'bg-primary border-primary text-primary-foreground'
                    : index === currentStep
                    ? 'border-primary text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                )}
              >
                {index < currentStep ? '&#10003;' : index + 1}
              </div>

              {/* Step text */}
              <div className="hidden sm:block">
                <p
                  className={cn(
                    'text-xs font-medium leading-tight',
                    index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground leading-tight">{step.description}</p>
              </div>
            </button>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div className="flex-1 mx-2">
                <div
                  className={cn(
                    'h-0.5 rounded transition-colors',
                    index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
