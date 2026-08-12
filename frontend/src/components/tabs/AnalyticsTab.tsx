import { useState } from 'react'
import { Banner, Card } from '../Primitives'
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
import {
  EvaluationsTable,
  Insights,
  KpiStrip,
  TOTAL_RECORDS,
  TopicHeatmap,
} from '../analytics/panels'
import { buildInsights, DAYS, DEPLOYS } from '../analytics/data'

/**
 * What production evaluation reporting looks like, on simulated data.
 *
 * Every chart here answers a question somebody actually asks in a review, in
 * roughly the order they ask it: how are we doing, is it getting worse, where
 * is it worst, what is failing, is it fast and affordable, can we trust the
 * numbers, did the last change help, and show me one.
 */
export function AnalyticsTab() {
  const [failureFilter, setFailureFilter] = useState<string | null>(null)
  const insights = buildInsights()

  return (
    <div className="space-y-4">
      <Banner tone="warn">
        <span className="flex items-start gap-2">
          <AlertIcon className="mt-0.5 shrink-0" />
          <span>
            <strong>Sample data.</strong> These {TOTAL_RECORDS.toLocaleString()} evaluations over{' '}
            {DAYS} days are generated in code to show the reporting we would build once connected
            to live traffic. They are not measured results from a running system.
          </span>
        </span>
      </Banner>

      <Card
        step={1}
        title="How is the assistant doing?"
        subtitle="Last 7 days, against the 7 before it. Sparklines cover the last 14."
        info="Each tile has its own ⓘ explaining what that number means and why we track it. The small chart in every tile is a sparkline — the last 14 days of that metric, showing direction rather than exact values. The coloured arrow compares this week with last; green always means the number moved in the good direction, which for latency and spend means downwards."
      >
        <KpiStrip />
      </Card>

      <Card
        step={2}
        title="What the numbers say"
        subtitle="Read this first — the charts below are the evidence for it."
        info="These statements are generated from the data rather than written by hand, so they stay true if the underlying numbers change. Each is colour-coded by how much attention it needs. In a real deployment these would also trigger alerts rather than waiting for someone to open the page."
      >
        <Insights insights={insights} />
      </Card>

      <Card
        step={3}
        title="Quality over time"
        infoTitle="Quality over time"
        info="Four scores tracked daily. Correctness: does it match the known-good answer. Completeness: does it cover everything needed. Faithfulness: is every claim backed by the source documents. Relevancy: does it answer the question asked. The dashed vertical lines are releases, and the shaded band is a period where quality dropped after one — this is the chart that turns a regression from something you hear about into something you can see."
        subtitle={`All four judge metrics across ${DAYS} days, with deploys marked. This is how a regression becomes visible instead of being inferred.`}
      >
        <QualityTrend />
        <div className="mt-3 space-y-1.5">
          {DEPLOYS.map((deploy) => (
            <p key={deploy.label} className="text-[13px] text-ink-muted">
              <span className="tabular font-semibold text-ink">{deploy.label}</span> — {deploy.note}
            </p>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          step={4}
          title="Score distribution"
        infoTitle="Score distribution"
        info="A histogram: each bar counts how many answers scored in that ten-point band. It exists because an average of 84 could mean almost everything scored 84, or that half scored 95 and half scored 60 — two very different situations that look identical in a single number. Bars left of the pass mark are shown in red."
          subtitle="An average of 84 can mean everything near 84, or half at 95 and half at 60. Only the shape tells you which."
        >
          <ScoreDistribution />
        </Card>

        <Card
          step={5}
          title="Metric profile"
        infoTitle="Metric profile"
        info="A radar chart plots the four scores on four axes so the overall shape is visible at a glance — a lopsided shape means one dimension is lagging. Radars cannot be read precisely, so the exact numbers and the change against last week sit in the table underneath."
          subtitle="This week against last. Exact figures below the shape, since a radar cannot be read precisely."
        >
          <MetricProfile />
        </Card>
      </div>

      <Card
        step={6}
        title="Where it is weakest"
        infoTitle="Where it is weakest"
        info="A heatmap: every combination of topic and metric, with darker blue meaning a stronger score. It answers a question no single average can — not 'how are we doing' but 'which part of the knowledge base is letting us down'. A whole row that is pale means that topic needs content work rather than model work."
        subtitle="Topic against metric. Darker is stronger. This is the chart that tells you which part of the knowledge base needs work."
      >
        <TopicHeatmap />
      </Card>

      <Card
        step={7}
        title="What is failing"
        infoTitle="What is failing"
        info="How often each automated check failed over the period. This is the work queue: an overall score tells you something is wrong, this tells you what to fix first. Red bars are security checks, which block an answer outright rather than just lowering its score."
        subtitle="Every rule failure in the last 7 days. Click a bar to filter the table below to those answers."
      >
        <FailureBars onSelect={setFailureFilter} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          step={8}
          title="Latency"
        infoTitle="Latency"
        info="How long answers took, shown as three percentile lines rather than an average. p50 (the median) is the typical experience — half were faster. p95 and p99 are the slow tail: the worst 5% and worst 1%. The gap between the median and p99 is what matters, because a comfortable median with an ugly tail still produces complaints."
          subtitle="Percentile bands, not an average — the median is comfortable and the tail is what users remember."
        >
          <LatencyBands />
        </Card>

        <Card
          title="Spend"
        infoTitle="Spend"
        info="Estimated daily cost of model calls. It is deliberately a separate chart from latency: putting two different measures on one pair of axes makes the eye see a relationship between them that may not exist, which is the most common way a dashboard misleads."
          subtitle="Kept as its own chart. Two measures on one pair of axes invents a relationship that is not in the data."
        >
          <CostTrend />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          step={9}
          title="Does slower mean better?"
        infoTitle="Does slower mean better?"
        info="A scatter plot: every dot is one answer, positioned by how long it took (across) and how well it scored (up). If the dots form a flat cloud, waiting longer buys no extra quality — useful when someone proposes adding more processing. Colour shows the verdict, with the word in the legend so it never depends on colour alone."
          subtitle="Latency against final score. If the cloud is flat, waiting longer buys nothing."
        >
          <LatencyVsQuality />
        </Card>

        <Card
          title="Do the judge and a human agree?"
        infoTitle="Do the judge and a human agree?"
        info="Every dot is an answer scored by both the AI judge and a person: the judge score across, the human score up. Dots on the dashed diagonal are perfect agreement. The bottom-right quadrant is the one to worry about — answers the judge passed that a human would have failed. This chart is what earns the right to trust the automated scores everywhere else on this page."
          subtitle="The chart that decides whether any of the automated numbers above can be trusted."
        >
          <JudgeVsHuman />
        </Card>
      </div>

      <Card
        step={10}
        title="Version comparison"
        infoTitle="Version comparison"
        info="The same four metrics averaged for each release of the assistant, so you can see whether a change actually helped. Comparing like with like matters: the same questions and the same scoring for every version, otherwise a difference could just mean easier questions."
        subtitle="The same metrics across every release. v2.3 is visibly the outlier."
      >
        <VersionComparison />
      </Card>

      <Card
        title="Individual evaluations"
        infoTitle="Individual evaluations"
        info="The raw records behind every chart above, worst-scoring first. Click a row to open its trace: how long each step took, what the judge scored and why, which rule checks failed, and the answer itself. Aggregate charts tell you something is wrong; this is where you find out what actually happened."
        subtitle="Worst first. Click any row for the full trace — retrieval, prompt, generation, checks and judge."
      >
        <EvaluationsTable
          filterCheck={failureFilter}
          onClearFilter={() => setFailureFilter(null)}
        />
      </Card>
    </div>
  )
}
