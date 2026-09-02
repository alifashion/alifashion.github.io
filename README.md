# ALI FASHION — Ultra UI v2

Complete replacement storefront + editable hidden admin for the existing GitHub Pages + Supabase project.

## What changed
- Entire storefront redesigned: light premium editorial style, no 3D hero.
- Smooth reveal/scroll animations and product click animation.
- Mobile-first UI with swipeable category cards and bottom-sheet product modal.
- Menu defaults: MEN, WOMEN, KIDS, FORMAL, CASUAL, NEW ARRIVAL, LOAFER, OXFORD, SNEAKERS, FOOTBALL BOOT, CRICKET BOOT.
- Hidden Studio now has a dedicated **Menu** manager: add, rename, delete and reorder menu items.
- Products, product photos, category photos, categories, homepage text, hero image, promo image, logo, favicon, orders and store settings are all editable.

## Replace the GitHub files
Upload the contents of this folder to the root of `alifashion.github.io` and replace existing files when GitHub asks.

Important replacement files:
- `index.html`
- `af-studio-73x9.html`
- `css/style.css`
- `css/admin.css`
- `js/app.js`
- `js/admin.js`
- `js/config.js`
- `assets/`
- `.nojekyll`

## One-time Supabase upgrade
In Supabase Dashboard → SQL Editor → New query, paste the whole content of:

`supabase/upgrade-v2.sql`

Press **Run** once. This hides the old GEN-Z category, creates the new requested footwear categories and stores the v2 menu/homepage defaults.

## How the menu works
In hidden Studio → **Menu**:
- `Tag`: use values like `men`, `women`, `kids`, `formal`, `casual`. Add the same word in a product's **Tags** field.
- `Category`: use a category slug such as `loafer`, `oxford`, `sneakers`, `football-boot`, `cricket-boot`.
- `New Arrival`: shows products whose **New arrival** checkbox is enabled.
- `All products`: shows everything.
- `Custom link`: can use a URL or section like `#shop`.

## Product organization example
A men's formal loafer can be:
- Category: `LOAFER`
- Tags: `men, formal`

A women's casual sneaker can be:
- Category: `SNEAKERS`
- Tags: `women, casual`

This lets one product appear under several menu filters without duplicating the product.

## Gmail order emails
The included `supabase/functions/place-order/` function supports both owner and customer order emails through Gmail API. Keep these values only in Supabase Edge Function Secrets:
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`

Do not put Gmail secrets or the Supabase service-role key in GitHub.
