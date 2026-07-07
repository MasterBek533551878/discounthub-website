# DiscountHub Website

Static website for DiscountHub, deployed on Cloudflare Pages.

Production domain: https://discounthub.uz
API base URL used by the site: https://api.discounthub.uz

## Local preview

```powershell
py -3 -m http.server 5173
```

Then open:

```text
http://127.0.0.1:5173
```

## Deploy to Cloudflare Pages

```powershell
npx --yes wrangler pages deploy . --project-name discounthub-website
```


## Web product direction

This repository contains the standalone DiscountHub website. It is intentionally separated from the Flutter app/backend repository so the web product can be improved without touching the mobile application or production API code.

Current direction:

- `/deals/` is a live web deal browser powered by the public API.
- `/promo-codes/` is a live promo/coupon browser powered by the public API.
- `/partner-offers/` is a live partner-offer browser and submission entry point.
- `/stores/` is a live store directory built from API facets.
- The iOS app remains promoted, while Android is described as in review rather than used as the main CTA.
