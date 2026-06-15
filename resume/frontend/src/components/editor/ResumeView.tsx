import type { ResumeData } from '@/types'

/**
 * Read-only rendering of a resume's parsed content. Used for both the Original
 * (faithful to upload) and the Auto-Optimized panels in the Optimize step.
 *
 * `highlightSkills` (lowercased match) get a subtle badge so the user can see
 * exactly which skills the optimizer added.
 */
export function ResumeView({
  resume,
  highlightSkills = [],
}: {
  resume: ResumeData
  highlightSkills?: string[]
}) {
  const addedSkills = new Set(highlightSkills.map((s) => s.toLowerCase()))

  return (
    <div className="space-y-4 text-sm">
      {resume.name && <p className="font-bold text-lg">{resume.name}</p>}

      {(resume.email || resume.phone || resume.location || resume.linkedin) && (
        <p className="text-xs text-muted-foreground">
          {[resume.email, resume.phone, resume.location, resume.linkedin]
            .filter(Boolean)
            .join('  •  ')}
        </p>
      )}

      {resume.summary && (
        <section>
          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Summary</h4>
          <p className="leading-relaxed">{resume.summary}</p>
        </section>
      )}

      {(resume.experience?.length ?? 0) > 0 && (
        <section>
          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Experience</h4>
          <div className="space-y-3">
            {resume.experience.map((exp, i) => (
              <div key={i}>
                <p className="font-medium">
                  {exp.title}
                  {exp.title && exp.company ? ' — ' : ''}
                  {exp.company}
                </p>
                {(exp.start_date || exp.end_date) && (
                  <p className="text-xs text-muted-foreground">
                    {exp.start_date}
                    {exp.start_date && exp.end_date ? ' – ' : ''}
                    {exp.end_date}
                  </p>
                )}
                {(exp.bullets?.length ?? 0) > 0 && (
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {exp.bullets.map((b, j) => (
                      <li key={j} className="text-xs leading-relaxed">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {exp.description && !exp.bullets?.length && (
                  <p className="text-xs mt-1 leading-relaxed">{exp.description}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(resume.education?.length ?? 0) > 0 && (
        <section>
          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Education</h4>
          <div className="space-y-2">
            {resume.education.map((edu, i) => (
              <div key={i}>
                <p className="font-medium">
                  {edu.degree}
                  {edu.degree && edu.institution ? ' — ' : ''}
                  {edu.institution}
                </p>
                {edu.graduation_date && (
                  <p className="text-xs text-muted-foreground">{edu.graduation_date}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {(resume.skills?.length ?? 0) > 0 && (
        <section>
          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">Skills</h4>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.map((skill, i) => {
              const isAdded = addedSkills.has(skill.toLowerCase())
              return (
                <span
                  key={i}
                  className={
                    'px-2 py-0.5 text-xs rounded-full ' +
                    (isAdded
                      ? 'bg-green-500/15 text-green-600 dark:text-green-400 ring-1 ring-green-500/30'
                      : 'bg-secondary text-secondary-foreground')
                  }
                  title={isAdded ? 'Added by optimizer' : undefined}
                >
                  {skill}
                  {isAdded && ' +'}
                </span>
              )
            })}
          </div>
        </section>
      )}

      {(resume.certifications?.length ?? 0) > 0 && (
        <section>
          <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-1">
            Certifications
          </h4>
          <ul className="list-disc list-inside space-y-0.5">
            {resume.certifications.map((c, i) => (
              <li key={i} className="text-xs">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
