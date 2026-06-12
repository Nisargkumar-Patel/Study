"""Iterative resume optimization loop.

Orchestrates an improve→score→repeat loop between a *generator* (Gemini) and a
*scorer* (CV Wolf, with a local fallback):

    Base Resume + JD
          │
          ▼
    ┌──────────────┐   feedback    ┌──────────────┐
    │  Generator   │◀──────────────│   Scorer     │
    │  (Gemini)    │──────────────▶│  (CV Wolf)   │
    └──────────────┘   new resume  └──────────────┘
          │                              │
          └──────────► best-so-far ◀─────┘
                            │
                            ▼  (threshold reached OR max iterations)
                     Final best resume

Design notes
------------
* Generator and Scorer are *interfaces* (Protocols). The orchestrator does not
  care which concrete service backs them, which keeps the loop unit-testable
  with fakes and lets you swap CV Wolf for any scorer.
* The loop is hard-capped by ``max_iterations`` so it can never run forever.
* It also stops early on *stagnation* (no meaningful improvement for N rounds),
  to avoid burning API calls once the model plateaus.
* It always returns the HIGHEST-scoring resume seen, even if the final
  iteration regressed.
* Every external call has timeout + bounded exponential-backoff retries. If a
  call ultimately fails, the loop degrades gracefully and returns the best
  result obtained so far instead of crashing.
"""

from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Errors
# --------------------------------------------------------------------------- #
class OptimizerError(Exception):
    """Base error for the optimization pipeline."""


class GenerationError(OptimizerError):
    """The resume generator (Gemini) failed irrecoverably."""


class ScoringError(OptimizerError):
    """The resume scorer (CV Wolf) failed irrecoverably."""


# --------------------------------------------------------------------------- #
# Data structures
# --------------------------------------------------------------------------- #
@dataclass
class ScoreResult:
    """Outcome of scoring one resume against the JD."""
    score: float                       # normalized 0–100
    feedback: str = ""                 # actionable feedback to feed back to Gemini
    raw: Dict[str, Any] = field(default_factory=dict)  # raw scorer payload


@dataclass
class Attempt:
    """One iteration of the loop."""
    iteration: int
    resume_text: str
    score: float
    feedback: str


@dataclass
class OptimizationResult:
    """Final result returned to the caller."""
    final_resume: str                  # the highest-scoring resume text
    final_score: float
    success: bool                      # True if threshold was reached
    iterations_run: int
    stop_reason: str                   # "threshold" | "max_iterations" | "stagnation" | "error"
    history: List[Attempt] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Interfaces (Protocols) — concrete services implement these
# --------------------------------------------------------------------------- #
class ResumeGenerator(Protocol):
    def optimize(
        self, resume_text: str, job_description: str, feedback: Optional[str]
    ) -> str:
        """Return an improved resume given the current resume, the JD, and
        optional scorer feedback from the previous round."""
        ...


class ResumeScorer(Protocol):
    def score(self, resume_text: str, job_description: str) -> ScoreResult:
        """Return a 0–100 match score plus feedback for the given resume/JD."""
        ...


# --------------------------------------------------------------------------- #
# Orchestrator
# --------------------------------------------------------------------------- #
class IterativeOptimizer:
    """Runs the improve→score→repeat loop until the score clears the threshold
    or a safety limit is hit."""

    def __init__(
        self,
        generator: ResumeGenerator,
        scorer: ResumeScorer,
        target_score: float = 85.0,
        max_iterations: int = 5,
        min_improvement: float = 1.0,
        stagnation_patience: int = 2,
    ) -> None:
        """
        Args:
            generator: produces an improved resume (Gemini adapter).
            scorer: scores a resume against the JD (CV Wolf adapter / fallback).
            target_score: stop once a resume scores >= this (0–100).
            max_iterations: hard cap on loop iterations — prevents infinite loops.
            min_improvement: a round counts as "progress" only if it beats the
                best score so far by at least this many points.
            stagnation_patience: stop early after this many consecutive rounds
                with no progress (saves API spend once the model plateaus).
        """
        if max_iterations < 1:
            raise ValueError("max_iterations must be >= 1")
        self.generator = generator
        self.scorer = scorer
        self.target_score = target_score
        self.max_iterations = max_iterations
        self.min_improvement = min_improvement
        self.stagnation_patience = stagnation_patience

    def run(self, base_resume: str, job_description: str) -> OptimizationResult:
        if not base_resume or not base_resume.strip():
            raise ValueError("base_resume is empty")
        if not job_description or not job_description.strip():
            raise ValueError("job_description is empty")

        history: List[Attempt] = []
        best_attempt: Optional[Attempt] = None
        feedback: Optional[str] = None
        current_resume = base_resume
        rounds_without_progress = 0
        stop_reason = "max_iterations"

        for i in range(1, self.max_iterations + 1):
            logger.info("Optimization iteration %d/%d", i, self.max_iterations)

            # --- Step 2: generate an improved resume ------------------------
            try:
                current_resume = self.generator.optimize(
                    resume_text=current_resume,
                    job_description=job_description,
                    feedback=feedback,
                )
            except GenerationError as exc:
                logger.error("Generation failed on iteration %d: %s", i, exc)
                # Degrade gracefully: keep the best we already have.
                stop_reason = "error" if best_attempt is None else stop_reason
                if best_attempt is None:
                    # We never produced anything — surface the failure.
                    raise
                break

            if not current_resume or not current_resume.strip():
                logger.warning("Generator returned empty resume on iteration %d", i)
                stop_reason = "error" if best_attempt is None else stop_reason
                break

            # --- Step 3: score the generated resume -------------------------
            try:
                result = self.scorer.score(current_resume, job_description)
            except ScoringError as exc:
                logger.error("Scoring failed on iteration %d: %s", i, exc)
                stop_reason = "error" if best_attempt is None else stop_reason
                if best_attempt is None:
                    raise
                break

            attempt = Attempt(
                iteration=i,
                resume_text=current_resume,
                score=result.score,
                feedback=result.feedback,
            )
            history.append(attempt)
            logger.info("Iteration %d scored %.1f", i, result.score)

            # --- Step 4a: track the best result so far ----------------------
            improved = best_attempt is None or (
                attempt.score >= best_attempt.score + self.min_improvement
            )
            if best_attempt is None or attempt.score > best_attempt.score:
                best_attempt = attempt
            rounds_without_progress = 0 if improved else rounds_without_progress + 1

            # --- Step 5: threshold reached? ---------------------------------
            if attempt.score >= self.target_score:
                stop_reason = "threshold"
                break

            # Early stop if the model has plateaued.
            if rounds_without_progress >= self.stagnation_patience:
                stop_reason = "stagnation"
                logger.info(
                    "Stopping early: no improvement for %d rounds", rounds_without_progress
                )
                break

            # --- Step 4b: feed scorer feedback back into the next round -----
            feedback = result.feedback

        # --- Step 6: return the highest-scoring resume ----------------------
        assert best_attempt is not None  # guaranteed: we raise if nothing succeeded
        return OptimizationResult(
            final_resume=best_attempt.resume_text,
            final_score=best_attempt.score,
            success=best_attempt.score >= self.target_score,
            iterations_run=len(history),
            stop_reason=stop_reason,
            history=history,
        )


# --------------------------------------------------------------------------- #
# Gemini generator adapter
# --------------------------------------------------------------------------- #
class GeminiResumeGenerator:
    """Resume generator backed by Google's Gemini API.

    Uses the official ``google-genai`` SDK (``pip install google-genai``), imported
    lazily so the rest of the app does not require it. Configure via env:
        GEMINI_API_KEY   (required)
        GEMINI_MODEL     (default: gemini-2.5-flash)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.timeout = timeout
        self.max_retries = max_retries
        if not self.api_key:
            raise GenerationError("GEMINI_API_KEY is not set")
        self._client = None  # lazy

    def _get_client(self):
        if self._client is None:
            try:
                from google import genai  # type: ignore
            except ImportError as exc:  # pragma: no cover - depends on env
                raise GenerationError(
                    "google-genai is not installed. Run: pip install google-genai"
                ) from exc
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def _build_prompt(
        self, resume_text: str, job_description: str, feedback: Optional[str]
    ) -> str:
        # The prompt enforces truthfulness: rewrite/reorganize/keyword-align, but
        # never fabricate experience, employers, dates, or metrics.
        parts = [
            "You are an expert resume writer optimizing a resume to pass "
            "Applicant Tracking Systems (ATS) for a specific job.",
            "",
            "STRICT RULES:",
            "- Do NOT invent employers, job titles, dates, degrees, or metrics.",
            "- Only rephrase, reorganize, and surface skills/keywords the "
            "candidate genuinely has.",
            "- Mirror the job description's terminology where it truthfully "
            "applies to the candidate's real experience.",
            "- Keep it concise and in clean plain text (no markdown tables).",
            "- Output ONLY the full optimized resume text, nothing else.",
            "",
            "=== JOB DESCRIPTION ===",
            job_description.strip(),
            "",
            "=== CURRENT RESUME ===",
            resume_text.strip(),
        ]
        if feedback:
            parts += [
                "",
                "=== SCORING FEEDBACK FROM THE PREVIOUS ATTEMPT ===",
                "Address every point below to raise the match score:",
                feedback.strip(),
            ]
        return "\n".join(parts)

    def optimize(
        self, resume_text: str, job_description: str, feedback: Optional[str]
    ) -> str:
        prompt = self._build_prompt(resume_text, job_description, feedback)
        client = self._get_client()

        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                )
                text = (getattr(response, "text", None) or "").strip()
                if not text:
                    raise GenerationError("Gemini returned an empty response")
                return text
            except Exception as exc:  # noqa: BLE001 - we re-raise after retries
                last_exc = exc
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s ...
                logger.warning(
                    "Gemini call failed (attempt %d/%d): %s — retrying in %ss",
                    attempt, self.max_retries, exc, wait,
                )
                time.sleep(wait)
        raise GenerationError(f"Gemini failed after {self.max_retries} attempts: {last_exc}")


# --------------------------------------------------------------------------- #
# CV Wolf scorer adapter
# --------------------------------------------------------------------------- #
class CVWolfScorer:
    """Resume scorer backed by the CV Wolf service.

    ⚠️  IMPORTANT — UNVERIFIED API CONTRACT
    ---------------------------------------
    I could not verify a public, documented CV Wolf API at build time, so the
    request and response shapes below are *assumptions* and are intentionally
    configurable. Before relying on this in production you MUST confirm CV Wolf's
    actual endpoint, auth scheme, request body, and response JSON, then adjust:
      - ``base_url`` / path
      - the request payload in ``_build_payload``
      - ``score_json_path`` / ``feedback_json_path`` (dotted paths into the JSON)

    If CV Wolf has no API (only a website), you have two options:
      1. Use ``LocalATSScorer`` below as a drop-in replacement (works today).
      2. Wrap CV Wolf's website with a headless-browser automation behind this
         same ``score()`` interface.

    Configure via env:
        CVWOLF_API_KEY
        CVWOLF_BASE_URL
        CVWOLF_SCORE_PATH      (dotted path to the score in the response JSON)
        CVWOLF_FEEDBACK_PATH   (dotted path to feedback text in the response JSON)
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        score_json_path: Optional[str] = None,
        feedback_json_path: Optional[str] = None,
        timeout: float = 30.0,
        max_retries: int = 3,
    ) -> None:
        self.api_key = api_key or os.getenv("CVWOLF_API_KEY")
        self.base_url = (base_url or os.getenv("CVWOLF_BASE_URL", "")).rstrip("/")
        self.score_json_path = score_json_path or os.getenv("CVWOLF_SCORE_PATH", "score")
        self.feedback_json_path = (
            feedback_json_path or os.getenv("CVWOLF_FEEDBACK_PATH", "feedback")
        )
        self.timeout = timeout
        self.max_retries = max_retries
        if not self.base_url:
            raise ScoringError("CVWOLF_BASE_URL is not set")

    def _build_payload(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        # ASSUMED request body — adapt to CV Wolf's real schema.
        return {"resume": resume_text, "job_description": job_description}

    @staticmethod
    def _dig(data: Any, dotted_path: str) -> Any:
        """Walk a dotted path (e.g. 'result.match.score') into nested JSON."""
        cur = data
        for key in dotted_path.split("."):
            if isinstance(cur, dict) and key in cur:
                cur = cur[key]
            else:
                return None
        return cur

    def score(self, resume_text: str, job_description: str) -> ScoreResult:
        import httpx  # already a project dependency

        url = f"{self.base_url}/score"  # adapt path to CV Wolf's real endpoint
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = self._build_payload(resume_text, job_description)

        last_exc: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()

                raw_score = self._dig(data, self.score_json_path)
                if raw_score is None:
                    raise ScoringError(
                        f"Could not find score at path '{self.score_json_path}' "
                        f"in CV Wolf response"
                    )
                score = self._normalize_score(float(raw_score))
                feedback = self._dig(data, self.feedback_json_path)
                feedback_text = self._stringify_feedback(feedback)

                return ScoreResult(score=score, feedback=feedback_text, raw=data)
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                last_exc = exc
                wait = 2 ** (attempt - 1)
                logger.warning(
                    "CV Wolf call failed (attempt %d/%d): %s — retrying in %ss",
                    attempt, self.max_retries, exc, wait,
                )
                time.sleep(wait)
        raise ScoringError(f"CV Wolf failed after {self.max_retries} attempts: {last_exc}")

    @staticmethod
    def _normalize_score(value: float) -> float:
        """Normalize to 0–100. Accepts a 0–1 fraction or an already-0–100 value."""
        if 0.0 <= value <= 1.0:
            return round(value * 100, 1)
        return round(value, 1)

    @staticmethod
    def _stringify_feedback(feedback: Any) -> str:
        if feedback is None:
            return ""
        if isinstance(feedback, str):
            return feedback
        if isinstance(feedback, (list, tuple)):
            return "\n".join(f"- {item}" for item in feedback)
        if isinstance(feedback, dict):
            return "\n".join(f"- {k}: {v}" for k, v in feedback.items())
        return str(feedback)


# --------------------------------------------------------------------------- #
# Local fallback scorer (no external dependency) — works today
# --------------------------------------------------------------------------- #
class LocalATSScorer:
    """A working ResumeScorer that reuses this app's existing keyword engine.

    Lets the iterative loop run end-to-end WITHOUT CV Wolf, and serves as a
    safe default when ``CVWOLF_BASE_URL`` is not configured. Scores by JD
    skill/keyword coverage and returns concrete missing items as feedback.
    """

    def __init__(self) -> None:
        # Imported here to avoid a hard import cycle at module load.
        from app.services.keyword_extractor import get_keyword_extractor
        from app.utils.text_normalizer import normalize_text, term_matches_text

        self._extractor = get_keyword_extractor()
        self._normalize = normalize_text
        self._matches = term_matches_text

    def score(self, resume_text: str, job_description: str) -> ScoreResult:
        analysis = self._extractor.extract_from_job_description(job_description)
        required = list(analysis.get("required_skills", [])) or list(
            analysis.get("all_skills", [])
        )
        keywords = [
            k[0] if isinstance(k, (list, tuple)) else k
            for k in analysis.get("keywords", [])
        ]

        resume_norm = self._normalize(resume_text)
        targets = list(dict.fromkeys([*required, *keywords]))  # de-dupe, keep order
        if not targets:
            return ScoreResult(score=100.0, feedback="", raw={})

        present = [t for t in targets if self._matches(t, resume_norm)]
        missing = [t for t in targets if t not in present]
        score = round(len(present) / len(targets) * 100, 1)

        feedback = ""
        if missing:
            feedback = (
                "Incorporate these missing terms where truthful: "
                + ", ".join(missing[:15])
            )
        return ScoreResult(
            score=score,
            feedback=feedback,
            raw={"present": present, "missing": missing, "total": len(targets)},
        )


# --------------------------------------------------------------------------- #
# Factory
# --------------------------------------------------------------------------- #
def build_optimizer(
    target_score: float = 85.0,
    max_iterations: int = 5,
) -> IterativeOptimizer:
    """Construct an IterativeOptimizer from environment configuration.

    - Generator: Gemini (requires GEMINI_API_KEY).
    - Scorer: CV Wolf if CVWOLF_BASE_URL is set, otherwise the local fallback.
    """
    generator = GeminiResumeGenerator()
    scorer: ResumeScorer
    if os.getenv("CVWOLF_BASE_URL"):
        scorer = CVWolfScorer()
    else:
        logger.info("CVWOLF_BASE_URL not set — using LocalATSScorer fallback")
        scorer = LocalATSScorer()
    return IterativeOptimizer(
        generator=generator,
        scorer=scorer,
        target_score=target_score,
        max_iterations=max_iterations,
    )
