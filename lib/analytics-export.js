// Renders a GA4 analytics summary (see lib/ga4.js) into a downloadable PDF —
// built fresh from the live summary for the requested period, mirroring the
// on-demand pattern in lib/insights-export.js.
import React from 'react'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const BRAND_GREEN = '#3B5249'
const BRAND_GOLD = '#C4924A'

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 20, marginBottom: 4, color: BRAND_GREEN },
  subtitle: { fontSize: 11, marginBottom: 16, color: '#6B6663' },
  sectionTitle: { fontSize: 13, marginTop: 16, marginBottom: 6, color: BRAND_GREEN, fontWeight: 700 },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  kpiBox: { flex: 1, border: '1pt solid #E0D9D0', borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: '#9B9390', textTransform: 'uppercase' },
  kpiValue: { fontSize: 16, color: BRAND_GREEN, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottom: '0.5pt solid #E0D9D0' },
  rowLabel: { fontSize: 10, color: '#1C1917' },
  rowValue: { fontSize: 10, color: '#4A4745', fontWeight: 700 },
})

const fmtPct = (n) => n === null ? '' : `${n > 0 ? '+' : ''}${n}%`
const CHANNEL_LABELS = {
  'Organic Search': 'Google Search', Direct: 'Typed the URL directly', Referral: 'Linked from another site',
  'Organic Social': 'Instagram/Facebook', 'Paid Search': 'Google Ads', Email: 'Email', 'Unassigned': 'Other',
}
const ACTION_LABELS = {
  book_now_click: 'Clicked "Book Now"', booking_complete: 'Completed a booking', whatsapp_click: 'Clicked WhatsApp',
  line_click: 'Clicked Line', enquiry_submit: 'Submitted an enquiry', chat_open: 'Opened the chatbot',
  map_click: 'Clicked directions/map', instagram_click: 'Clicked Instagram', review_click: 'Clicked reviews',
}

function KpiRow({ summary }) {
  const t = summary.totals
  return React.createElement(View, { style: styles.kpiRow },
    React.createElement(View, { style: styles.kpiBox },
      React.createElement(Text, { style: styles.kpiLabel }, 'Visitors'),
      React.createElement(Text, { style: styles.kpiValue }, `${t.activeUsers} ${fmtPct(t.activeUsersChangePct)}`)),
    React.createElement(View, { style: styles.kpiBox },
      React.createElement(Text, { style: styles.kpiLabel }, 'Sessions'),
      React.createElement(Text, { style: styles.kpiValue }, `${t.sessions} ${fmtPct(t.sessionsChangePct)}`)),
    React.createElement(View, { style: styles.kpiBox },
      React.createElement(Text, { style: styles.kpiLabel }, 'New Visitors'),
      React.createElement(Text, { style: styles.kpiValue }, `${t.newUsers}`)),
    React.createElement(View, { style: styles.kpiBox },
      React.createElement(Text, { style: styles.kpiLabel }, 'Booking Conversion'),
      React.createElement(Text, { style: styles.kpiValue }, `${summary.conversionRatePct}%`)),
  )
}

function ListSection({ title, rows, labelKey, valueKey, labelMap }) {
  return React.createElement(View, null,
    React.createElement(Text, { style: styles.sectionTitle }, title),
    ...rows.map((r, i) => React.createElement(View, { key: i, style: styles.row },
      React.createElement(Text, { style: styles.rowLabel }, labelMap?.[r[labelKey]] ?? r[labelKey]),
      React.createElement(Text, { style: styles.rowValue }, String(r[valueKey])),
    ))
  )
}

function AnalyticsPdfDocument({ summary }) {
  return React.createElement(Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, 'Website Analytics Report'),
      React.createElement(Text, { style: styles.subtitle }, `${summary.period.startDate} — ${summary.period.endDate}`),
      React.createElement(KpiRow, { summary }),
      React.createElement(ListSection, {
        title: 'Where visitors came from', rows: summary.channels, labelKey: 'channel', valueKey: 'sessions', labelMap: CHANNEL_LABELS,
      }),
      React.createElement(ListSection, {
        title: 'Most-viewed pages', rows: summary.pages, labelKey: 'path', valueKey: 'views',
      }),
      React.createElement(ListSection, {
        title: 'What visitors did', rows: summary.actions.filter(a => a.count > 0), labelKey: 'name', valueKey: 'count', labelMap: ACTION_LABELS,
      }),
      React.createElement(ListSection, {
        title: 'Device', rows: summary.devices, labelKey: 'device', valueKey: 'sessions',
      }),
      React.createElement(ListSection, {
        title: 'Top visitor locations', rows: summary.countries, labelKey: 'country', valueKey: 'users',
      }),
    )
  )
}

export async function renderAnalyticsPdf(summary) {
  return renderToBuffer(React.createElement(AnalyticsPdfDocument, { summary }))
}
