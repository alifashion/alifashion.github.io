-- ALI FASHION ULTRA UI v2 — one-time upgrade
-- Run this AFTER the original schema.sql has already been run.

-- Remove the old GEN-Z collection from the visible storefront.
update public.categories set is_active=false where slug='gen-z';

-- Keep / create the collections requested for the new storefront.
insert into public.categories(name,slug,description,sort_order,is_active) values
('NEW ARRIVAL','new-arrival','Fresh pairs just added.',1,true),
('LOAFER','loafer','Smart, easy, everyday.',2,true),
('OXFORD','oxford','Polished formal classics.',3,true),
('SNEAKERS','sneakers','Daily comfort, clean style.',4,true),
('FOOTBALL BOOT','football-boot','Built for match day.',5,true),
('CRICKET BOOT','cricket-boot','Grip, balance, performance.',6,true),
('KIDS','kids','Comfort for little feet.',7,true),
('FORMAL','formal','Refined footwear for dressed-up days.',8,true),
('CASUAL','casual','Relaxed everyday footwear.',9,true)
on conflict(slug) do update set
  name=excluded.name,
  description=excluded.description,
  sort_order=excluded.sort_order,
  is_active=true;

-- Persist the new menu/homepage content. The admin studio can edit every value later.
insert into public.site_content(key,value) values
('homepage', '{
  "version":2,
  "nav":[
    {"label":"MEN","type":"tag","value":"men"},
    {"label":"WOMEN","type":"tag","value":"women"},
    {"label":"KIDS","type":"tag","value":"kids"},
    {"label":"FORMAL","type":"tag","value":"formal"},
    {"label":"CASUAL","type":"tag","value":"casual"},
    {"label":"NEW ARRIVAL","type":"new","value":""},
    {"label":"LOAFER","type":"category","value":"loafer"},
    {"label":"OXFORD","type":"category","value":"oxford"},
    {"label":"SNEAKERS","type":"category","value":"sneakers"},
    {"label":"FOOTBALL BOOT","type":"category","value":"football-boot"},
    {"label":"CRICKET BOOT","type":"category","value":"cricket-boot"}
  ],
  "hero":{
    "eyebrow":"THE NEW FOOTWEAR EDIT",
    "title":"Move better.|Look sharper.",
    "text":"Everyday sneakers, polished formals and performance boots — selected for the way you actually live.",
    "primary":"SHOP NEW ARRIVALS",
    "secondary":"EXPLORE ALL",
    "image_url":"",
    "float_top":"NEW SEASON",
    "float_title":"Designed for every step.",
    "float_button":"View collection →",
    "proof":[["COD","AVAILABLE"],["FAST","DELIVERY"],["EASY","SIZE SUPPORT"]]
  },
  "ticker":["MEN","WOMEN","KIDS","LOAFERS","OXFORDS","SNEAKERS","FOOTBALL BOOTS","CRICKET BOOTS"],
  "categories_section":{"eyebrow":"SHOP YOUR WAY","title":"Built around your day.","text":"From office-ready classics to match-day performance."},
  "products":{"eyebrow":"FRESH PAIRS","title":"New arrivals"},
  "editorial":{"eyebrow":"ALI FASHION SELECTS","title":"One store.|Every occasion.","text":"Loafers for the office, sneakers for everyday, and boots built for the pitch. Find the right pair without the guesswork.","button":"DISCOVER THE COLLECTION","image_url":""},
  "benefits":[["FAST DELIVERY","Quick dispatch on confirmed orders."],["CASH ON DELIVERY","Pay when your order reaches you."],["SIZE SUPPORT","Need help? We help you choose."],["FRESH COLLECTION","New footwear added regularly."]],
  "final":{"eyebrow":"YOUR NEXT PAIR IS HERE","title":"Good shoes change the whole fit.","text":"Explore the latest ALI FASHION collection and order in a few taps.","button":"SHOP NOW"},
  "footer":{"text":"Footwear for work, weekends and game day.","links":[["New Arrival","new"],["Sneakers","category:sneakers"],["Loafers","category:loafer"],["Football Boots","category:football-boot"]],"copyright":"© 2026 ALI FASHION. ALL RIGHTS RESERVED."}
}'::jsonb)
on conflict(key) do update set value=excluded.value, updated_at=now();
