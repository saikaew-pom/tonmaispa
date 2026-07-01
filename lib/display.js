// Display helpers — enum labels, price formatting, Cloudinary transforms
// Import from here; never hardcode labels in JSX.

// ── Price ──────────────────────────────────────────────────────
export function formatPrice(price, currency = 'THB') {
  return new Intl.NumberFormat('th-TH', {
    style:                 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}

// ── Cloudinary on-the-fly transforms ──────────────────────────
// Replaces /upload/ with /upload/<transform>/ in a Cloudinary secure_url.
// Always q_auto,f_auto for quality + WebP negotiation.
export const cloudinary = {
  // Homepage hero, gallery full
  hero:     url => url.replace('/upload/', '/upload/w_1920,h_900,c_fill,q_auto,f_auto/'),
  // Spa treatment card
  card:     url => url.replace('/upload/', '/upload/w_600,h_400,c_fill,q_auto,f_auto/'),
  // Homepage gallery grid
  gallery:  url => url.replace('/upload/', '/upload/w_800,h_600,c_fill,q_auto,f_auto/'),
  // Gallery lightbox — full quality, no crop
  lightbox: url => url.replace('/upload/', '/upload/q_auto,f_auto/'),
  // Thumbnail (gallery manager, drag reorder)
  thumb:    url => url.replace('/upload/', '/upload/w_160,h_120,c_fill,q_auto/'),
  // OG image for social sharing
  og:       url => url.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto,f_auto/'),
  // Avatar / therapist portrait
  avatar:   url => url.replace('/upload/', '/upload/w_200,h_200,c_fill,g_face,q_auto,f_auto/'),
}

// ── Treatment categories (for display labels) ─────────────────
export const TREATMENT_CATEGORIES = {
  massage:         'Massage',
  body_treatment:  'Body Treatment',
  facial:          'Facial',
  thermotherapy:   'Thermotherapy',
  package:         'Package',
  add_on:          'Add-On',
}

// ── Booking status ─────────────────────────────────────────────
export const BOOKING_STATUS_LABELS = {
  pending:    'Pending',
  confirmed:  'Confirmed',
  cancelled:  'Cancelled',
  completed:  'Completed',
}

export const BOOKING_STATUS_COLORS = {
  pending:   '#C4924A',
  confirmed: '#3B5249',
  cancelled: '#B8B5B3',
  completed: '#1C1917',
}

// ── Booking source ─────────────────────────────────────────────
export const BOOKING_SOURCE_LABELS = {
  online:   'Online',
  walk_in:  'Walk-in',
  phone:    'Phone',
  chatbot:  'Chatbot',
}

// ── Date/time formatters ───────────────────────────────────────
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  })
}

export function formatTime(timeStr) {
  // timeStr: "14:00" or "14:00:00"
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Enquiry / chat status ──────────────────────────────────────
export const ENQUIRY_STATUS_LABELS = {
  new:        'New',
  contacted:  'Contacted',
  booked:     'Booked',
  closed:     'Closed',
}
