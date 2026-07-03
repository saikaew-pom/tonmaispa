// Pure data config for the guided campaign brief builder — no logic here.
// Adding/editing a preset is a one-line change; UI and hint computation both
// read from this file so they can never drift out of sync.

export const OBJECTIVE_PRESETS = [
  {
    id: 'fill_weekdays',
    emoji: '🪑',
    label: 'Fill quiet weekdays',
    sentence: 'Increase weekday (Mon–Thu) bookings, which are currently much quieter than weekends',
    hintKey: 'weekdayVsWeekendGap',
  },
  {
    id: 'boost_low_season',
    emoji: '🌧️',
    label: 'Boost low season',
    sentence: 'Drive bookings during the low season when tourist footfall drops',
    hintKey: 'lowVsPeakMonth',
  },
  {
    id: 'promote_package',
    emoji: '💑',
    label: 'Promote a package',
    sentence: 'Sell more of the {package} package',
    hintKey: 'packageBookings60d',
    picker: 'package',
  },
  {
    id: 'bring_guests_back',
    emoji: '🔁',
    label: 'Bring guests back',
    sentence: 'Turn first-time guests into repeat visitors with a rebooking incentive',
    hintKey: null,
  },
  {
    id: 'spa_restaurant_combo',
    emoji: '🍽️',
    label: 'Spa + restaurant combo',
    sentence: 'Cross-sell the garden restaurant to spa guests (and vice versa) to raise spend per visit',
    hintKey: null,
  },
  {
    id: 'new_treatment',
    emoji: '🆕',
    label: 'Launch a new treatment',
    sentence: 'Introduce and build awareness for a new treatment: {treatment}',
    hintKey: null,
    picker: 'freeText',
  },
  {
    id: 'holiday_push',
    emoji: '🎉',
    label: 'Holiday / event push',
    sentence: 'Run a seasonal promotion around {holiday}',
    hintKey: null,
    picker: 'holiday',
  },
  {
    id: 'write_own',
    emoji: '✍️',
    label: 'Write my own',
    sentence: '',
    hintKey: null,
    picker: 'freeText',
  },
]

export const PACKAGE_OPTIONS = [
  "Couple's Bliss Package",
  'Rawai Renewal Package',
  'Half-Day Wellness Retreat',
]

export const HOLIDAY_OPTIONS = [
  { id: 'songkran', label: 'Songkran (Apr 11–15)', startMonth: 4, startDay: 11, endMonth: 4, endDay: 15 },
  { id: 'new_year', label: "New Year's", startMonth: 12, startDay: 28, endMonth: 1, endDay: 3 },
  { id: 'valentines', label: "Valentine's Day", startMonth: 2, startDay: 10, endMonth: 2, endDay: 14 },
  { id: 'loy_krathong', label: 'Loy Krathong', startMonth: 11, startDay: 10, endMonth: 11, endDay: 15 },
  { id: 'custom', label: 'Custom date', startMonth: null, startDay: null, endMonth: null, endDay: null },
]

export const AUDIENCE_CHIPS = [
  'International tourists',
  'Russian-speaking guests',
  'Chinese-speaking guests',
  'Couples',
  'Hotel guests nearby (Rawai/Nai Harn)',
  'Expats & locals',
  'Families',
  'Wellness travelers',
  'Solo travelers',
]

export const BUDGET_TIERS = [
  { id: 'organic', label: 'Organic only', amount: 0, note: 'Social posts, chatbot, in-spa signage — no paid spend' },
  { id: 'small', label: 'Small', amount: 3000, note: 'A short boosted-post run or a small LINE campaign' },
  { id: 'medium', label: 'Medium', amount: 10000, note: 'A proper multi-channel push over 2–4 weeks' },
  { id: 'large', label: 'Larger', amount: 20000, note: 'Multi-channel + influencer or partner-hotel outreach' },
  { id: 'custom', label: 'Custom amount', amount: null, note: 'Enter your own budget' },
]

export const PERIOD_PRESETS = [
  { id: 'next_2_weeks', label: 'Next 2 weeks', days: 14 },
  { id: 'next_month', label: 'Next month', days: 30 },
  { id: 'low_season', label: 'Low season (May–Oct)', explicit: { startMonth: 5, endMonth: 10 } },
  { id: 'high_season_kickoff', label: 'High season kickoff (Nov–Dec)', explicit: { startMonth: 11, endMonth: 12 } },
  { id: 'holiday', label: 'Around a holiday', usesHolidayPicker: true },
  { id: 'custom', label: 'Custom dates', custom: true },
]

export const CHANNEL_OPTIONS = [
  'Facebook',
  'Instagram',
  'TikTok',
  'LINE',
  'Google Business Profile',
  'Website chatbot',
  'In-spa signage',
  'Partner hotels',
]
