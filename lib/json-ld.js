// XSS-safe JSON-LD serialiser
// Raw JSON.stringify leaves </script> in strings, which breaks the script block.
// Escape the three characters that can close or inject into HTML.

export function jsonLdScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g,  '\\u003c')
    .replace(/>/g,  '\\u003e')
    .replace(/&/g,  '\\u0026')
}

// Usage in page.jsx:
// <script
//   type="application/ld+json"
//   dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }}
// />

export function spaSchema({ name, url, phone, rating, ratingCount, hours, address }) {
  return {
    '@context': 'https://schema.org',
    '@type':    'DaySpa',
    name,
    url,
    telephone:  phone,
    address: {
      '@type':           'PostalAddress',
      streetAddress:     address.street,
      addressLocality:   address.city,
      addressRegion:     address.region,
      postalCode:        address.postalCode,
      addressCountry:    'TH',
    },
    geo: {
      '@type':    'GeoCoordinates',
      latitude:   7.7826,
      longitude:  98.3164,
    },
    aggregateRating: {
      '@type':       'AggregateRating',
      ratingValue:   rating,
      reviewCount:   ratingCount,
      bestRating:    '5',
      worstRating:   '1',
    },
    openingHoursSpecification: hours.map(h => ({
      '@type':     'OpeningHoursSpecification',
      dayOfWeek:   h.days,
      opens:       h.opens,
      closes:      h.closes,
    })),
    priceRange: '$$',
    currenciesAccepted: 'THB',
    paymentAccepted: 'Cash, Credit Card',
    amenityFeature: [
      { '@type': 'LocationFeatureSpecification', name: 'Steam Room',  value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Sauna',       value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Cold Plunge',  value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Garden',       value: true },
      { '@type': 'LocationFeatureSpecification', name: 'Parking',      value: true },
    ],
  }
}
