// Sanitizes CMS-authored rich-text HTML (blog post bodies) before it's
// rendered via dangerouslySetInnerHTML. Pure JS — jsdom-based DOMPurify
// crashes on Vercel serverless, so we use sanitize-html instead.
import sanitizeHtml from 'sanitize-html'

export function sanitizeBlogBody(html) {
  return sanitizeHtml(html || '', {
    allowedTags: ['p', 'h2', 'h3', 'h4', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'br', 'img'],
    allowedAttributes: {
      a:   ['href', 'target', 'rel'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https'],
  })
}
