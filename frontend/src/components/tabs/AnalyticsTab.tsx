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
      >
        <KpiStrip />
      </Card>

      <Card
        step={2}
        title="What the numbers say"
        subtitle="Read this first — the charts below are the evidence for it."
      >
        <Insights insights={insights} />
      </Card>

      <Card
        step={3}
        title="Quality over time"
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
          subtitle="An average of 84 can mean everything near 84, or half at 95 and half at 60. Only the shape tells you which."
        >
          <ScoreDistribution />
        </Card>

        <Card
          step={5}
          title="Metric profile"
          subtitle="This week against last. Exact figures below the shape, since a radar cannot be read precisely."
        >
          <MetricProfile />
        </Card>
      </div>

      <Card
        step={6}
        title="Where it is weakest"
        subtitle="Topic against metric. Darker is stronger. This is the chart that tells you which part of the knowledge base needs work."
      >
        <TopicHeatmap />
      </Card>

      <Card
        step={7}
        title="What is failing"
        subtitle="Every rule failure in the last 7 days. Click a bar to filter the table below to those answers."
      >
        <FailureBars onSelect={setFailureFilter} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          step={8}
          title="Latency"
          subtitle="Percentile bands, not an average — the median is comfortable and the tail is what users remember."
        >
          <LatencyBands />
        </Card>

        <Card
          title="Spend"
          subtitle="Kept as its own chart. Two measures on one pair of axes invents a relationship that is not in the data."
        >
          <CostTrend />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          step={9}
          title="Does slower mean better?"
          subtitle="Latency against final score. If the cloud is flat, waiting longer buys nothing."
        >
          <LatencyVsQuality />
        </Card>

        <Card
          title="Do the judge and a human agree?"
          subtitle="The chart that decides whether any of the automated numbers above can be trusted."
        >
          <JudgeVsHuman />
        </Card>
      </div>

      <Card
        step={10}
        title="Version comparison"
        subtitle="The same metrics across every release. v2.3 is visibly the outlier."
      >
        <VersionComparison />
      </Card>

      <Card
        title="Individual evaluations"
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
