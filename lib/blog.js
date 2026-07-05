// Fixed blog category list — matches the 5 content pillars in
// BLOG_CONTENT_PLAN.md, so every post's category maps naturally to a
// content cluster. Plain array, not a table — trivial to edit later.
export const BLOG_CATEGORIES = [
  'Thai Massage & Spa Treatments',
  'The Thermal Wellness Circuit',
  'Rawai & Nai Harn: The Local Guide',
  'Garden Restaurant, Thai Food & Nutrition',
  'Planning Your Visit',
]

// Word-count-based estimate, matching a common ~200 words/minute reading
// pace — used as the default read_time_minutes when a post is created,
// staff can always override it manually.
export function estimateReadTime(html) {
  const text = (html || '').replace(/<[^>]+>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export function slugify(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}
