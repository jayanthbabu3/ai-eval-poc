"""Aggregates evaluation records into the metrics the dashboard and report show."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from statistics import mean

from pydantic import BaseModel, ConfigDict

from eval_poc.config import REPORTS_DIR, AppConfig
from eval_poc.evaluators.llm_judge import (
    COMPLETENESS,
    CORRECTNESS,
    FAITHFULNESS,
    METRIC_NAMES,
    RELEVANCY,
)
from eval_poc.models import EvalRecord

LATEST_RUN_PATH = REPORTS_DIR / "latest_run.json"


class Summary(BaseModel):
    model_config = ConfigDict(frozen=True)

    total_cases: int
    passed_cases: int
    failed_cases: int
    pass_rate: float
    fail_rate: float
    rule_pass_rate: float
    rule_checks_total: int
    rule_checks_passed: int
    security_violations: int
    avg_correctness: float | None
    avg_completeness: float | None
    avg_faithfulness: float | None
    avg_relevancy: float | None
    avg_latency_ms: float
    p95_latency_ms: float
    max_latency_ms: float
    avg_human_correctness: float | None
    avg_human_clarity: float | None
    human_reviewed_cases: int
    judged_cases: int
    generated_at: str


def _safe_mean(values: list[float]) -> float | None:
    return round(mean(values), 4) if values else None


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round(fraction * (len(ordered) - 1))))
    return round(ordered[index], 2)


def _metric_values(records: list[EvalRecord], metric: str) -> list[float]:
    return [
        score
        for record in records
        if (score := record.judge.score_for(metric)) is not None
    ]


def summarize(records: list[EvalRecord]) -> Summary:
    total = len(records)
    passed = sum(1 for record in records if record.overall_passed)
    checks = [check for record in records for check in record.rules.checks]
    checks_passed = sum(1 for check in checks if check.status == "pass")
    latencies = [record.generation.latency_ms for record in records]
    humans = [record.human for record in records if record.human is not None]

    return Summary(
        total_cases=total,
        passed_cases=passed,
        failed_cases=total - passed,
        pass_rate=round(passed / total, 4) if total else 0.0,
        fail_rate=round((total - passed) / total, 4) if total else 0.0,
        rule_pass_rate=round(checks_passed / len(checks), 4) if checks else 0.0,
        rule_checks_total=len(checks),
        rule_checks_passed=checks_passed,
        security_violations=sum(record.rules.security_violations for record in records),
        avg_correctness=_safe_mean(_metric_values(records, CORRECTNESS)),
        avg_completeness=_safe_mean(_metric_values(records, COMPLETENESS)),
        avg_faithfulness=_safe_mean(_metric_values(records, FAITHFULNESS)),
        avg_relevancy=_safe_mean(_metric_values(records, RELEVANCY)),
        avg_latency_ms=round(mean(latencies), 2) if latencies else 0.0,
        p95_latency_ms=_percentile(latencies, 0.95),
        max_latency_ms=round(max(latencies), 2) if latencies else 0.0,
        avg_human_correctness=_safe_mean([review.correctness for review in humans]),
        avg_human_clarity=_safe_mean([review.clarity for review in humans]),
        human_reviewed_cases=len(humans),
        judged_cases=sum(1 for record in records if record.judge.scores),
        generated_at=datetime.now(UTC).isoformat(),
    )


def build_run_payload(records: list[EvalRecord], config: AppConfig) -> dict:
    """Single JSON shape consumed by both the API and the markdown report."""
    return {
        "summary": summarize(records).model_dump(),
        "config": config.model_dump(),
        "records": [record.model_dump() for record in records],
    }


def save_run(payload: dict, path: Path = LATEST_RUN_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return path


def load_run(path: Path = LATEST_RUN_PATH) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Saved run at {path} is corrupt: {error}") from error


def _fmt(value: float | None, *, pct: bool = False) -> str:
    if value is None:
        return "n/a"
    return f"{value * 100:.1f}%" if pct else f"{value:.2f}"


def render_markdown(payload: dict) -> str:
    summary = Summary.model_validate(payload["summary"])
    lines = [
        "# AI Evaluation Report — IT Knowledge Assistant",
        "",
        f"Generated: {summary.generated_at}",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "| --- | --- |",
        f"| Cases evaluated | {summary.total_cases} |",
        f"| Pass rate | {_fmt(summary.pass_rate, pct=True)} |",
        f"| Fail rate | {_fmt(summary.fail_rate, pct=True)} |",
        f"| Rule pass rate | {_fmt(summary.rule_pass_rate, pct=True)} "
        f"({summary.rule_checks_passed}/{summary.rule_checks_total} checks) |",
        f"| Security violations | {summary.security_violations} |",
        f"| Avg correctness (judge) | {_fmt(summary.avg_correctness)} |",
        f"| Avg completeness (judge) | {_fmt(summary.avg_completeness)} |",
        f"| Avg faithfulness (judge) | {_fmt(summary.avg_faithfulness)} |",
        f"| Avg relevancy (judge) | {_fmt(summary.avg_relevancy)} |",
        f"| Avg latency | {summary.avg_latency_ms:.0f} ms |",
        f"| p95 latency | {summary.p95_latency_ms:.0f} ms |",
        f"| Avg human correctness | {_fmt(summary.avg_human_correctness)} |",
        f"| Avg human clarity | {_fmt(summary.avg_human_clarity)} |",
        f"| Human reviewed cases | {summary.human_reviewed_cases} |",
        "",
        "## Per-case results",
        "",
        "| Case | Category | Result | Rules | Correctness | Faithfulness | Latency |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]

    for record in payload["records"]:
        judge_scores = {item["metric"]: item["score"] for item in record["judge"]["scores"]}
        failed_rules = [
            check["name"] for check in record["rules"]["checks"] if check["status"] == "fail"
        ]
        rules_cell = "pass" if not failed_rules else f"fail: {', '.join(failed_rules)}"
        overall = _overall_from_dict(record)
        lines.append(
            f"| {record['case']['id']} | {record['case']['category']} | "
            f"{'PASS' if overall else 'FAIL'} | {rules_cell} | "
            f"{_fmt(judge_scores.get(CORRECTNESS))} | "
            f"{_fmt(judge_scores.get(FAITHFULNESS))} | "
            f"{record['generation']['latency_ms']:.0f} ms |"
        )

    failures = [record for record in payload["records"] if not _overall_from_dict(record)]
    if failures:
        lines += ["", "## Failure detail", ""]
        for record in failures:
            lines.append(f"### {record['case']['id']} — {record['case']['question']}")
            for check in record["rules"]["checks"]:
                if check["status"] == "fail":
                    lines.append(f"- Rule `{check['name']}`: {check['detail']}")
            for score in record["judge"]["scores"]:
                if score["score"] < score["threshold"]:
                    lines.append(
                        f"- Judge `{score['metric']}` {score['score']:.2f} "
                        f"< {score['threshold']:.2f}: {score['reason']}"
                    )
            lines.append("")

    lines += ["", "## Metric definitions", ""]
    lines += [
        "- **Rule checks** — deterministic gates: response length, forbidden sensitive "
        "keywords, required grounding keywords, latency budget.",
        f"- **Judge metrics** — DeepEval ({', '.join(METRIC_NAMES)}) scored 0-1 by a Groq "
        "judge model, independent of the model under test.",
        "- **Human scores** — reviewer ratings for correctness and clarity on a 1-5 scale.",
        "- **Overall pass** — all rule checks pass AND every judge metric clears its "
        "threshold (judge-skipped cases fall back to rules only).",
    ]
    return "\n".join(lines) + "\n"


def _overall_from_dict(record: dict) -> bool:
    rules_ok = all(check["status"] == "pass" for check in record["rules"]["checks"])
    if not rules_ok:
        return False
    if record["judge"]["skipped_reason"] is not None:
        return True
    scores = record["judge"]["scores"]
    return bool(scores) and all(item["score"] >= item["threshold"] for item in scores)


def save_markdown(payload: dict, path: Path = REPORTS_DIR / "report.md") -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown(payload), encoding="utf-8")
    return path
