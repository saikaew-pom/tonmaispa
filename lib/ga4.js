// Server-only GA4 Data API reader — powers the dashboard Analytics page.
// Uses a service account (Viewer role on the GA4 property), never the
// public Measurement ID used for the tracking script in components/layout/
// GoogleAnalytics.jsx. Read-only: this never writes to GA4.
import { BetaAnalyticsDataClient } from '@google-analytics/data'

// Conversion-relevant custom events already fired across the public site
// (see components/ui/BookingCTA.jsx, TrackedLink.jsx, ChatWidget.jsx, etc.)
// — surfaced here as a simple "what did visitors do" tally.
const TRACKED_EVENTS = [
  'book_now_click', 'booking_complete', 'whatsapp_click', 'line_click',
  'enquiry_submit', 'chat_open', 'map_click', 'instagram_click', 'review_click',
]

let client = null
function getClient() {
  if (client) return client
  const email = process.env.GA4_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!email || !key) return null
  client = new BetaAnalyticsDataClient({ credentials: { client_email: email, private_key: key } })
  return client
}

// Presets map to a start date; 'all' is capped to GA4's practical retention
// window rather than implying more history exists than is actually stored.
export function resolvePeriod(period, { customStart, customEnd } = {}) {
  const today = new Date()
  const fmt = (d) => d.toISOString().slice(0, 10)
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d) }

  if (period === 'custom' && customStart && customEnd) return { startDate: customStart, endDate: customEnd }
  if (period === '7d')  return { startDate: daysAgo(7),   endDate: 'today' }
  if (period === '90d') return { startDate: daysAgo(90),  endDate: 'today' }
  if (period === 'all') return { startDate: daysAgo(365), endDate: 'today' } // GA4 standard retention is 14 months; capped conservatively
  return { startDate: daysAgo(30), endDate: 'today' } // default: 30d
}

function previousPeriod(startDate, endDate) {
  const propertyId = process.env.GA4_PROPERTY_ID
  const end = endDate === 'today' ? new Date() : new Date(endDate)
  const start = new Date(startDate)
  const spanMs = end - start
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
  const prevStart = new Date(prevEnd.getTime() - spanMs)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd), propertyId }
}

// Returns null if GA4 isn't configured yet (missing credentials) so the
// dashboard can show a clear setup message instead of crashing.
export async function getAnalyticsSummary({ startDate, endDate }) {
  const analyticsClient = getClient()
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!analyticsClient || !propertyId) return null

  const property = `properties/${propertyId}`
  const prev = previousPeriod(startDate, endDate)

  const [
    [totalsCurrent], [totalsPrevious], [trend], [channels], [pages], [events], [devices], [countries],
  ] = await Promise.all([
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'newUsers' }, { name: 'engagementRate' }],
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate: prev.startDate, endDate: prev.endDate }],
      metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 8,
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 10,
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: TRACKED_EVENTS } } },
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'deviceCategory' }], metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    }),
    analyticsClient.runReport({
      property, dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 8,
    }),
  ])

  const num = (row, i = 0) => Number(row?.metricValues?.[i]?.value ?? 0)
  const cur = totalsCurrent.rows?.[0]
  const prv = totalsPrevious.rows?.[0]

  const pctChange = (curVal, prevVal) => {
    if (!prevVal) return null
    return Math.round(((curVal - prevVal) / prevVal) * 100)
  }

  const curUsers = num(cur, 0), curSessions = num(cur, 1)
  const prevUsers = num(prv, 0), prevSessions = num(prv, 1)

  const eventCounts = Object.fromEntries(TRACKED_EVENTS.map(e => [e, 0]))
  for (const row of events.rows ?? []) {
    eventCounts[row.dimensionValues[0].value] = num(row)
  }
  const bookNowClicks = eventCounts['book_now_click']
  const bookingsCompleted = eventCounts['booking_complete']

  return {
    period: { startDate, endDate: endDate === 'today' ? new Date().toISOString().slice(0, 10) : endDate },
    totals: {
      activeUsers: curUsers, sessions: curSessions, newUsers: num(cur, 2), engagementRate: num(cur, 3),
      activeUsersChangePct: pctChange(curUsers, prevUsers),
      sessionsChangePct: pctChange(curSessions, prevSessions),
    },
    trend: (trend.rows ?? []).map(r => ({ date: r.dimensionValues[0].value, users: num(r) })),
    channels: (channels.rows ?? []).map(r => ({ channel: r.dimensionValues[0].value, sessions: num(r) })),
    pages: (pages.rows ?? []).map(r => ({ path: r.dimensionValues[0].value, views: num(r) })),
    actions: TRACKED_EVENTS.map(name => ({ name, count: eventCounts[name] })),
    conversionRatePct: curSessions ? Math.round((bookingsCompleted / curSessions) * 1000) / 10 : 0,
    bookNowClicks, bookingsCompleted,
    devices: (devices.rows ?? []).map(r => ({ device: r.dimensionValues[0].value, sessions: num(r) })),
    countries: (countries.rows ?? []).map(r => ({ country: r.dimensionValues[0].value, users: num(r) })),
  }
}
