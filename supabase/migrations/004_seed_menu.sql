-- ============================================================
-- TON MAI SPA — F&B Menu Seed Data (English 2025)
-- ============================================================

-- ── Categories ─────────────────────────────────────────────────
INSERT INTO menu_categories (name, slug, type, sort_order) VALUES
  ('Breakfast',              'breakfast',         'food', 10),
  ('Appetizers',             'appetizers',        'food', 20),
  ('Salads',                 'salads',            'food', 30),
  ('Sandwiches & Wraps',     'sandwiches-wraps',  'food', 40),
  ('Soups & Curry',          'soups-curry',       'food', 50),
  ('Carnivore Plates',       'carnivore-plates',  'food', 60),
  ('Thai Food',              'thai-food',         'food', 70),
  ('Desserts',               'desserts',          'food', 80),
  ('Coffee',                 'coffee',            'drink', 90),
  ('Tea',                    'tea',               'drink', 100),
  ('Electrolytes & Juice',   'electrolytes',      'drink', 110),
  ('Cold Drinks',            'cold-drinks',       'drink', 120),
  ('Smoothies & Shakes',     'smoothies-shakes',  'drink', 130),
  ('Cocktails',              'cocktails',         'drink', 140),
  ('Wine & Beer',            'wine-beer',         'drink', 150)
ON CONFLICT (slug) DO NOTHING;

-- ── Breakfast (codes 10–16) ────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Granola Bowl',         'Homemade granola, fresh seasonal fruits, natural yoghurt, honey drizzle', 180, NULL, false, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Smoothie Bowl',        'Acai or mango base, banana, berries, coconut flakes, chia seeds, honey',   190, 'Vegan', true,  20),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Avocado Toast',        'Sourdough, smashed avocado, cherry tomato, feta, everything bagel spice',   220, NULL, false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Eggs Benedict',        'Sourdough muffin, Canadian bacon, poached eggs, hollandaise, chives',       240, NULL, false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Full Protein Plate',   'Scrambled eggs, bacon, sausage, sautéed mushrooms, cherry tomato, toast',   280, NULL, false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'Ton Mai Breakfast Wrap','Scrambled eggs, chicken sausage, cheddar, roasted pepper, harissa aioli',  220, NULL, false, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'breakfast'), 'French Toast',         'Brioche, maple syrup, fresh berries, mascarpone cream',                     200, NULL, false, 70);

-- ── Appetizers (codes 20–24) ──────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'appetizers'), 'Edamame',              'Steamed Japanese soybeans, sea salt or garlic-soy sauce',                   120, 'Vegan', false, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'appetizers'), 'Spring Rolls (4 pcs)', 'Crispy rolls, glass noodle & vegetable filling, sweet chilli dip',          150, 'Vegan', false, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'appetizers'), 'Chicken Satay (4 pcs)','Marinated chicken skewers, peanut sauce, cucumber relish',                   180, NULL, true,  30),
  ((SELECT id FROM menu_categories WHERE slug = 'appetizers'), 'Guacamole & Chips',    'Freshly made guacamole, corn tortilla chips, pico de gallo',                180, 'GF', false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'appetizers'), 'Bruschetta',           'Toasted baguette, heirloom tomato, fresh basil, balsamic reduction',        160, 'Vegan', false, 50);

-- ── Salads (codes 30–35) ──────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Garden Green Salad',   'Mixed leaves, cucumber, cherry tomato, carrot, lemon vinaigrette',           180, 'Vegan GF', false, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Caesar Salad',         'Cos lettuce, parmesan, croutons, house Caesar dressing. Add chicken +60',    220, NULL, false, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Watermelon & Feta',    'Fresh watermelon, feta, mint, red onion, lime & olive oil',                  200, 'GF', true,  30),
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Tuna Niçoise',         'Seared tuna, green beans, olives, egg, potato, Dijon vinaigrette',           280, 'GF', false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Thai Papaya Salad',    'Green papaya, cherry tomato, green bean, peanut, lime, chilli, fish sauce',  180, 'GF', true,  50),
  ((SELECT id FROM menu_categories WHERE slug = 'salads'), 'Quinoa Power Bowl',    'Tricolor quinoa, roasted sweet potato, avocado, edamame, sesame miso',       250, 'Vegan GF', false, 60);

-- ── Sandwiches & Wraps (codes 40–45) ─────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'Club Sandwich',        'Triple-decker: chicken, bacon, egg, lettuce, tomato, mayo, sourdough',       280, NULL, true,  10),
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'Grilled Chicken Wrap', 'Grilled chicken, avocado, romaine, tomato, ranch, whole wheat tortilla',     260, NULL, false, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'Falafel Wrap',         'Falafel, hummus, tabouleh, pickled cabbage, tahini, pita',                   240, 'Vegan', false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'BLT',                  'Bacon, lettuce, tomato, aioli, toasted sourdough',                           240, NULL, false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'Tuna Melt',            'Albacore tuna, cheddar, jalapeño, sourdough, grilled',                       260, NULL, false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'sandwiches-wraps'), 'Smashed Beef Burger',  'Double smash patty, American cheese, pickles, special sauce, brioche bun',   320, NULL, true,  60);

-- ── Soups & Curry (codes 50–55) ───────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Tom Kha Gai',          'Coconut milk soup, galangal, lemongrass, chicken, kaffir lime, mushroom',    180, 'GF', true,  10),
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Tom Yum Goong',        'Spicy prawn soup, lemongrass, kaffir lime, chilli, mushroom, tomato',         200, 'GF', true,  20),
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Green Curry',          'Thai green curry paste, coconut milk, chicken or tofu, Thai eggplant, basil', 220, 'GF', false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Massaman Curry',       'Rich massaman paste, beef, potato, roasted peanut, coconut milk, served with rice', 250, 'GF', false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Pumpkin Soup',         'Roasted pumpkin, coconut cream, ginger, toasted seeds, sourdough',           180, 'Vegan', false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'soups-curry'), 'Red Lentil Dal',       'Spiced red lentil, tomato, coconut milk, cumin, served with jasmine rice',   200, 'Vegan GF', false, 60);

-- ── Carnivore Plates (codes 60–66) ────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Grilled Chicken Breast','Herb marinated, served with roasted vegetables and lemon caper sauce',       280, 'GF', false, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Grilled Salmon',        'Atlantic salmon, seasonal greens, lemon butter, dill, baby potato',          360, 'GF', true,  20),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Pork Chop',             'Char-grilled pork chop, apple slaw, mashed potato, rosemary jus',           320, NULL, false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Beef Tenderloin',       '200g tenderloin, served with truffle fries, mushroom sauce or chimichurri',  480, 'Chef''s Special', true, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Prawn Pad Thai',        'Stir-fried rice noodle, tiger prawns, egg, beansprout, peanut, lime',        280, NULL, false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Mixed Grill Plate',     'Chicken satay, lamb chop, beef skewer, grilled vegetable, chimichurri',      520, 'Share', false, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'carnivore-plates'), 'Tuna Steak',            'Sesame-crusted seared tuna, edamame purée, pickled ginger, soy glaze',       380, 'GF', false, 70);

-- ── Thai Food (codes 70–85) ───────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Khao Pad (Fried Rice)', 'Thai jasmine fried rice, egg, onion, spring onion. Chicken/Pork/Veg +20 Shrimp', 160, NULL, false, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Pad Krapow Gai',        'Stir-fried chicken or pork, holy basil, chilli, oyster sauce, fried egg, rice', 180, 'Spicy', true, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Pad See Ew',            'Wide rice noodle, egg, Chinese broccoli, sweet soy. Chicken or pork',            180, NULL, false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Som Tum Thai',          'Classic green papaya salad, peanut, dried shrimp, lime, palm sugar',             180, 'Spicy GF', true, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Larb Moo',              'Minced pork salad, roasted rice, herb, shallot, lime, chilli',                    200, 'Spicy GF', false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Khao Man Gai',          'Poached chicken, fragrant rice cooked in broth, ginger-soy-chilli sauce',         200, NULL, false, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Gang Keow Wan',         'Green curry, chicken or tofu, coconut milk, Thai eggplant, sweet basil, rice',   220, 'GF', false, 70),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Gang Massaman',         'Massaman beef curry, potato, peanut, coconut milk, fried shallot, rice',          250, 'GF', false, 80),
  ((SELECT id FROM menu_categories WHERE slug = 'thai-food'), 'Mango Sticky Rice',     'Fresh mango, warm coconut sticky rice, coconut cream drizzle, sesame',            160, 'Dessert', true, 90);

-- ── Desserts (codes 90–97) ────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, is_recommended, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Mango Sticky Rice',     'See Thai Food — also listed here as dessert signature',                      160, 'Thai Classic', true, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Chocolate Lava Cake',   'Warm dark chocolate cake, vanilla ice cream, berry coulis',                   180, NULL, false, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Coconut Panna Cotta',   'Set coconut cream, passion fruit gel, toasted coconut flakes',                160, 'Vegan', false, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Banana Foster',         'Caramelized banana, rum sauce, vanilla ice cream, cinnamon',                   170, NULL, false, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Affogato',              'Double espresso over vanilla ice cream, cantuccini biscuit',                   140, NULL, false, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Fruit Platter',         'Seasonal fresh tropical fruit — mango, dragon fruit, pineapple, watermelon',  180, 'Vegan GF', false, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Cheesecake of the Day', 'Ask staff for today''s flavour. Always with berry compote and cream',          170, NULL, false, 70),
  ((SELECT id FROM menu_categories WHERE slug = 'desserts'), 'Ice Cream (3 scoops)',  'Vanilla, chocolate, coconut, strawberry, or green tea. Ask for daily specials', 160, NULL, false, 80);

-- ── Coffee ────────────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, price, price_note, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Espresso',       80,  'Single / Double +20',  10),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Americano',      90,  'Hot / Iced',           20),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Flat White',     100, 'Hot / Iced',           30),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Cappuccino',     100, 'Hot',                  40),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Latte',          100, 'Hot / Iced',           50),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Mocha',          110, 'Hot / Iced',           60),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Cortado',        95,  'Hot',                  70),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Cold Brew',      120, 'Black or with milk',   80),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Iced Matcha Latte', 130, 'Oat milk available +20', 90),
  ((SELECT id FROM menu_categories WHERE slug = 'coffee'), 'Iced Caramel Latte', 120, NULL,               100);

-- ── Tea ───────────────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Lemongrass & Ginger', 'Organic Thai lemongrass, fresh ginger — spa signature herbal blend',     90, 'Signature', 10),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Peppermint',          'Organic pure peppermint leaf, cool and cleansing',                        90, NULL, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Chamomile',           'Organic chamomile flower, calming, caffeine-free',                        90, NULL, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Butterfly Pea',       'Thai blue flower tea — shifts from blue to purple with lime. Stunning.',  100, 'Insta', 40),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Jasmine Green Tea',   'Organic green tea scented with jasmine flowers',                          90, NULL, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Rooibos',             'South African red bush, caffeine-free, naturally sweet',                   90, NULL, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'tea'), 'Earl Grey',           'Premium Ceylon black tea with bergamot',                                   90, NULL, 70);

-- ── Electrolytes & Juice ──────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Ton Mai D-Light',      'House electrolyte blend — coconut water, Himalayan salt, lime, honey. The post-sauna drink.', 150, 'House Special', 10),
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Matcha D-Light',       'Ceremonial matcha, coconut water, Himalayan salt, lime',                                       160, 'Antioxidant', 20),
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Cold Pressed Green',   'Spinach, cucumber, celery, green apple, ginger, lemon',                                        160, 'Cold Pressed', 30),
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Cold Pressed Sunset',  'Carrot, orange, turmeric, ginger, pineapple',                                                  160, 'Cold Pressed', 40),
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Fresh Coconut',        'Young coconut, served whole with straw — straight from the tree',                               100, NULL, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'electrolytes'), 'Fresh Orange Juice',   'Freshly squeezed orange juice, no ice',                                                        120, NULL, 60);

-- ── Cold Drinks ───────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, price, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Still Water (500ml)',    50, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Sparkling Water (500ml)', 70, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Soft Drink (can)',        70, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Coconut Water (tetra)',   80, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Kombucha',               120, 50),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Fresh Lime Soda',         90, 60),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Thai Iced Tea',          100, 70),
  ((SELECT id FROM menu_categories WHERE slug = 'cold-drinks'), 'Thai Iced Coffee',       100, 80);

-- ── Smoothies & Protein Shakes ────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, badge, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Green Power',          'Spinach, banana, mango, coconut milk, chia seeds',                       120, NULL, 10),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Tropical Bliss',       'Mango, pineapple, coconut milk, lime, mint',                             120, NULL, 20),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Berry Antioxidant',    'Mixed berries, banana, almond milk, flaxseed',                           120, NULL, 30),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Peanut Butter Banana', 'Banana, peanut butter, oat milk, honey, cinnamon',                      120, NULL, 40),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Whey Protein Shake',   'Optimum Nutrition Gold Standard Whey + your choice of fruit smoothie',   120, 'Protein', 50),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Chocolate Recovery',   'Whey protein, chocolate, banana, oat milk, honey — post-workout',        120, 'Protein', 60),
  ((SELECT id FROM menu_categories WHERE slug = 'smoothies-shakes'), 'Vanilla Protein Bowl', 'Vanilla whey, acai, banana, coconut flakes, granola',                    140, 'Protein', 70);

-- ── Cocktails ─────────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, price_note, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Ton Mai Garden',         'Gin, cucumber, lemongrass syrup, elderflower, tonic — the house cocktail', 200, 'Domestic', 10),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Lychee Martini',         'Vodka, lychee liqueur, lychee juice, fresh lime, lychee garnish',          200, 'Domestic', 20),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Thai Basil Smash',       'Whisky, Thai basil, lime, simple syrup, crushed ice',                      200, 'Domestic', 30),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Passion Fruit Mojito',   'Rum, passion fruit, lime, mint, soda, brown sugar',                         200, 'Domestic', 40),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Ginger Mule',            'Vodka or rum, ginger beer, fresh lime, mint, copper mug',                   200, 'Domestic', 50),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Paloma',                 'Tequila, fresh grapefruit, lime, agave, salt rim',                          240, 'Imported', 60),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Aperol Spritz',          'Aperol, prosecco, soda, orange slice',                                      240, 'Imported', 70),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Negroni',                'Gin, Campari, sweet vermouth, orange peel',                                  240, 'Imported', 80),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Old Fashioned',          'Bourbon, orange bitters, sugar, ice sphere, orange twist',                   240, 'Imported', 90),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Espresso Martini',       'Vodka, cold brew, coffee liqueur, sugar syrup, coffee beans',                240, 'Imported', 100),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Margarita',              'Tequila, triple sec, fresh lime, agave, salt or tajin rim',                  240, 'Imported', 110),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Long Island Iced Tea',   'Vodka, gin, rum, tequila, triple sec, lime, cola',                           240, 'Imported', 120),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Pina Colada',            'White rum, coconut cream, pineapple juice, blended',                         200, 'Domestic', 130),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Whisky Sour',            'Bourbon or Scotch, fresh lemon, sugar, egg white, cherry',                   240, 'Imported', 140),
  ((SELECT id FROM menu_categories WHERE slug = 'cocktails'), 'Mango Daiquiri',         'White rum, fresh mango, lime juice, sugar',                                   200, 'Domestic', 150);

-- ── Wine & Beer ───────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, price, price_note, sort_order) VALUES
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'House Red Wine',      280, 'Glass / 890 Bottle',  10),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'House White Wine',    280, 'Glass / 890 Bottle',  20),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Rosé Wine',           300, 'Glass / 950 Bottle',  30),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Prosecco',            320, 'Glass / 990 Bottle',  40),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Chang Beer',          100, '320ml can',           50),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Singha Beer',         100, '320ml can',           60),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Leo Beer',             90, '320ml can',           70),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Heineken',            130, '330ml bottle',        80),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Corona',              140, '330ml bottle',        90),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Domestic Spirit + Mixer', 160, 'Single pour',    100),
  ((SELECT id FROM menu_categories WHERE slug = 'wine-beer'), 'Imported Spirit + Mixer', 200, 'Single pour',    110);
