import { useResumeStore } from '@/stores/resumeStore'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import type { ResumeData, ExperienceItem, EducationItem } from '@/types'

/**
 * Inline-editable view of the *current* (optimized) resume. Every change is
 * pushed through `updateResume`, which appends to the store's history so undo
 * and redo work as expected.
 */
export function EditableResume() {
  const { currentResume, updateResume } = useResumeStore()

  if (!currentResume) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Upload a resume to start editing
      </div>
    )
  }

  const r = currentResume

  const patch = (changes: Partial<ResumeData>) => updateResume({ ...r, ...changes })

  const updateExp = (index: number, changes: Partial<ExperienceItem>) => {
    const experience = r.experience.map((e, i) => (i === index ? { ...e, ...changes } : e))
    patch({ experience })
  }
  const updateBullet = (expIdx: number, bulletIdx: number, value: string) => {
    const experience = r.experience.map((e, i) =>
      i === expIdx
        ? { ...e, bullets: e.bullets.map((b, j) => (j === bulletIdx ? value : b)) }
        : e
    )
    patch({ experience })
  }
  const addBullet = (expIdx: number) => {
    const experience = r.experience.map((e, i) =>
      i === expIdx ? { ...e, bullets: [...e.bullets, ''] } : e
    )
    patch({ experience })
  }
  const removeBullet = (expIdx: number, bulletIdx: number) => {
    const experience = r.experience.map((e, i) =>
      i === expIdx ? { ...e, bullets: e.bullets.filter((_, j) => j !== bulletIdx) } : e
    )
    patch({ experience })
  }

  const updateEdu = (index: number, changes: Partial<EducationItem>) => {
    const education = r.education.map((e, i) => (i === index ? { ...e, ...changes } : e))
    patch({ education })
  }

  const updateSkills = (value: string) => {
    const skills = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    patch({ skills })
  }

  return (
    <div className="space-y-5 text-sm">
      {/* Header */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Header</h4>
        <Input
          value={r.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Full name"
          className="font-semibold text-base"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={r.email ?? ''}
            onChange={(e) => patch({ email: e.target.value })}
            placeholder="Email"
          />
          <Input
            value={r.phone ?? ''}
            onChange={(e) => patch({ phone: e.target.value })}
            placeholder="Phone"
          />
          <Input
            value={r.location ?? ''}
            onChange={(e) => patch({ location: e.target.value })}
            placeholder="Location (City, Province)"
          />
          <Input
            value={r.linkedin ?? ''}
            onChange={(e) => patch({ linkedin: e.target.value })}
            placeholder="linkedin.com/in/..."
          />
        </div>
      </section>

      {/* Summary */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Summary</h4>
        <Textarea
          value={r.summary ?? ''}
          onChange={(e) => patch({ summary: e.target.value })}
          placeholder="Short professional summary"
          className="min-h-[80px]"
        />
      </section>

      {/* Experience */}
      <section className="space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Experience</h4>
        {r.experience.length === 0 && (
          <p className="text-xs text-muted-foreground">No experience parsed.</p>
        )}
        {r.experience.map((exp, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={exp.title}
                onChange={(e) => updateExp(i, { title: e.target.value })}
                placeholder="Title"
              />
              <Input
                value={exp.company}
                onChange={(e) => updateExp(i, { company: e.target.value })}
                placeholder="Company"
              />
              <Input
                value={exp.start_date}
                onChange={(e) => updateExp(i, { start_date: e.target.value })}
                placeholder="Start"
              />
              <Input
                value={exp.end_date}
                onChange={(e) => updateExp(i, { end_date: e.target.value })}
                placeholder="End (or Present)"
              />
            </div>
            <div className="space-y-1.5">
              {exp.bullets.map((b, j) => (
                <div key={j} className="flex gap-2">
                  <Textarea
                    value={b}
                    onChange={(e) => updateBullet(i, j, e.target.value)}
                    placeholder="Achievement (include a metric where possible)"
                    className="min-h-[44px] text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBullet(i, j)}
                    aria-label="Remove bullet"
                  >
                    &times;
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => addBullet(i)}>
                + Add bullet
              </Button>
            </div>
          </div>
        ))}
      </section>

      {/* Education */}
      <section className="space-y-3">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Education</h4>
        {r.education.length === 0 && (
          <p className="text-xs text-muted-foreground">No education parsed.</p>
        )}
        {r.education.map((edu, i) => (
          <div key={i} className="rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={edu.degree}
              onChange={(e) => updateEdu(i, { degree: e.target.value })}
              placeholder="Degree"
            />
            <Input
              value={edu.institution}
              onChange={(e) => updateEdu(i, { institution: e.target.value })}
              placeholder="Institution"
            />
            <Input
              value={edu.graduation_date}
              onChange={(e) => updateEdu(i, { graduation_date: e.target.value })}
              placeholder="Graduation date"
            />
            <Input
              value={edu.gpa ?? ''}
              onChange={(e) => updateEdu(i, { gpa: e.target.value })}
              placeholder="GPA (optional)"
            />
          </div>
        ))}
      </section>

      {/* Skills */}
      <section className="space-y-2">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground">Skills</h4>
        <Textarea
          value={r.skills.join(', ')}
          onChange={(e) => updateSkills(e.target.value)}
          placeholder="Comma-separated, e.g. Python, AWS, Kubernetes"
          className="min-h-[60px]"
        />
      </section>
    </div>
  )
}
