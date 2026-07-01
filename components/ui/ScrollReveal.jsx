'use client'
// Injects IntersectionObserver to animate [data-reveal] elements on scroll
import { useEffect } from 'react'

export default function ScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]')
    if (!els.length) return

    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity  = '1'
          e.target.style.transform = 'translateY(0)'
          observer.unobserve(e.target)
        }
      }),
      { threshold: 0.12 }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return null
}
