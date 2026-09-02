# DiscountHub WebMCP

The existing DiscountHub website with four native browser tools for searching live
discounts, coupon codes and store offers. Agent results use the same cards as manual
browsing. The separate Flutter application and FastAPI backend are in
[discounthub](https://github.com/MasterBek533551878/discounthub).

- Live website: https://discounthub.uz/deals/
- Setup, tool scope, native browser checks and verification: [WEBMCP.md](WEBMCP.md)
- License: [MIT](LICENSE)

## Local preview

```powershell
py -3 scripts/serve_webmcp.py
```

Open `http://127.0.0.1:8767/deals/`. The local server proxies public API requests to
avoid the production API's localhost CORS restriction. Enable Chrome's WebMCP testing
flag as described in WEBMCP.md to check the native tools.

## Publish website assets

Commit and push the reviewed source first. With Python 3.10+, Git and Cloudflare
Wrangler authentication available, build an isolated upload directory:

```powershell
$pagesDir = py -3 scripts/build_pages.py
if ($LASTEXITCODE -ne 0) { throw "Website packaging failed" }
npx --yes wrangler pages deploy "$pagesDir" --project-name discounthub-website --branch main
```

The builder copies tracked website assets without modifying them. It excludes local
servers, tests, documentation and backups. Each run creates a new directory in
`dist/`. See WEBMCP.md for rollback and production verification.
