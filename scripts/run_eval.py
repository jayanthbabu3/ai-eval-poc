"""CLI entry point: run the evaluation suite and write the report.

Usage:
    python scripts/run_eval.py                 # all phases
    python scripts/run_eval.py --no-judge      # skip phase 4 (no judge calls)
    python scripts/run_eval.py --cases TC-001 TC-010
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from eval_poc.config import load_config, load_secrets  # noqa: E402
from eval_poc.pipeline import EvaluationPipeline, load_test_cases  # noqa: E402
from eval_poc.report import (  # noqa: E402
    build_run_payload,
    save_markdown,
    save_run,
    summarize,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the AI evaluation suite.")
    parser.add_argument("--no-judge", action="store_true", help="skip the DeepEval phase")
    parser.add_argument("--cases", nargs="*", default=None, help="specific case IDs to run")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config()
    secrets = load_secrets()

    if not secrets.has_groq:
        print(
            "WARNING: GROQ_API_KEY is not set. Answers will be offline stubs and the "
            "LLM judge will be skipped. Rule checks and reporting still run.\n",
            file=sys.stderr,
        )

    cases = load_test_cases()
    if args.cases:
        wanted = set(args.cases)
        cases = [case for case in cases if case.id in wanted]
        if not cases:
            print(f"No test cases matched {sorted(wanted)}", file=sys.stderr)
            return 2

    pipeline = EvaluationPipeline(config=config)

    def progress(index: int, total: int, case_id: str) -> None:
        print(f"[{index}/{total}] evaluating {case_id} ...", flush=True)

    records = pipeline.run(cases, use_judge=not args.no_judge, on_progress=progress)

    payload = build_run_payload(records, config)
    run_path = save_run(payload)
    md_path = save_markdown(payload)
    summary = summarize(records)

    print(
        "\n".join(
            [
                "",
                "=== Evaluation summary ===",
                f"cases:               {summary.total_cases}",
                f"pass rate:           {summary.pass_rate * 100:.1f}%",
                f"rule pass rate:      {summary.rule_pass_rate * 100:.1f}%",
                f"security violations: {summary.security_violations}",
                f"avg correctness:     {summary.avg_correctness if summary.avg_correctness is not None else 'n/a'}",
                f"avg faithfulness:    {summary.avg_faithfulness if summary.avg_faithfulness is not None else 'n/a'}",
                f"avg latency:         {summary.avg_latency_ms:.0f} ms",
                "",
                f"run json: {run_path}",
                f"report:   {md_path}",
            ]
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
