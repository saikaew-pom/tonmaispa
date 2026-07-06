-- Official customer contact channels used by the chatbot and website.
-- The WhatsApp number is stored without "+" because links add it where needed.
INSERT INTO site_content (key, value_text, page, section)
VALUES
  ('settings.whatsapp_number', '66822866058', 'settings', 'contact'),
  ('settings.line_id', '@tonmaispa', 'settings', 'contact')
ON CONFLICT (key) DO UPDATE SET
  value_text = EXCLUDED.value_text,
  page = EXCLUDED.page,
  section = EXCLUDED.section;
