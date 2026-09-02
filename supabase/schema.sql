-- ALI FASHION ecommerce schema
-- Run this entire file once in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('admin','viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique,
  sku text unique,
  short_description text,
  description text,
  price numeric(12,2) not null check(price >= 0),
  compare_at_price numeric(12,2) check(compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check(stock >= 0),
  sizes text[] not null default '{}',
  colors text[] not null default '{}',
  tags text[] not null default '{}',
  images text[] not null default '{}',
  badge text,
  featured boolean not null default false,
  is_new boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.private_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  customer_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  address text not null,
  note text,
  items jsonb not null,
  subtotal numeric(12,2) not null,
  shipping_fee numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  status text not null default 'new' check(status in ('new','confirmed','processing','shipped','delivered','cancelled','refunded')),
  email_status text not null default 'pending',
  email_error text,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_products_active_new on public.products(is_active,is_new);
create index if not exists idx_orders_created on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,role) values(new.id,'viewer') on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Auto-create slugs if omitted.
create or replace function public.product_slug_fill()
returns trigger language plpgsql as $$
begin
  if new.slug is null or btrim(new.slug)='' then
    new.slug := lower(regexp_replace(new.name,'[^a-zA-Z0-9]+','-','g')) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);
  end if;
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists trg_product_slug on public.products;
create trigger trg_product_slug before insert or update on public.products for each row execute procedure public.product_slug_fill();

create or replace function public.touch_category()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_category_touch on public.categories;
create trigger trg_category_touch before update on public.categories for each row execute procedure public.touch_category();

-- RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_content enable row level security;
alter table public.private_settings enable row level security;
alter table public.orders enable row level security;

-- Profiles: an authenticated user can read only their own role.
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles for select to authenticated using(id=auth.uid());

-- Public storefront reads only visible catalog content.
drop policy if exists "public categories read" on public.categories;
create policy "public categories read" on public.categories for select to anon,authenticated using(is_active=true or public.is_admin());
drop policy if exists "public products read" on public.products;
create policy "public products read" on public.products for select to anon,authenticated using(is_active=true or public.is_admin());
drop policy if exists "public site content read" on public.site_content;
create policy "public site content read" on public.site_content for select to anon,authenticated using(true);

-- Admin CRUD.
create policy "admin categories insert" on public.categories for insert to authenticated with check(public.is_admin());
create policy "admin categories update" on public.categories for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin categories delete" on public.categories for delete to authenticated using(public.is_admin());
create policy "admin products insert" on public.products for insert to authenticated with check(public.is_admin());
create policy "admin products update" on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin products delete" on public.products for delete to authenticated using(public.is_admin());
create policy "admin site content insert" on public.site_content for insert to authenticated with check(public.is_admin());
create policy "admin site content update" on public.site_content for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin site content delete" on public.site_content for delete to authenticated using(public.is_admin());
create policy "admin private settings all" on public.private_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin orders read" on public.orders for select to authenticated using(public.is_admin());
create policy "admin orders update" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- Public media bucket. Upload/delete remains admin-only through RLS below.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('media','media',true,10485760,array['image/jpeg','image/png','image/webp','image/gif','image/avif','image/svg+xml'])
on conflict(id) do update set public=true;

drop policy if exists "public media read" on storage.objects;
create policy "public media read" on storage.objects for select to public using(bucket_id='media');
drop policy if exists "admin media insert" on storage.objects;
create policy "admin media insert" on storage.objects for insert to authenticated with check(bucket_id='media' and public.is_admin());
drop policy if exists "admin media update" on storage.objects;
create policy "admin media update" on storage.objects for update to authenticated using(bucket_id='media' and public.is_admin()) with check(bucket_id='media' and public.is_admin());
drop policy if exists "admin media delete" on storage.objects;
create policy "admin media delete" on storage.objects for delete to authenticated using(bucket_id='media' and public.is_admin());

-- Initial editable content.
insert into public.site_content(key,value) values
('brand', '{"store_name":"ALI FASHION","logo_url":"","favicon_url":"","announcement":"FREE DELIVERY ON SELECTED DROPS · CASH ON DELIVERY AVAILABLE"}'::jsonb),
('homepage', '{
  "nav":[{"label":"NEW ARRIVAL","href":"#shop"},{"label":"GEN-Z","href":"#genz"},{"label":"SNEAKERS","href":"#shop"},{"label":"KIDS","href":"#shop"}],
  "hero":{"eyebrow":"NEW DROP / 26","title":"STEP INTO|YOUR ERA.","text":"Street-ready sneakers and everyday pairs built for the main character in you.","primary":"SHOP THE DROP","secondary":"EXPLORE GEN-Z","stage_tag":"ALI / 001","stage_price":"DROP CULTURE","pill1":"3D ENERGY","pill2":"GEN-Z FIT","stats":[["100%","AUTHENTIC VIBE"],["24/7","ORDER ANYTIME"],["FAST","DHAKA DELIVERY"]]},
  "categories_section":{"eyebrow":"PICK YOUR MOOD","title":"Shop by vibe.","text":"Fresh rotation. Zero boring pairs."},
  "products":{"eyebrow":"LATEST HEAT","title":"New arrivals."},
  "genz":{"eyebrow":"GEN-Z EDIT","title":"Not made to blend in.","text":"Chunky proportions, sharp details, fearless colors. Curated for people who dress like the algorithm is watching.","button":"FIND YOUR PAIR"},
  "trust":[["FAST DELIVERY","Quick dispatch on confirmed orders."],["CASH ON DELIVERY","Pay when your order reaches you."],["SIZE SUPPORT","Message us if you need help choosing."],["FRESH DROPS","New footwear added regularly."]],
  "newsletter":{"eyebrow":"DON''T MISS THE DROP","title":"Your inbox deserves better shoes.","text":"Follow our latest arrivals and limited drops.","button":"SHOP NOW"},
  "footer":{"text":"Footwear for your next era.","links":[["New Arrival","#shop"],["GEN-Z","#genz"],["Cart","#cart"],["Contact","#contact"]],"copyright":"© 2026 ALI FASHION. ALL RIGHTS RESERVED."}
}'::jsonb),
('ui', '{"add_to_cart":"ADD TO CART","select_size":"Size","select_color":"Color","sold_out":"SOLD OUT","cart_empty":"Your cart is waiting for a first pair.","empty_products":"No products in this drop yet. Come back soon.","order_success":"Order placed! Check your email for confirmation.","search_placeholder":"Search your next pair…","cart_eyebrow":"YOUR ROTATION","cart_title":"Cart","subtotal":"Subtotal","shipping_note":"Shipping is calculated at checkout.","checkout_button":"CHECKOUT","checkout_eyebrow":"SECURE CHECKOUT","checkout_title":"Complete your order","name_label":"Full name","email_label":"Email","phone_label":"Phone","city_label":"City","address_label":"Delivery address","note_label":"Order note","optional_label":"(optional)","estimated_total":"Estimated total","place_order":"PLACE ORDER","placing_order":"PLACING ORDER…"}'::jsonb),
('settings', '{"store_name":"ALI FASHION","currency":"BDT","shipping_fee":80,"free_shipping_over":3000,"phone":"","address":""}'::jsonb)
on conflict(key) do nothing;

-- Initial categories (all editable/deleteable from Studio).
insert into public.categories(name,slug,description,sort_order) values
('NEW ARRIVAL','new-arrival','Fresh out the box.',1),
('GEN-Z','gen-z','Loud. Clean. Current.',2),
('SNEAKERS','sneakers','Daily rotation.',3),
('KIDS','kids','Little feet, big energy.',4),
('SALE','sale','Good pairs. Better prices.',5)
on conflict(slug) do nothing;

-- Demo products so the site looks alive immediately. Delete/edit them in Studio.
insert into public.products(category_id,name,sku,short_description,description,price,compare_at_price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Velocity 01','AF-V01','Future-runner sneaker','A lightweight everyday sneaker with a sharp street silhouette.',2490,2890,18,array['39','40','41','42','43'],array['White / Red','Black'],array['gen-z','sneaker'],'NEW',true,true,true,1 from public.categories c where c.slug='new-arrival' and not exists(select 1 from public.products where sku='AF-V01');
insert into public.products(category_id,name,sku,short_description,description,price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Nova Chunk','AF-NC2','Chunky Gen-Z statement pair','Bold volume, clean panels and a comfortable everyday base.',2790,15,array['39','40','41','42','43'],array['Bone','Graphite'],array['gen-z','chunky'],'GEN-Z',true,true,true,2 from public.categories c where c.slug='gen-z' and not exists(select 1 from public.products where sku='AF-NC2');
insert into public.products(category_id,name,sku,short_description,description,price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Metro Flex','AF-MF3','Clean city sneaker','Minimal lines for college, commute and casual fits.',2190,22,array['39','40','41','42','43'],array['Black','White'],array['sneaker'],'HOT',true,false,true,3 from public.categories c where c.slug='sneakers' and not exists(select 1 from public.products where sku='AF-MF3');
insert into public.products(category_id,name,sku,short_description,description,price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Crimson Shift','AF-CS4','Red-accent street sneaker','A statement sneaker built around the ALI FASHION red.',2590,14,array['40','41','42','43'],array['White / Crimson'],array['gen-z','sneaker'],'DROP',true,true,true,4 from public.categories c where c.slug='gen-z' and not exists(select 1 from public.products where sku='AF-CS4');
insert into public.products(category_id,name,sku,short_description,description,price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Kid Rush','AF-KR5','Everyday kids sneaker','Easy, energetic and built for daily movement.',1490,20,array['30','31','32','33','34','35'],array['Blue','Red'],array['kids'],'KIDS',false,true,true,5 from public.categories c where c.slug='kids' and not exists(select 1 from public.products where sku='AF-KR5');
insert into public.products(category_id,name,sku,short_description,description,price,compare_at_price,stock,sizes,colors,tags,badge,featured,is_new,is_active,sort_order)
select c.id,'Mono Street','AF-MS6','Monochrome daily pair','An easy black-on-black option for almost every outfit.',1790,2190,16,array['39','40','41','42','43'],array['Triple Black'],array['sale','sneaker'],'SALE',false,false,true,6 from public.categories c where c.slug='sale' and not exists(select 1 from public.products where sku='AF-MS6');

-- After you create your admin user in Authentication > Users, run this once:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR-ADMIN-EMAIL@gmail.com');
