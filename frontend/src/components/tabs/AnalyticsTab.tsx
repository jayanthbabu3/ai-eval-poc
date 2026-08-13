import { useState } from 'react'
import { AlertIcon } from '../Icons'
import {
  CostTrend,
  FailureBars,
  JudgeVsHuman,
  LatencyBands,
  LatencyVsQuality,
  MetricProfile,
  QualityTrend,
  ScoreDistribution,
  VersionComparison,
} from '../analytics/charts'
import { EvaluationsTable, Insights, TOTAL_RECORDS, TopicHeatmap } from '../analytics/panels'
import { COST_MODEL, DAYS, FIRST_DATE, LAST_DATE, QUESTION_COUNT, TOPICS } from '../analytics/data'
import { SERIES, STATUS } from '../analytics/palette'
import { Panel, SectionLabel } from '../analytics/Panel'
import { HeroBand } from '../analytics/HeroBand'
import { RangePicker } from '../analytics/RangePicker'
import { AnalyticsProvider, useView } from '../analytics/view'

/**
 * What production evaluation reporting looks like, on simulated data.
 *
 * Laid out as a bento grid on a twelve-column track rather than a stack of
 * equal cards. Tile area carries importance: the health band spans everything,
 * the trend chart that exposes regressions gets two-thirds of its row, and the
 * supporting charts sit at a third each. A page of identical full-width cards
 * gives the eye no order to read them in.
 *
 * One period governs the whole page. Every tile repeats the resolved dates in
 * its corner, because the second-worst thing a dashboard can do is mix time
 * windows silently, and the worst is to make the reader guess which one a tile
 * is using.
 */
export function AnalyticsTab() {
  return (
    <AnalyticsProvider>
      <AnalyticsBody />
    </AnalyticsProvider>
  )
}

function AnalyticsBody() {
  const [failureFilter, setFailureFilter] = useState<string | null>(null)
  const view = useView()
  const period = view.label
  const count = `${view.summary.count.toLocaleString()} answers`

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="col-span-full flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-[14px] text-accent">
        <AlertIcon className="mt-0.5 shrink-0" />
        <span>
          <strong>Sample data.</strong> {TOTAL_RECORDS.toLocaleString()} evaluations across {DAYS}{' '}
          days ({FIRST_DATE} to {LAST_DATE}), drawn from {QUESTION_COUNT} distinct questions over{' '}
          {TOPICS.length} topics, generated in code to show the reporting we would build once
          connected to live traffic. They are not measured results from a running system, and a
          real deployment would see far more question variety than {QUESTION_COUNT}.
        </span>
      </div>

      <div className="col-span-full">
        <RangePicker />
      </div>

      <div className="col-span-full">
        <HeroBand />
      </div>

      <SectionLabel hint="Generated from the selected period, not written by hand.">
        What the numbers say
      </SectionLabel>

      <Panel
        step={1}
        span={12}
        title="Signals worth acting on"
        meta={`${period} · ${count}`}
        info="These statements are derived from the data in the selected period rather than written by hand, so they stay true when you change the dates. Each is colour-coded by how much attention it needs. In a real deployment these would also trigger alerts rather than waiting for someone to open the page."
      >
        <Insights insights={view.insights} />
      </Panel>

      <SectionLabel hint="Is it getting better or worse, and where exactly is it weak?">
        Quality
      </SectionLabel>

      <Panel
        step={2}
        span={8}
        title="Quality over time"
        accent={SERIES.correctness}
        meta={`${period} · one point per day`}
        info="Four scores tracked daily. Correctness: does it match the known-good answer. Completeness: does it cover everything needed. Faithfulness: is every claim backed by the source documents. Relevancy: does it answer the question asked. The dashed vertical lines are releases that fall inside the selected period, and the shaded band is a period where quality dropped after one — this is the chart that turns a regression from something you hear about into something you can see."
        footer={
          view.deploys.length > 0 ? (
            <ul className="space-y-1">
              {view.deploys.map((deploy) => (
                <li key={deploy.label} className="text-[13px] text-ink-muted">
                  <span className="tabular font-semibold text-ink">{deploy.label}</span> —{' '}
                  {deploy.note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-faint">No release landed inside this period.</p>
          )
        }
      >
        <QualityTrend />
      </Panel>

      <Panel
        step={3}
        span={4}
        title="Metric profile"
        accent={SERIES.relevancy}
        meta={view.previousLabel ? `vs ${view.previousLabel}` : 'no prior period'}
        info="A radar chart plots the four scores on four axes so the overall shape is visible at a glance — a lopsided shape means one dimension is lagging. Radars cannot be read precisely, so the exact numbers and the change against the previous period sit in the table underneath."
      >
        <MetricProfile />
      </Panel>

      <Panel
        step={4}
        span={4}
        title="Score distribution"
        accent={SERIES.correctness}
        meta={`${period} · ${count}`}
        info="A histogram: each bar counts how many answers scored in that ten-point band. It exists because an average of 84 could mean almost everything scored 84, or that half scored 95 and half scored 60 — two very different situations that look identical in a single number. Bars left of the pass mark are shown in red."
        footer={
          <p className="text-[13px] text-ink-faint">
            An average hides shape. Only the histogram shows whether 90 means “mostly 90”.
          </p>
        }
      >
        <ScoreDistribution />
      </Panel>

      <Panel
        step={5}
        span={8}
        title="Where it is weakest"
        accent={SERIES.faithfulness}
        meta={`${period} · topic against metric`}
        info="A heatmap: every combination of topic and metric, with darker blue meaning a stronger score. It answers a question no single average can — not 'how are we doing' but 'which part of the knowledge base is letting us down'. A whole row that is pale means that topic needs content work rather than model work."
      >
        <TopicHeatmap />
      </Panel>

      <SectionLabel hint="Fast enough, cheap enough, and does waiting longer buy anything?">
        Speed and cost
      </SectionLabel>

      <Panel
        step={6}
        span={4}
        title="Latency"
        accent={SERIES.completeness}
        meta={period}
        info="How long answers took, shown as three percentile lines rather than an average. p50 (the median) is the typical experience — half were faster. p95 and p99 are the slow tail: the worst 5% and worst 1%. The gap between the median and p99 is what matters, because a comfortable median with an ugly tail still produces complaints."
      >
        <LatencyBands />
      </Panel>

      <Panel
        span={4}
        title="Spend"
        accent={SERIES.correctness}
        meta={`total $${view.summary.cost.toFixed(2)} · ${COST_MODEL.label} rates`}
        info={`Daily cost of model calls, split between the assistant writing answers and the judge scoring them, priced at ${COST_MODEL.label} rates ($${COST_MODEL.inputPerMillion} per million input tokens, $${COST_MODEL.outputPerMillion} per million output). It is deliberately a separate chart from latency: putting two different measures on one pair of axes makes the eye see a relationship between them that may not exist, which is the most common way a dashboard misleads.`}
      >
        <CostTrend />
      </Panel>

      <Panel
        step={7}
        span={4}
        title="Does slower mean better?"
        accent={STATUS.good}
        meta={`${view.latencyQuality.length} answers plotted`}
        info="A scatter plot: every dot is one answer, positioned by how long it took (across) and how well it scored (up). If the dots form a flat cloud, waiting longer buys no extra quality — useful when someone proposes adding more processing. Colour shows the verdict, with the word in the legend so it never depends on colour alone. Long periods are plotted on an evenly-spaced sample so the cloud stays readable."
      >
        <LatencyVsQuality />
      </Panel>

      <SectionLabel hint="Why any of the numbers above deserve to be believed.">
        Trust and evidence
      </SectionLabel>

      <Panel
        step={8}
        span={5}
        title="Do the judge and a human agree?"
        accent={SERIES.correctness}
        meta={`${view.summary.reviewed} of ${view.summary.count.toLocaleString()} reviewed`}
        info="Every dot is an answer scored by both the AI judge and a person: the judge score across, the human score up. Dots on the dashed diagonal are perfect agreement. The bottom-right quadrant is the one to worry about — answers the judge passed that a human would have failed. This chart is what earns the right to trust the automated scores everywhere else on this page."
      >
        <JudgeVsHuman />
      </Panel>

      <Panel
        step={9}
        span={7}
        title="What is failing"
        accent={STATUS.critical}
        meta={`${period} · click a bar to filter the table`}
        info="How often each automated check failed over the selected period. This is the work queue: an overall score tells you something is wrong, this tells you what to fix first. Red bars are security checks, which block an answer outright rather than just lowering its score."
      >
        <FailureBars onSelect={setFailureFilter} />
      </Panel>

      <Panel
        step={10}
        span={5}
        title="Version comparison"
        accent={SERIES.completeness}
        meta={view.versions.map((entry) => entry.version).join(' · ') || 'none in period'}
        info="The same four metrics averaged for each release that ran inside the selected period, so you can see whether a change actually helped. Comparing like with like matters: the same questions and the same scoring for every version, otherwise a difference could just mean easier questions. Only releases with traffic in this period appear — widen the dates to see more of them."
      >
        <VersionComparison />
      </Panel>

      <Panel
        span={7}
        title="Individual evaluations"
        meta={`worst first · ${period}`}
        info="The raw records behind every chart above, worst-scoring first. Click a row to open its trace: how long each step took, what the judge scored and why, which rule checks failed, and the answer itself. Aggregate charts tell you something is wrong; this is where you find out what actually happened."
      >
        <EvaluationsTable
          filterCheck={failureFilter}
          onClearFilter={() => setFailureFilter(null)}
        />
      </Panel>
    </div>
  )
}
