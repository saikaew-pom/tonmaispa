// AI Campaign Planner — builds a PII-free business-data context (reusing the
// same aggregations as the Revenue & Marketing Advisor), then runs the
// 3-stage self-critique pipeline (see lib/ai-critique.js) to produce a
// campaign plan grounded in real figures rather than generic spa advice.
import { getRevenueSummary, getTherapistUtilizationSummary, getForwardBookingSummary, getMarketingFunnelSummary } from './insights'
import { generateWithSelfCritique } from './ai-critique'
import { PACKAGE_OPTIONS } from './campaign-presets'

function toYMD(d) {
  return d.toISOString().slice(0, 10)
}

function isWeekend(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  return dow === 0 || dow === 5 || dow === 6
}

// ── Context — real business data + preset-card hints, no guest PII ─────────
export async function buildCampaignContext(admin) {
  const today = new Date()
  const start60 = new Date(today); start60.setDate(start60.getDate() - 60)
  const start180 = new Date(today); start180.setDate(start180.getDate() - 180)
  const startDate60 = toYMD(start60)
  const startDate180 = toYMD(start180)
  const endDate = toYMD(today)

  const [revenue60, therapistUtilization, forwardBookings, marketingFunnel, revenue180] = await Promise.all([
    getRevenueSummary(admin, { startDate: startDate60, endDate }),
    getTherapistUtilizationSummary(admin, { startDate: startDate60, endDate }),
    getForwardBookingSummary(admin),
    getMarketingFunnelSummary(admin, { startDate: startDate60, endDate }),
    getRevenueSummary(admin, { startDate: startDate180, endDate }),
  ])

  // Weekday vs weekend average daily revenue (last 60 days)
  const weekdayRevs = [], weekendRevs = []
  for (const [date, rev] of Object.entries(revenue60.dailyTrend)) {
    ;(isWeekend(date) ? weekendRevs : weekdayRevs).push(rev)
  }
  const avg = (arr) => arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0
  const weekdayVsWeekendGap = { weekdayAvgRevenue: avg(weekdayRevs), weekendAvgRevenue: avg(weekendRevs) }

  // Monthly revenue over the last 6 months — current vs peak
  const byMonth = {}
  for (const [date, rev] of Object.entries(revenue180.dailyTrend)) {
    const m = date.slice(0, 7)
    byMonth[m] = (byMonth[m] ?? 0) + rev
  }
  const months = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
  const currentMonth = months[months.length - 1] ?? [toYMD(today).slice(0, 7), 0]
  const peakMonth = months.reduce((best, m) => (m[1] > (best?.[1] ?? -1) ? m : best), null) ?? currentMonth
  const lowVsPeakMonth = { currentMonth: currentMonth[0], currentMonthRevenue: currentMonth[1], peakMonth: peakMonth[0], peakMonthRevenue: peakMonth[1] }

  // Per-package booking counts, last 60 days
  const packageBookings60d = {}
  for (const name of PACKAGE_OPTIONS) {
    packageBookings60d[name] = revenue60.byTreatment[name]?.count ?? 0
  }

  return {
    revenue: revenue60,
    therapistUtilization,
    forwardBookings,
    marketingFunnel,
    hints: { weekdayVsWeekendGap, lowVsPeakMonth, packageBookings60d },
  }
}

const PLAN_SCHEMA = `{
  "interpretedBrief": {"objective": string, "audience": string, "budgetTHB": number, "period": string, "channels": [string]},
  "bigIdea": {"title": string, "rationale": string (max 30 words)},
  "campaignIdeas": [{"name": string, "theme": string (max 20 words), "tagline": string, "whyItFits": string (max 20 words)}] (exactly 2 items, NOT counting the main bigIdea),
  "channelPlan": [{"channel": string, "role": string (max 15 words), "budgetTHB": number, "rationale": string (max 20 words)}] (2-4 items, budgetTHB values must sum to ~the stated budget),
  "timeline": [{"phase": string, "startOffset": number, "durationDays": number, "activities": [string] (max 3 short activities)}] (2-3 phases),
  "messagingPillars": [{"pillar": string, "description": string (max 20 words), "proofPoint": string (max 15 words)}] (exactly 3 items),
  "taglines": [string] (5 short taglines),
  "audiencePersonas": [{"name": string, "profile": string (max 20 words), "motivation": string (max 15 words), "bestChannel": string}] (exactly 2 items),
  "contentCalendar": [{"week": number, "channel": string, "contentType": string, "description": string (max 15 words)}] (one entry per week of the campaign, max 4),
  "journeyMap": [{"stage": string, "touchpoint": string, "content": string (max 15 words), "leakageRisk": string (max 15 words)}] (4 stages: Awareness, Consideration, Booking, Post-visit),
  "kpis": [{"metric": string, "target": string, "howToMeasure": string (max 15 words)}] (3-4 items),
  "preMortem": [{"risk": string (max 15 words), "likelihood": string, "mitigation": string (max 15 words)}] (3 items),
  "groundingNotes": [{"claim": string (max 15 words), "source": "actual data" | "estimated" | "industry standard"}] (3-5 items, distill stage only)
}`

function draftSystemPrompt() {
  return `You are a senior campaign strategist for Ton Mai Spa, a traditional Thai spa and garden restaurant in Rawai, Phuket. You will receive a JSON object with two parts: "context" (real, PII-free business data — revenue, therapist occupancy, forward bookings, marketing funnel, and pre-computed hints) and "brief" (either structured campaign inputs, or {"freeText": "..."} if the owner described the campaign in their own words, possibly in Thai).

If the brief is freeText, first interpret it into structured fields (objective, audience, budget in THB, period, channels) using your judgment and the context data, and record that interpretation in "interpretedBrief". If the brief is already structured, echo it into "interpretedBrief" as-is.

Then produce a complete campaign plan. Every specific figure you cite (baht amounts, percentages, counts) MUST come from the provided context data or be arithmetically derivable from it — do not invent numbers. Budget line items in "channelPlan" must sum to approximately the stated budget. Timeline "startOffset"/"durationDays" must fit within the stated campaign period. Every section must be grounded in this specific business's actual data, not generic spa marketing advice. Be concise — respect every word limit given in the schema exactly, this is a hard constraint, not a suggestion.

Return ONLY valid JSON matching this exact schema, no other text, no markdown fences:
${PLAN_SCHEMA}`
}

// brief: { objective, audience, budgetTHB, periodStart, periodEnd, channels, constraints } | { freeText }
export async function generateCampaignPlan({ brief, context }) {
  const result = await generateWithSelfCritique({
    context,
    brief,
    draftSystemPrompt: draftSystemPrompt(),
    critiquePersona: 'You are a skeptical senior marketing auditor reviewing a junior strategist\'s campaign plan before it goes to a client.',
    distillInstructions: 'You are the same senior campaign strategist for Ton Mai Spa, revising your own draft after an internal audit.',
  })
  if (!result) return null
  return {
    draftPlan: result.draft,
    critique: result.critique,
    finalPlan: result.final,
  }
}
