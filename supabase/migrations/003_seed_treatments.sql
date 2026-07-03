-- ============================================================
-- TON MAI SPA — Spa Treatments Seed Data
-- ============================================================

INSERT INTO spa_treatments
  (name, slug, description, category, duration_options, prices, badge, sort_order, is_active)
VALUES

-- ── SIGNATURE MASSAGE ───────────────────────────────────────
('Ton Mai Signature Massage',
 'ton-mai-signature-massage',
 'Our signature blend of Thai and Swedish techniques. Deep pressure on key meridian points, long flowing strokes. The treatment Ton Mai is known for.',
 'massage',
 ARRAY[60, 90, 120],
 '{"60": 900, "90": 1200, "120": 1500}'::jsonb,
 'Most Popular', 10, true),

('Thai Traditional Massage',
 'thai-traditional-massage',
 'Ancient healing art using palms, thumbs, elbows and feet. Passive stretching and acupressure along energy lines. Performed fully clothed.',
 'massage',
 ARRAY[60, 90, 120],
 '{"60": 800, "90": 1050, "120": 1300}'::jsonb,
 NULL, 20, true),

('Thai Oil Massage',
 'thai-oil-massage',
 'Traditional Thai techniques with warm aromatic oil. Balances energy flow, deeply relaxes muscles. Choose from jasmine, lemongrass or coconut blend.',
 'massage',
 ARRAY[60, 90, 120],
 '{"60": 850, "90": 1100, "120": 1350}'::jsonb,
 NULL, 30, true),

('Swedish Relaxation Massage',
 'swedish-relaxation-massage',
 'Long smooth strokes and gentle kneading. Promotes full-body relaxation, improves circulation. Ideal for first-time spa guests.',
 'massage',
 ARRAY[60, 90],
 '{"60": 850, "90": 1100}'::jsonb,
 NULL, 40, true),

('Deep Tissue Massage',
 'deep-tissue-massage',
 'Focused firm pressure on chronic muscle tension, knots and postural issues. Reaches deeper layers of muscle and connective tissue.',
 'massage',
 ARRAY[60, 90],
 '{"60": 950, "90": 1250}'::jsonb,
 'Therapeutic', 50, true),

('Hot Stone Massage',
 'hot-stone-massage',
 'Smooth volcanic basalt stones heated and placed on key points, used as tools to melt deep tension. Deeply grounding and warming.',
 'massage',
 ARRAY[90, 120],
 '{"90": 1400, "120": 1750}'::jsonb,
 NULL, 60, true),

('Aromatherapy Massage',
 'aromatherapy-massage',
 'Swedish techniques with therapeutic essential oil blend — lavender, bergamot, eucalyptus or custom blend on request. Calms nervous system.',
 'massage',
 ARRAY[60, 90],
 '{"60": 900, "90": 1200}'::jsonb,
 NULL, 70, true),

('Foot Reflexology',
 'foot-reflexology',
 'Ancient art of stimulating reflex points on the feet corresponding to organs and systems throughout the body. No oil — firm thumb pressure.',
 'massage',
 ARRAY[45, 60],
 '{"45": 550, "60": 700}'::jsonb,
 NULL, 80, true),

('Head & Shoulder Massage',
 'head-shoulder-massage',
 'Targeted relief for neck, shoulder and scalp tension. Uses dry massage techniques from Indian Ayurveda and Thai traditions.',
 'massage',
 ARRAY[30, 45],
 '{"30": 400, "45": 550}'::jsonb,
 NULL, 90, true),

-- ── BODY TREATMENTS ───────────────────────────────────────────
('Lemongrass Body Scrub',
 'lemongrass-body-scrub',
 'Fresh lemongrass and sea salt exfoliation removes dead skin and stimulates circulation. Leaves skin glowing and fragrant. Best before a massage.',
 'body_treatment',
 ARRAY[45],
 '{"45": 750}'::jsonb,
 NULL, 100, true),

('Coconut & Coffee Scrub',
 'coconut-coffee-scrub',
 'Ground Arabica coffee and coconut oil exfoliates and deeply moisturises. Reduces appearance of cellulite. Rich tropical scent.',
 'body_treatment',
 ARRAY[45],
 '{"45": 750}'::jsonb,
 NULL, 110, true),

('Herbal Compress Massage',
 'herbal-compress-massage',
 'Warm linen balls filled with Thai medicinal herbs — turmeric, lemongrass, kaffir lime — pressed and rolled across muscles. Deeply soothing.',
 'body_treatment',
 ARRAY[60, 90],
 '{"60": 1000, "90": 1300}'::jsonb,
 'Thai Tradition', 120, true),

('CBD Recovery Massage',
 'cbd-recovery-massage',
 'Broad-spectrum CBD oil blended with arnica and peppermint. Targets inflammation and muscle soreness. Popular with surfers and athletes.',
 'body_treatment',
 ARRAY[60, 90],
 '{"60": 1200, "90": 1550}'::jsonb,
 'CBD', 130, true),

-- ── FACIAL ────────────────────────────────────────────────────
('Signature Facial',
 'signature-facial',
 'Double cleanse, enzyme exfoliation, steam extraction, vitamin C serum, SPF finish. Tailored to your skin type. Results visible immediately.',
 'facial',
 ARRAY[60, 90],
 '{"60": 1100, "90": 1450}'::jsonb,
 NULL, 140, true),

('Brightening Facial',
 'brightening-facial',
 'Targets pigmentation, uneven tone and sun damage. Kojic acid and niacinamide concentrate, LED light therapy, vitamin C masque.',
 'facial',
 ARRAY[75],
 '{"75": 1350}'::jsonb,
 NULL, 150, true),

('Men''s Grooming Facial',
 'mens-grooming-facial',
 'Deep cleanse and exfoliation for post-shave skin. Targets ingrown hairs, razor bumps and oiliness. No-fuss results-focused treatment.',
 'facial',
 ARRAY[60],
 '{"60": 1100}'::jsonb,
 NULL, 160, true),

-- ── THERMOTHERAPY (Spa Access) ────────────────────────────────
('Thermal Circuit Day Pass',
 'thermal-circuit-day-pass',
 'Unlimited access to the full thermal circuit for the day. Steam room, dry sauna, cold plunge, garden pool and lounge. No reservation needed.',
 'thermotherapy',
 ARRAY[0],
 '{"0": 200}'::jsonb,
 'No Booking Needed', 170, true),

('Thermal Circuit 10-Visit Pass',
 'thermal-circuit-10-visit',
 '10-visit pass for the thermal circuit. Share with a partner or use across multiple visits. Never expires.',
 'thermotherapy',
 ARRAY[0],
 '{"0": 1750}'::jsonb,
 'Save 250 THB', 180, true),

-- ── PACKAGES ──────────────────────────────────────────────────
('Rawai Renewal Package',
 'rawai-renewal-package',
 'The full Ton Mai experience. Thermal circuit → lemongrass body scrub → Ton Mai Signature Massage 90 min → fresh coconut water. Allow 3.5 hours.',
 'package',
 ARRAY[210],
 '{"210": 2800}'::jsonb,
 'Best Value', 190, true),

('Couple''s Bliss Package',
 'couples-bliss-package',
 'Side-by-side in our couple''s room. Thermal circuit → Thai oil massage 90 min each → jasmine foot soak. The perfect anniversary treat.',
 'package',
 ARRAY[180],
 '{"180": 4800}'::jsonb,
 'For Two', 200, true),

('Half-Day Wellness Retreat',
 'half-day-wellness-retreat',
 'Thermal circuit → herbal compress massage 60 min → signature facial 60 min → organic lunch at The Garden Café. Allow 4 hours.',
 'package',
 ARRAY[240],
 '{"240": 3900}'::jsonb,
 NULL, 210, true),

-- ── ADD-ONS ───────────────────────────────────────────────────
('Scalp Oil Treatment',
 'scalp-oil-treatment',
 'Add to any massage. Warm sesame or coconut oil worked into the scalp, then wrapped in a warm towel. Deeply nourishing.',
 'add_on',
 ARRAY[15],
 '{"15": 200}'::jsonb,
 NULL, 220, true),

('Eye Mask Add-On',
 'eye-mask-add-on',
 'Add to any facial or massage. Cooling cucumber and collagen eye patches applied during treatment. Reduces puffiness.',
 'add_on',
 ARRAY[0],
 '{"0": 150}'::jsonb,
 NULL, 230, true),

('Extended Foot Soak',
 'extended-foot-soak',
 'Lemongrass and himalayan salt foot soak before your massage. Softens skin, warms tired feet, helps you arrive present.',
 'add_on',
 ARRAY[15],
 '{"15": 150}'::jsonb,
 NULL, 240, true);

-- ── Default slot settings (09:00–22:00, 30 min intervals, max 3 concurrent) ──
INSERT INTO slot_settings
  (treatment_id, day_of_week, first_slot, last_slot, slot_interval, max_concurrent, is_active)
VALUES
  (NULL, ARRAY[0,1,2,3,4,5,6], '09:00', '22:00', 30, 3, true);
-- treatment_id NULL = applies to all treatments as default

-- ── Seed site_content for key settings ────────────────────────
INSERT INTO site_content (key, value_text, page, section) VALUES
  ('settings.booking_engine_enabled', 'false',        'settings', 'features'),
  ('settings.chatbot_enabled',        'true',         'settings', 'features'),
  ('settings.chatbot_booking_mode',   'simple',       'settings', 'features'),
  ('settings.announcement_enabled',   'false',        'settings', 'features'),
  ('settings.maintenance_mode',       'false',        'settings', 'features'),
  ('settings.whatsapp_number',        '66631175211',  'settings', 'contact'),
  ('settings.line_id',                '@tonmaispa',   'settings', 'contact'),
  ('settings.opening_hours',          '09:00–23:00',  'settings', 'contact'),
  ('settings.day_pass_price',         '200',          'settings', 'pricing'),
  ('settings.google_rating',          '4.8',          'settings', 'seo'),
  ('settings.google_review_count',    '369',          'settings', 'seo'),
  ('settings.instagram_url',          'https://www.instagram.com/tonmaispa/', 'settings', 'social'),
  ('settings.facebook_url',           'https://www.facebook.com/tonmaispa/', 'settings', 'social'),
  ('settings.google_maps_url',        'https://www.google.com/maps/dir/?api=1&destination=Ton+Mai+Spa+Rawai+Phuket', 'settings', 'social')
ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
