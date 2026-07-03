-- Replace the original placeholder short link with a working Google Maps
-- directions URL. Preserve any owner-customised value.
UPDATE site_content
SET value_text = 'https://www.google.com/maps/dir/?api=1&destination=Ton+Mai+Spa+Rawai+Phuket',
    updated_at = now()
WHERE key = 'settings.google_maps_url'
  AND value_text = 'https://maps.app.goo.gl/tonmaispa';
