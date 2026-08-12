/**
 * An explanation of AI evaluation as a subject, in question form.
 *
 * Written as prose rather than bullet points on purpose: someone reading this
 * to understand the field needs the reasoning, not a list of keywords they
 * still have to join together themselves.
 */

export interface QA {
  id: string
  category: string
  question: string
  /** Full answer, one paragraph per entry. */
  answer: string[]
  /** Optional worked example, code or a table, shown in monospace. */
  example?: string
  /** Where to see it in this project. */
  showThem?: string
}

export const CATEGORIES = [
  'Understanding AI evaluation',
  'Rule-based checks',
  'LLM as a judge',
  'Human evaluation',
  'Metrics and scoring',
  'Libraries and tools',
  'What this project does',
] as const

export const QUESTIONS: QA[] = [
  // -------------------------------------------- understanding evaluation
  {
    id: 'what-is-evaluation',
    category: 'Understanding AI evaluation',
    question: 'What is AI evaluation?',
    answer: [
      'AI evaluation is the practice of measuring the quality of what an AI system produces, in a way that can be repeated and compared over time. It exists because the usual way of checking software — run it, compare the output to the expected output, pass or fail — does not work once a language model is involved.',
      'When you test a normal function, the same input always produces the same output, so a test can assert exact equality. A language model does not behave that way. Ask it the same question twice and you get two differently-worded answers, both of which may be perfectly correct. Assert equality and every test fails; assert nothing and every test passes. Neither tells you anything.',
      'The second problem is more serious. When a language model is wrong, nothing breaks. There is no exception, no stack trace, no failed assertion. It produces a confident, fluent, well-structured answer that happens to be untrue — and it looks identical to a correct one. Traditional testing has no mechanism for catching that, because traditional software does not fail that way.',
      'So evaluation replaces "did it match?" with "how good was it?". Instead of a boolean, you produce scores along several dimensions — is it factually right, is it complete, is it supported by the source material, is it safe — and you track those scores across changes. That turns a subjective argument about whether the AI "seems okay" into evidence you can act on.',
    ],
  },
  {
    id: 'why-needed',
    category: 'Understanding AI evaluation',
    question: 'Why does an organisation need it? What actually goes wrong without it?',
    answer: [
      'Without evaluation, the only answer to "is this good enough to release?" is somebody’s opinion, formed by trying a handful of questions. That is not a defensible position for a system that will answer thousands of questions from staff or customers.',
      'The most common failure is silent regression. Model providers update their models continuously, often without a version change you would notice. Someone edits a prompt to fix one problem and quietly breaks three others. A source document is updated and previously correct answers become wrong. In every one of these cases nothing errors, no alert fires, and the first signal is a complaint weeks later.',
      'Then there are the failures specific to language models. They invent facts — a policy, a deadline, a web address — with complete confidence, which is the phenomenon usually called hallucination. They can be manipulated by instructions hidden inside a user’s question, an attack known as prompt injection. They can leak information that was in their context but should not have been repeated.',
      'Evaluation is how you find all of that before your users do, and how you prove that a change actually improved things rather than just feeling better.',
    ],
  },
  {
    id: 'different-ways',
    category: 'Understanding AI evaluation',
    question: 'What are the different ways to evaluate an AI system?',
    answer: [
      'There are three broad approaches, and mature teams use all three because each is blind to something the others catch.',
      'The first is rule-based or programmatic checking. This is ordinary code that inspects the output: does it contain a forbidden term, is it within a length range, does it cite a source, did it arrive within the latency budget. It is instant, free, completely deterministic and perfectly repeatable. Its limitation is absolute — it cannot assess meaning. A fluent, well-formatted, entirely fabricated answer passes every rule you can write.',
      'The second is model-based evaluation, usually called LLM-as-a-judge. A second language model is shown the question, the answer, and any supporting material, and asked to assess it against stated criteria. This does understand meaning, so it catches wrong facts, missing steps and answers that drift off the point. The costs are that it takes seconds rather than milliseconds, it costs money per evaluation, and it is itself a language model, so its judgement varies between runs.',
      'The third is human evaluation. A person reads the answer and scores it. This remains the most reliable signal, and the only one that reliably catches things like tone, or the vague sense that an answer is technically correct but would embarrass you if it were sent. It does not scale — you review a sample, not everything — and it is expensive in the one resource you cannot buy more of quickly.',
      'A fourth approach worth knowing about is comparative or A/B evaluation, where instead of scoring an answer in isolation you ask which of two answers is better. Humans and judges are both more reliable at ranking than at absolute scoring, so this is often used when you are choosing between two prompts or two models rather than deciding whether one is acceptable.',
    ],
    showThem: 'Start here tab → "The three ways to check an answer"',
  },

  // ------------------------------------------------------- rule-based
  {
    id: 'what-are-rules',
    category: 'Rule-based checks',
    question: 'What are rule-based checks, and what can they realistically catch?',
    answer: [
      'A rule-based check is a function that takes the model’s output — plus whatever context you have, such as the retrieved documents and the original question — and returns pass or fail with a reason. There is no model involved, which is exactly the point: the result is deterministic, immediate and free.',
      'They are strongest wherever correctness can be defined structurally rather than semantically. Format and length. The presence of a required citation. The absence of forbidden terms or credential-shaped strings. Whether every number in the answer appears somewhere in the source material. Whether a cited document was actually supplied to the model. Latency and token cost against a budget.',
      'That last category is worth dwelling on, because it is where rules outperform everything else. If an answer says "Sources: KB-007" but KB-007 was never in the context you sent, the model invented that citation. That is a hallucination detected with certainty, in under a millisecond, with no AI and no cost. No judge is needed and no judge could be more reliable.',
      'What rules cannot do is assess whether an answer is true, complete, or useful. That boundary is absolute, and it is the reason rule-based checking alone gives false confidence.',
    ],
  },
  {
    id: 'how-write-rules',
    category: 'Rule-based checks',
    question: 'How do you actually write a rule-based check?',
    answer: [
      'Each check is a small, independent function with a single responsibility. It receives the context, decides pass or fail, and returns a structured result carrying the outcome, a human-readable detail string explaining what it found, and metadata such as which group it belongs to and whether a failure should be treated as a security issue.',
      'Three design principles matter more than the code. First, every check runs on every answer — you never short-circuit on the first failure, because a reviewer needs the complete picture, not the first problem encountered. Second, the detail string must be specific enough to act on: "missing: 90 days, 14" is useful, "required keywords failed" is not. Third, checks must be written so they cannot be talked around by phrasing.',
      'That third point is the one people get wrong. Our first version of the forbidden-terms check searched for phrases like "api key" anywhere in the answer. It immediately flagged a perfectly correct refusal — "I cannot give you the API key" — as a credential leak. A check that fires on exactly the behaviour you want gets muted within a week, and then it protects nothing. The fix was to make the check aware of refusal language, and to add a separate check that matches actual credential shapes such as gsk_ or sk- prefixes and PEM blocks, which no phrasing can evade.',
      'Group the checks into families so results are readable — security, grounding, format, performance is a reasonable split — and give each one a plain-English explanation of why it exists, so a reviewer seeing a failure understands the risk without reading the source.',
    ],
    example: `def check_citations_were_retrieved(context) -> RuleCheck:
    """An article the model never received cannot honestly be cited."""
    cited = extract_kb_ids(context.answer)          # e.g. {"KB-007"}
    if not cited:
        return passed("nothing cited")

    unseen = [ref for ref in cited if ref not in context.retrieved_ids]
    return make_check(
        "citations_were_retrieved",
        ok=not unseen,
        detail=f"cited without retrieving: {', '.join(unseen)}"
               if unseen else "every citation was in the retrieved context",
        group=RuleGroup.GROUNDING,
    )`,
    showThem: 'Demo tab → the ⓘ beside the Rules column lists all 17',
  },
  {
    id: 'rule-metrics',
    category: 'Rule-based checks',
    question: 'What metrics do rule-based checks produce?',
    answer: [
      'The primary metric is simply the pass rate — how many checks passed out of how many ran — which normalises neatly to a score out of 100. Alongside that you want the count of failures per individual check across your whole test set, because that is what tells you where to spend effort. A single overall score says the system is at 94; a breakdown by check says "citations are missing on eleven of twelve answers", which is actionable.',
      'Security failures deserve separate treatment rather than being folded into an average. A leaked credential is not offset by an otherwise excellent answer, so the sensible design is a veto: any failed security check blocks release regardless of the total score. Track the count of security violations as its own headline number.',
      'Performance metrics — latency and token cost — usually belong here too, since they are measured deterministically. Capture the average, the 95th percentile and the maximum, because averages hide the slow tail that users actually notice.',
    ],
  },

  // ------------------------------------------------------- llm as judge
  {
    id: 'what-is-judge',
    category: 'LLM as a judge',
    question: 'What is LLM-as-a-judge and how does it work?',
    answer: [
      'LLM-as-a-judge means using a second language model to assess the output of the first. The judge is given a structured prompt containing the original question, the answer being assessed, any supporting context such as retrieved documents, and — depending on the metric — a reference answer written by a human. It is asked to return a score and an explanation.',
      'The reason this works better than it first sounds is that marking is a substantially easier task than answering. Deciding whether a given statement is supported by a given paragraph is a narrow, well-defined judgement. Producing a correct answer from scratch requires far more. Models are noticeably more reliable at the former.',
      'Two design choices materially affect quality. The judge should be a different model from the one being evaluated, because a model assessing its own output is a weak and biased check. And the judge should run at low temperature, since you want consistency of judgement rather than creative variety.',
      'Most implementations decompose the task rather than asking for a single holistic score. A faithfulness metric, for instance, will first extract each individual factual claim from the answer, then check each claim against the context separately, then aggregate. That produces a more reliable score than asking "is this faithful, from 0 to 1?" in one shot, and it makes the reasoning inspectable.',
    ],
    showThem: 'Judge results → "See the verbatim prompts and replies"',
  },
  {
    id: 'judge-metrics',
    category: 'LLM as a judge',
    question: 'What metrics does an LLM judge measure?',
    answer: [
      'The metrics divide into two families, and the distinction is practical rather than academic: some require a human-written reference answer and some do not.',
      'Reference-based metrics compare the output against a known-good answer. Correctness asks whether the answer is factually consistent with the reference, and is where you catch a contradicted policy value or a wrong duration. Completeness asks whether every substantive point in the reference is covered, catching answers that stop before the user can act. These are the most valuable metrics you have, and they are also the most expensive, because somebody has to write the reference answers.',
      'Reference-free metrics need no such answer. Faithfulness — sometimes called groundedness — checks whether every claim in the answer is supported by the supplied context, and is the standard hallucination measure. Answer relevancy checks whether the response actually addresses the question asked rather than padding or drifting. Because these need no reference, they can run against live production traffic, not just a curated test set.',
      'For retrieval systems there is a third family measuring the search step rather than the answer. Contextual precision asks whether the retrieved documents were relevant and well-ranked; contextual recall asks whether everything needed was actually retrieved. These matter because a bad answer very often has a bad retrieval behind it, and no amount of prompt tuning fixes a missing document.',
      'Beyond those, most libraries offer safety metrics — toxicity, bias, PII leakage — and task-specific ones for summarisation, tool use and multi-turn conversation.',
    ],
  },
  {
    id: 'judge-reliability',
    category: 'LLM as a judge',
    question: 'How reliable is an LLM judge? Is it not circular to have AI check AI?',
    answer: [
      'It is reliable enough to be useful and not reliable enough to be trusted alone, which is why it is one of three methods rather than the only one.',
      'The circularity objection is reasonable but misses that the judge is doing a different, easier job. It is not being asked to produce the answer; it is being asked to compare an answer against stated criteria and supplied evidence. It also has information the original model did not have at generation time — most importantly the reference answer.',
      'The real weakness is variance. Language models are not deterministic, and the same answer assessed twice can receive materially different scores. We measured this directly in this project: an answer that was factually correct scored 1.00 on one run and 0.30 on another. That is not a defect in the setup, it is a property of the technique.',
      'The practical mitigations are to run the judge at low temperature, to average across many test cases rather than reading any single score as authoritative, to prefer comparative judgements when you can, and — most importantly — to keep deterministic rules and human review either side of it. A judge score is an informed opinion. Treating it as a fact is the most common mistake teams make with this technique.',
    ],
  },

  // ------------------------------------------------------ human eval
  {
    id: 'what-is-human-eval',
    category: 'Human evaluation',
    question: 'What is human evaluation and when do you need it?',
    answer: [
      'Human evaluation is a person reading the output and scoring it against a defined rubric. It is the most reliable signal available and the least scalable, so the question is never whether to use it but where to spend it.',
      'You need it in three situations. First, to establish ground truth for calibrating everything else — until a human has scored a body of answers, you have no way of knowing whether your judge or your thresholds are sensible. Second, for the dimensions no automated method assesses well, particularly tone and appropriateness. Third, as the final gate on anything consequential, because the accountability for shipping a system cannot rest on a model’s opinion.',
      'The efficient pattern is stratified sampling rather than random review. Review everything the rules or the judge flagged, plus a random sample of what passed, so you catch the cases where the automated methods agreed with each other and were both wrong. That last category is the most dangerous kind of failure and the only way to find it is to look.',
    ],
  },
  {
    id: 'human-metrics',
    category: 'Human evaluation',
    question: 'What do you ask a human reviewer to score?',
    answer: [
      'Keep the rubric short enough that a reviewer will actually complete it consistently. Four to six criteria on a 1-to-5 scale is the practical range; beyond that, reliability drops as fatigue sets in and reviewers start anchoring on their first impression.',
      'The criteria used in this project are correctness (is it factually right against policy), completeness (does it cover everything needed to act), clarity (could the reader act without re-reading it) and tone (is it appropriate for internal communication). Those four average into a score out of 100.',
      'Alongside those there is one binary question that carries disproportionate weight: "would you be comfortable sending this answer as it stands?" This is deliberately recorded but not averaged into the numeric score. It exists to catch the answer that scores four out of five on every dimension and still feels wrong — an instinct that reviewers reliably have and that no rubric fully captures.',
      'Two things improve reliability considerably. Give each point on the scale a concrete anchor, so "5" and "2" mean the same thing to every reviewer rather than being calibrated to individual temperament. And where it matters, have two reviewers score the same answers and measure their agreement — if your humans do not agree with each other, no automated metric trained to match them will be meaningful either.',
    ],
    showThem: 'Demo tab → the ⓘ beside the Human column',
  },

  // --------------------------------------------------- metrics & scoring
  {
    id: 'combining-metrics',
    category: 'Metrics and scoring',
    question: 'How do you combine several metrics into one decision?',
    answer: [
      'You need a single number for anyone to act on, but producing it carelessly destroys the information the individual metrics carried. Three rules make the difference.',
      'First, normalise everything to a common scale before combining. Rule checks give a pass count, judge metrics give values between 0 and 1, human ratings give 1 to 5. Convert all of them to 0–100 so a weighted sum means something.',
      'Second, decide what a missing measurement means, and never let it mean zero. If the judge has not run yet, or a call failed, scoring it zero produces a catastrophically low overall score that reflects your infrastructure rather than your system’s quality. We hit exactly this: a rate limit caused four judge metrics to record 0.00, dropping a good answer to 42 out of 100 and marking it failed. The correct behaviour is to exclude the missing method and renormalise the remaining weights, then state clearly that the score rests on two methods rather than three.',
      'Third, keep vetoes separate from the arithmetic. Some failures are disqualifying regardless of everything else — a leaked credential, a successful prompt injection. Model those as a hard block rather than a deduction, otherwise a strong answer can accumulate enough points to outweigh a security breach.',
    ],
    example: `final = (rules × 0.30 + judge × 0.40 + human × 0.30)

If human review has not run, drop it and renormalise:
final = (rules × 0.30 + judge × 0.40) ÷ 0.70

Then, regardless of the total:
if any security check failed → BLOCKED`,
    showThem: 'Any comparison row → "How this score was calculated"',
  },
  {
    id: 'thresholds',
    category: 'Metrics and scoring',
    question: 'What is a threshold and how should it be set?',
    answer: [
      'A threshold is the score a metric must reach to count as a pass. Most libraries default to something around 0.7, and most teams keep the default, which is a mistake — the right value depends entirely on the cost of a wrong answer in your domain.',
      'The principled way to set it is calibration. Have humans score a few hundred outputs, then find the point on the automated metric where human judgement flips from acceptable to unacceptable, and set the threshold there. You are tuning the automated measure to agree with your reviewers, which is the only definition of "correct threshold" that means anything.',
      'The trade-off is the familiar one between false positives and false negatives. Set it high and you will spend time investigating answers that were fine; set it low and problems reach users. In a domain where a wrong answer costs an employee twenty wasted minutes, a lower threshold is tolerable. Where a wrong answer has legal or safety consequences, it should be high enough to be annoying.',
      'This project uses 0.70 as a starting value and says so openly. We have not calibrated it, because calibration needs more hand-scored data than a proof of concept has.',
    ],
  },
  {
    id: 'weights',
    category: 'Metrics and scoring',
    question: 'How do you decide the weighting between methods?',
    answer: [
      'There is no industry standard, and anyone who tells you otherwise is selling something. The weighting encodes what your organisation is most afraid of, so it is a business decision informed by engineering rather than a technical one.',
      'A reasonable starting point gives the judge the largest share, because it is the only method that assesses meaning, with rules and human review taking the remainder. This project uses 30% rules, 40% judge, 30% human.',
      'Weight rules higher when compliance and format matter more than eloquence — regulated communications, for instance, where an answer that omits a required disclosure is unacceptable regardless of how well written it is. Weight the judge higher when the risk is subtle factual error. Weight humans higher when the output is customer-facing and reputational damage is the main exposure.',
      'One observation from building this: at 30%, a single rule failure out of seventeen moves the final score by under two points, so ordinary rule failures barely register in the total. If rule compliance genuinely matters to you, either raise the weight or model specific rules as vetoes rather than relying on the average to surface them.',
    ],
  },

  // ------------------------------------------------------ libraries
  {
    id: 'what-libraries',
    category: 'Libraries and tools',
    question: 'What libraries are available, and what is each one for?',
    answer: [
      'The ecosystem divides by job rather than by quality, so the useful question is not "which is best" but "which job am I doing".',
      'For scoring outputs against metrics in your own codebase, DeepEval and RAGAS are the main open-source options. DeepEval is broader, with around fifty metrics covering correctness, safety, agents and conversation. RAGAS is narrower and specifically strong on retrieval quality, which matters if your main risk is that the search step returns the wrong documents.',
      'For comparing prompts and models quickly, promptfoo takes a different approach: you describe test cases in a YAML file and run a command-line tool, with no Python to write. It also has a capable red-teaming mode that generates adversarial inputs for you.',
      'For understanding behaviour in production, you want observability rather than a test suite. Langfuse, LangSmith and Galileo record every real interaction and let you score those. Galileo is notable for evaluating with small purpose-built models rather than a large general one, which is dramatically cheaper at volume. Arize Phoenix offers similar tracing but self-hosted, which matters in regulated environments.',
      'For a one-off audit, Giskard scans an application and generates its own adversarial tests for bias, hallucination and injection, then writes a report.',
      'And distinct from all of these, Guardrails AI and NeMo Guardrails do not evaluate at all — they sit in front of the model in production and block bad output before a user sees it. Evaluation tells you a problem exists; a guardrail prevents it reaching anyone. Production systems need both.',
    ],
    showThem: 'Start here tab → "Tools and libraries"',
  },
  {
    id: 'deepeval-supports',
    category: 'Libraries and tools',
    question: 'What does DeepEval support?',
    answer: [
      'DeepEval ships around fifty metrics in the version used here, structured so that evaluations are written and run as ordinary pytest tests. That means they run locally, in CI, with no account and no data leaving the machine.',
      'The RAG-focused metrics are the core set: answer relevancy, faithfulness, contextual precision, contextual recall, contextual relevancy, and a dedicated hallucination metric. Between them these cover both halves of a retrieval system — whether the search found the right material, and whether the answer stayed faithful to it.',
      'For criteria specific to your domain, GEval lets you define a metric in plain English — you describe what good looks like and it constructs the evaluation steps itself. DAGMetric goes further, letting you express multi-step decision logic as a graph when a single criterion is not enough. This is how correctness and completeness are defined in this project, rather than by writing judge prompts by hand.',
      'Safety and compliance are covered by toxicity, bias, PII leakage, role violation, misuse and non-advice metrics. Agent systems get task completion, tool correctness, tool permission, plan adherence, plan quality, step efficiency and loop detection. Multi-turn conversations get knowledge retention, role adherence, conversation completeness and turn-level versions of the RAG metrics. There are deterministic ones too — exact match, pattern match, JSON correctness — for cases where no model is needed.',
      'Two features matter more than the metric count. Every metric returns a written reason alongside its score, so a failure is explicable rather than just low. And the judge model is pluggable through a documented base class, which is how this project uses Groq instead of the OpenAI default — about a hundred lines of adapter.',
    ],
    example: `RAG          answer relevancy · faithfulness · contextual precision
             contextual recall · contextual relevancy · hallucination

Custom       GEval (plain-English criteria) · DAGMetric (decision graphs)

Safety       toxicity · bias · PII leakage · role violation · misuse

Agents       task completion · tool correctness · tool permission
             plan adherence · step efficiency · loop detection

Conversation knowledge retention · role adherence · turn-level RAG metrics

Deterministic exact match · pattern match · JSON correctness`,
  },
  {
    id: 'choosing-library',
    category: 'Libraries and tools',
    question: 'How would you choose between them?',
    answer: [
      'Start from the question you are trying to answer, because the tools genuinely do different things and most teams end up running two or three.',
      'If the question is "is the answer correct and complete", you want a metric library with custom criteria — DeepEval. If it is "did the search find the right documents", RAGAS is more specialised. If it is "which of these five prompts is best", promptfoo will get you there faster than writing code. If it is "how is this behaving with real users", you need observability, so Langfuse, LangSmith or Galileo. If it is "can someone attack this", Giskard for discovery and promptfoo’s red-teaming for regression testing.',
      'Beyond capability, three practical criteria usually decide it. Whether it runs in your own infrastructure or sends data to a vendor, which is often settled by your compliance position rather than preference. Whether it fits how your team already works — a library that runs as tests will be run; a separate dashboard someone must remember to open will not. And what it costs at your volume, where the difference between a frontier-model judge and a small purpose-built evaluator becomes significant.',
      'A typical mature setup is a metric library in the test suite for pre-release, an observability platform for production traffic, and a guardrail in front of the model at runtime.',
    ],
  },

  // ------------------------------------------------- what this project does
  {
    id: 'what-we-capture',
    category: 'What this project does',
    question: 'What is this project capturing right now?',
    answer: [
      'Three methods run against each answer and combine into a single score out of 100.',
      'Seventeen rule-based checks run first, grouped into four families. Five security checks cover forbidden terms, credential-shaped strings, personal data patterns, resistance to prompt injection, and whether the assistant defers when it has no supporting document. Five grounding checks cover whether a citation is present, whether cited documents exist, whether they were actually retrieved, whether every figure in the answer appears in the source, and whether any web address was invented. Five format checks cover delivery, length, required terms, hedging language and degenerate repetition. Two performance checks cover latency against an eight-second budget and completion tokens against a cap.',
      'Four judge metrics run next, using DeepEval with a Groq model as the judge. Correctness and completeness are GEval metrics defined against a human-written reference answer. Faithfulness and answer relevancy are DeepEval’s built-in reference-free metrics. Every one returns a score, a threshold comparison and a written reason, and the verbatim prompt and reply are captured so they can be inspected.',
      'Human review captures four ratings out of five — correctness, completeness, clarity, tone — plus the binary "would you send this" question and a free-text comment.',
      'Those combine as rules 30%, judge 40%, human 30%, with any method that has not run excluded and the remainder renormalised, and any security failure blocking release outright.',
    ],
    showThem: 'Report tab → the coverage strip shows which methods have run',
  },
  {
    id: 'what-we-dont-capture',
    category: 'What this project does',
    question: 'What is it not capturing that a production system would?',
    answer: [
      'Retrieval quality is the most significant gap. We measure whether the answer was faithful to the documents it received, but not whether those were the right documents in the first place. Contextual precision and recall would close that, and both are available in the libraries we already use. Since a poor answer very often has a poor retrieval behind it, this would be the first thing to add.',
      'There is no history. Each run overwrites the last, so you cannot see whether quality is trending up or down across weeks. Any production setup needs run history, because the whole point of evaluation is catching regressions, and a regression is by definition a comparison against the past.',
      'Nothing observes live traffic. This evaluates a fixed set of twelve curated questions, which by construction cannot surface the questions nobody thought to write. That requires an observability platform recording real interactions.',
      'The test set is far too small at twelve cases — a realistic suite is one to five hundred — and inter-rater agreement is not measured, so we cannot yet say whether two reviewers would score the same answer alike.',
      'And one limitation no amount of tooling fixes: this measures whether answers are faithful to our source documents, not whether those documents are correct. If a policy article is out of date, all three methods will confidently mark a wrong answer as correct. Document accuracy is a separate governance problem.',
    ],
  },
]
