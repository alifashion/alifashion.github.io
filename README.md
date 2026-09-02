# ALI FASHION — Gen-Z Shoe Ecommerce

Static storefront + secure hidden admin studio built for **GitHub Pages + Supabase**. The uploaded ALI FASHION logo is already included as the default logo and favicon. Products, categories, homepage text, buttons, prices, images, logo/favicon, settings and order statuses are editable from Supabase-backed Studio.

## What is included

- Gen-Z dark/red 3D storefront, responsive for mobile and desktop
- New Arrival, GEN-Z, Sneakers, Kids, Sale categories
- Search, product modal, size/color selection, cart and checkout
- Supabase database + RLS security
- Supabase Storage image upload/delete from admin
- Hidden admin page: `af-studio-73x9.html`
- Product/category CRUD, full website content JSON editor, brand asset manager, order dashboard
- Server-side price calculation in a Supabase Edge Function
- Owner + customer automatic order email through **your Gmail account via Gmail API**
- No service-role key or Gmail secret is ever placed in the GitHub frontend

## 1) Supabase database setup

Open your Supabase project:

`https://ihlxzljbkigoawikfjfg.supabase.co`

Then go to **SQL Editor → New query**, paste the complete content of:

`supabase/schema.sql`

and press **Run** once.

This creates the tables, demo shoe products, RLS policies and public `media` Storage bucket.

## 2) Create the admin account

In Supabase go to **Authentication → Users → Add user** and create your admin email/password.

Then run this in SQL Editor, replacing the email:

```sql
insert into public.profiles(id, role)
select id, 'admin' from auth.users where email='YOUR-ADMIN-EMAIL@gmail.com'
on conflict(id) do update set role='admin';
```

The admin page is intentionally not linked anywhere on the public site. RLS still protects it even if someone guesses the URL.

## 3) Gmail automatic order emails

A GitHub Pages browser cannot safely send arbitrary Gmail messages by itself. The included Supabase Edge Function sends both emails server-side using Gmail API, so hosting/backend stays GitHub + Supabase and your own Gmail handles delivery.

You need four private Supabase Edge Function secrets:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL` — the Gmail account that sends confirmations

### Get Gmail OAuth credentials

1. Create/open a Google Cloud project.
2. Enable **Gmail API**.
3. Configure OAuth consent screen. If the app is in Testing mode, add your Gmail as a test user.
4. Create an **OAuth Client ID**.
5. Use Google OAuth 2.0 Playground with your own client credentials and authorize only:
   `https://www.googleapis.com/auth/gmail.send`
6. Exchange the authorization code and copy the refresh token.

Never put these values in `js/config.js` or in GitHub files.

### Add the secrets in Supabase

Supabase Dashboard → **Edge Functions → Secrets**, add the four values above.

Then log in to the hidden Studio after deployment and set **Settings → Owner email**. That address receives new-order notices. It is saved in the private `private_settings` table and is not exposed to shoppers.

## 4) Deploy the Edge Function

### Easiest: Supabase Dashboard

Create/deploy a function named `place-order` from the files inside:

`supabase/functions/place-order/`

Because checkout is public/anonymous, deploy it with JWT verification disabled. The function itself validates the order, loads real prices from the database and only then creates the order.

### Or use the included GitHub Action

Add this repository secret in GitHub:

`SUPABASE_ACCESS_TOKEN`

Then run **Actions → Deploy Supabase Edge Function → Run workflow**.

## 5) Upload to GitHub Pages

Upload the contents of this folder to your GitHub repository. Important files/folders to upload:

- `index.html`
- `af-studio-73x9.html`
- `assets/`
- `css/`
- `js/`
- `supabase/`
- `.github/`
- `.nojekyll`

Then GitHub → **Settings → Pages** → Deploy from branch → `main` / root.

Your storefront will look like:

`https://YOUR-USERNAME.github.io/YOUR-REPO/`

Hidden Studio:

`https://YOUR-USERNAME.github.io/YOUR-REPO/af-studio-73x9.html`

## 6) First admin setup

Open the hidden Studio and sign in. Then:

- **Website content** → change hero text, nav, footer, buttons, etc.
- **Logo & assets** → upload/replace/delete logo, favicon and media
- **Categories** → edit New Arrival / GEN-Z / etc.
- **Products** → upload shoe photos, edit prices, sizes, colors, stock, badges
- **Settings** → owner email, shipping fee, free-shipping threshold, phone/address
- **Orders** → see customer details and change status from new → confirmed → shipped → delivered

## Security notes

`sb_publishable_...` is designed to be used in the browser. Your project URL and publishable key are already configured in `js/config.js`.

Never add a Supabase `service_role`/secret key, Gmail client secret or Gmail refresh token to GitHub frontend files. Those secrets belong only in Supabase Edge Function Secrets.

For production, also consider changing the hidden Studio filename to your own random name. That is only extra obscurity; the real security is Supabase Auth + RLS.
