"""Tests for the iterative optimization loop.

The orchestrator is tested with FAKE generator/scorer implementations so the
loop logic (threshold, max-iterations, best-tracking, feedback plumbing,
stagnation, graceful degradation) is verified deterministically with no network.
"""

import pytest

from app.services.iterative_optimizer import (
    IterativeOptimizer,
    ScoreResult,
    GenerationError,
    ScoringError,
    CVWolfScorer,
)


# --- Fakes ----------------------------------------------------------------- #
class FakeGenerator:
    """Records calls; returns a resume tagged with the iteration number."""
    def __init__(self):
        self.calls = []

    def optimize(self, resume_text, job_description, feedback):
        self.calls.append({"resume": resume_text, "feedback": feedback})
        return f"{resume_text} +v{len(self.calls)}"


class ScriptedScorer:
    """Returns a predetermined sequence of scores."""
    def __init__(self, scores):
        self.scores = list(scores)
        self.calls = 0

    def score(self, resume_text, job_description):
        s = self.scores[min(self.calls, len(self.scores) - 1)]
        self.calls += 1
        return ScoreResult(score=s, feedback=f"need more (round {self.calls})")


# --- Threshold / stopping -------------------------------------------------- #
def test_stops_when_threshold_reached():
    gen = FakeGenerator()
    scorer = ScriptedScorer([60, 80, 90])  # crosses 85 on the 3rd round
    opt = IterativeOptimizer(gen, scorer, target_score=85, max_iterations=10)

    result = opt.run("base resume", "jd")

    assert result.success is True
    assert result.stop_reason == "threshold"
    assert result.final_score == 90
    assert result.iterations_run == 3


def test_respects_max_iterations_no_infinite_loop():
    gen = FakeGenerator()
    scorer = ScriptedScorer([10, 20, 30, 40, 50, 60, 70])  # never reaches 85
    opt = IterativeOptimizer(
        gen, scorer, target_score=85, max_iterations=4, stagnation_patience=99
    )

    result = opt.run("base", "jd")

    assert result.success is False
    assert result.stop_reason == "max_iterations"
    assert result.iterations_run == 4
    assert scorer.calls == 4  # exactly the cap, not more


def test_returns_highest_scoring_even_if_last_regresses():
    gen = FakeGenerator()
    # Best is round 2 (75); later rounds regress; never hits threshold.
    scorer = ScriptedScorer([50, 75, 40, 30])
    opt = IterativeOptimizer(
        gen, scorer, target_score=95, max_iterations=4, stagnation_patience=99
    )

    result = opt.run("base", "jd")

    assert result.final_score == 75
    assert "+v2" in result.final_resume  # the v2 resume was the best


def test_stops_on_stagnation():
    gen = FakeGenerator()
    # Improves once, then plateaus -> should stop early.
    scorer = ScriptedScorer([50, 51, 51, 51, 51, 51])
    opt = IterativeOptimizer(
        gen, scorer, target_score=99, max_iterations=10,
        min_improvement=5, stagnation_patience=2,
    )

    result = opt.run("base", "jd")

    assert result.stop_reason == "stagnation"
    # round1=50 (progress), round2=51 (<5 gain -> no progress #1),
    # round3=51 (no progress #2 -> stop)
    assert result.iterations_run == 3


# --- Feedback plumbing ----------------------------------------------------- #
def test_feedback_is_fed_back_into_generator():
    gen = FakeGenerator()
    scorer = ScriptedScorer([60, 90])
    opt = IterativeOptimizer(gen, scorer, target_score=85, max_iterations=5)

    opt.run("base", "jd")

    # First call gets no feedback; second call receives round-1 feedback.
    assert gen.calls[0]["feedback"] is None
    assert "round 1" in gen.calls[1]["feedback"]


# --- Graceful degradation -------------------------------------------------- #
def test_generation_error_on_first_iteration_raises():
    class BoomGen:
        def optimize(self, *a, **k):
            raise GenerationError("gemini down")

    opt = IterativeOptimizer(BoomGen(), ScriptedScorer([50]), max_iterations=3)
    with pytest.raises(GenerationError):
        opt.run("base", "jd")


def test_scoring_error_after_success_returns_best():
    """If scoring fails on a later round, return the best result so far."""
    class FlakyScorer:
        def __init__(self):
            self.calls = 0

        def score(self, resume_text, job_description):
            self.calls += 1
            if self.calls == 1:
                return ScoreResult(score=70, feedback="ok")
            raise ScoringError("cv wolf 500")

    gen = FakeGenerator()
    opt = IterativeOptimizer(
        gen, FlakyScorer(), target_score=95, max_iterations=5, stagnation_patience=99
    )
    result = opt.run("base", "jd")

    assert result.final_score == 70
    assert result.stop_reason in ("error", "max_iterations")


# --- Input validation ------------------------------------------------------ #
def test_empty_inputs_rejected():
    opt = IterativeOptimizer(FakeGenerator(), ScriptedScorer([90]))
    with pytest.raises(ValueError):
        opt.run("", "jd")
    with pytest.raises(ValueError):
        opt.run("resume", "")


def test_invalid_max_iterations_rejected():
    with pytest.raises(ValueError):
        IterativeOptimizer(FakeGenerator(), ScriptedScorer([90]), max_iterations=0)


# --- CV Wolf adapter helpers (pure, no network) ---------------------------- #
def test_cvwolf_dig_nested_path():
    data = {"result": {"match": {"score": 0.82}}}
    assert CVWolfScorer._dig(data, "result.match.score") == 0.82
    assert CVWolfScorer._dig(data, "result.missing.key") is None


def test_cvwolf_score_normalization():
    assert CVWolfScorer._normalize_score(0.82) == 82.0   # fraction -> percent
    assert CVWolfScorer._normalize_score(82) == 82.0     # already percent
    assert CVWolfScorer._normalize_score(99.4) == 99.4


def test_cvwolf_feedback_stringify():
    assert CVWolfScorer._stringify_feedback(None) == ""
    assert CVWolfScorer._stringify_feedback("hi") == "hi"
    assert "- a" in CVWolfScorer._stringify_feedback(["a", "b"])
    assert "- k:" in CVWolfScorer._stringify_feedback({"k": "v"})
