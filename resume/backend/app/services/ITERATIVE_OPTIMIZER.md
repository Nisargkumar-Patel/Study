# Iterative Resume Optimizer (Gemini × CV Wolf)

Improve → score → repeat loop. A **generator** (Gemini) rewrites the resume; a
**scorer** (CV Wolf, or a local fallback) scores it against the JD; the scorer's
feedback is fed back into the next generation. The loop stops when the score
clears a threshold, plateaus, or hits a hard iteration cap, and always returns
the **highest-scoring** resume.

## Quick start

```python
from app.services.iterative_optimizer import build_optimizer

optimizer = build_optimizer(target_score=85.0, max_iterations=5)
result = optimizer.run(base_resume=resume_text, job_description=jd_text)

print(result.final_resume)   # highest-scoring resume
print(result.final_score)    # 0–100
print(result.success)        # True if threshold reached
print(result.stop_reason)    # threshold | max_iterations | stagnation | error
for a in result.history:     # per-iteration trace
    print(a.iteration, a.score, a.feedback)
```

## Configuration (environment variables)

| Var | Required | Purpose |
|-----|----------|---------|
| `GEMINI_API_KEY` | yes | Auth for Gemini. |
| `GEMINI_MODEL` | no | Default `gemini-2.5-flash`. |
| `CVWOLF_BASE_URL` | no¹ | CV Wolf API base URL. If unset, the **local fallback scorer** is used. |
| `CVWOLF_API_KEY` | no | Bearer token for CV Wolf. |
| `CVWOLF_SCORE_PATH` | no | Dotted path to the score in CV Wolf's JSON (default `score`). |
| `CVWOLF_FEEDBACK_PATH` | no | Dotted path to feedback (default `feedback`). |

¹ If `CVWOLF_BASE_URL` is not set, the loop still runs using `LocalATSScorer`
(reuses this app's keyword engine) — useful for testing and as a no-dependency
default.

Install the Gemini SDK: `pip install google-genai`

## ⚠️ CV Wolf API is UNVERIFIED

I could not confirm a public, documented CV Wolf API. The request/response shape
in `CVWolfScorer` is an **assumption**. Before production use, confirm CV Wolf's
real endpoint and adjust:

- the path in `score()` (currently `{base_url}/score`)
- the request body in `_build_payload`
- `CVWOLF_SCORE_PATH` / `CVWOLF_FEEDBACK_PATH` to match the real JSON

If CV Wolf has **no API** (website only), either keep `LocalATSScorer`, or
implement a headless-browser automation behind the same `ResumeScorer.score()`
interface — the orchestrator won't change.

## Safety properties

- **No infinite loop**: hard cap `max_iterations` (validated ≥ 1).
- **Early stop**: stops after `stagnation_patience` rounds without `min_improvement`.
- **Graceful degradation**: a later-round API failure returns the best result so
  far; a first-round failure (nothing produced) raises.
- **Best-tracking**: returns the highest score seen, even if a later round regressed.
- **Truthful prompt**: Gemini is instructed never to fabricate employers, dates,
  titles, degrees, or metrics — only to rephrase/reorganize/keyword-align real content.

## Swapping services

`IterativeOptimizer` depends only on the `ResumeGenerator` and `ResumeScorer`
Protocols. To use a different LLM or scorer, implement those two methods and pass
your instances to the constructor. See `tests/test_iterative_optimizer.py` for
fake implementations.
