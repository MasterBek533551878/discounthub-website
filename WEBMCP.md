# DiscountHub WebMCP

The website exposes four read-only browser tools over the existing FastAPI API.
The Flutter application and backend remain together in `MasterBek533551878/discounthub`;
this integration belongs to the separate `discounthub-website` repository.

| Tool | Existing API | Meaning |
| --- | --- | --- |
| `search_deals` | `GET /deals` | Product discounts, ordered by DiscountHub score |
| `find_promo_codes` | `GET /promotions?type=coupon` | Supplied coupon codes; no checkout verification |
| `get_store_offers` | `GET /deals` and `GET /promotions` | A store's discounts and promotions, including partial-error reporting |
| `get_best_deals` | `GET /deals?sort=discount_desc` | Largest percentage discounts |

`get_store_offers` does not search the separate indie partner-offers catalogue.
Prices and budgets are USD. Omitted country means all markets, not delivery confirmation.
Keywords are literal catalogue search terms, not a semantic natural-language search.
`page` and `limit` paginate results (maximum 20 per collection).
Collections expose source totals, omitted rows, and `has_next_page`, so filtering an
expired or codeless page does not imply that subsequent pages are empty.

`webmcp.js` validates arguments, calls the existing API, normalizes camelCase/snake_case
responses, removes expired/future offers and codeless coupons, and returns only selected
public fields. It preserves merchant validity dates and source update times. Search
does not navigate merchant links or invoke click routes. `offer_url` uses the existing
DiscountHub click redirect only when opened. No OpenAI API key or additional model call
is required by this adapter.

`script.js` loads the module and displays the latest tool results using the same offer
cards as manual browsing. An older in-flight search cannot overwrite a newer search.
HTML script versions are updated so returning visitors receive the new loader.

## Native browser integration

Registration feature-detects `document.modelContext`, then the older
`navigator.modelContext`. It uses `registerTool` with registration abort signals and
handles asynchronous failures. Browsers without WebMCP retain normal manual browsing;
no polyfill claims to provide native discovery. Tools are registered on pages loading
the shared `script.js`, including `/`, `/deals/`, `/promo-codes/`, `/stores/` and store
pages. The separate `/ai/` page does not load that script; use `/deals/` for the demo.

References checked 2026-09-02:

- [Current WebMCP draft](https://webmachinelearning.github.io/webmcp/)
- [WebMCP design and examples](https://github.com/webmachinelearning/webmcp)

## Validation

Requires Node.js 22 or newer; no npm dependencies or build step.

```powershell
node --test tests/webmcp.test.mjs
node tests/webmcp-live.mjs
```

Local automated tests cover input limits, actual API parameter names, UTF-8, filtering,
pagination, mixed API results, malformed responses, timeouts, cancellation, request
ordering, output projection, and native/legacy registration behavior with test doubles.
The live command makes a few GET requests and prints counts. It does not prove native
WebMCP support and it does not test merchant checkout or outbound clicks.

The 15 tool tests pass. The user also ran the live API check successfully on Windows
at commit `fe9fe0e` on 2026-09-02: deals returned 3 of 4203, coupons 3 of 125,
store deals 3 of 499, and largest discounts 3 of 3758. The chosen store had no
promotions. The user's local Chrome preview subsequently loaded 24 of 4203 deals and
reported four registered native tools. On 2026-09-02, user-provided screenshots confirmed
native discovery with `getTools()` and successful `executeTool` calls for all four tools:

- `search_deals`: status `ok`, 3 deals at 20%+ discount, rendered in Your deal search.
- `get_store_offers` for AliExpress FR: status `ok`, 3 deals and 0 promotions.
- `get_best_deals`: status `ok`, 3 deals.
- `find_promo_codes`: status `ok`, 3 promotions with visible coupon codes and cards.

Chrome required JSON-string arguments as documented below. These checks establish
native browser execution and shared results in the local preview. An actual browser
agent session and verification on the production domain remain pending.

## Local preview with live data

The production API does not allow the user's `http://127.0.0.1:8767` origin. Use the
included Python server instead of `python -m http.server` for the local browser check:

```powershell
py -3 scripts/serve_webmcp.py
```

Requires Python 3.10+. Stop the previous server with Ctrl+C first, then open
`http://127.0.0.1:8767/deals/` and hard-refresh with Ctrl+Shift+R. This serves the
existing site, and rewrites the API origin only in the served copies of `script.js`
and `webmcp.js`. It proxies allowlisted public GET endpoints to
`https://api.discounthub.uz`, without forwarding browser cookies or credentials.
The source files and production API configuration are unchanged. The `/deals` API
path deliberately has no trailing slash; the website page is `/deals/`.

The server binds to loopback only. It rejects other origins, admin routes, writes,
hidden files and directory listings. Offer clicks redirect to the existing public
click route only when opened. This is a local development server, not a production
deployment or a WebMCP polyfill. The separate `/ai/` chat is outside this local check.

Seven local server tests cover static content, served-script rewriting, proxy routing,
query preservation, rejected requests, click behavior and upstream errors:

```powershell
py -3 -m unittest discover -s tests -p test_local_preview.py -v
```

## Browser check before release

Use a WebMCP-capable browser. In Chrome, open
`chrome://flags/#enable-webmcp-testing`, select **Enabled**, and click **Relaunch**.
See [Chrome's WebMCP setup](https://developer.chrome.com/docs/ai/webmcp).
Open the website preview at `/deals/`. In its developer console:

```javascript
await window.discountHubWebMcpReady
```

Expect `status: 'registered'` and the four tool names. `unsupported` means this browser
does not expose native WebMCP. `error` requires checking the console and script requests.

For the Chrome implementation that rejects object arguments with
`Failed to parse input arguments`, verify native discovery and execution using a
JSON string. Pass the tool object returned by `getTools()` as the first argument:

```javascript
await (async () => {
  await window.discountHubWebMcpReady;
  const mc = document.modelContext || navigator.modelContext;
  const available = await mc.getTools();
  const search = available.find(tool => tool.name === 'search_deals');
  if (!search) throw new Error('search_deals is not discoverable');
  return mc.executeTool(search, JSON.stringify({ min_discount: 20, limit: 3 }));
})();
```

The current specification instead takes an object and serializes it internally;
see [WebMCP issue #243](https://github.com/webmachinelearning/webmcp/issues/243).
For a browser that implements that revised signature, pass the plain object instead.
Do not retry arbitrary tool execution errors: the JSON-string workaround addresses
this specific argument parsing failure. A successful call should render **Your deal
search** with up to three offers at 20%+ discount and return their structured data.

Then ask the actual browser agent to find discounts on DiscountHub. Confirm its tool
trace contains `search_deals`, the returned offers match the page's new results section,
and manual search still works. Repeat for coupons and a store with live offers.
If using a legacy browser without `getTools`/`executeTool`, use its native WebMCP
inspection tooling and an actual agent call; an ordinary callback invocation is not
evidence of native discovery.

For API/UI diagnostics only, the exact same callback is accessible via:

```javascript
await window.discountHubWebMcpReady;
await window.discountHubWebMcp.tools.find(t => t.name === 'search_deals')
  .execute({ min_discount: 20, limit: 3 });
```

For the local browser check, use the included server above to avoid the CORS error.
For a separately hosted preview, check that preview origin against the server's CORS
allowlist. A successful Node request does not prove cross-origin browser access.

## Review and release

Keep the source changes in the website repository. Preserve local uncommitted work;
use a separate Git worktree when testing the draft branch. The main branch and public
deployment should only be updated after the live/native check above succeeds.
Back up the current website files before overwriting them. After review and merge,
use the existing Cloudflare Pages release process from the website directory:

```powershell
npx --yes wrangler pages deploy . --project-name discounthub-website
```

When deploying from a detached release worktree, explicitly add `--branch main` so
Wrangler targets the production branch. First record the current production deployment
with `npx --yes wrangler pages deployment list --project-name discounthub-website
--environment production`; that immutable deployment is the rollback copy. Keep local
backups outside the upload directory. `.cfignore` excludes development scripts, tests,
caches, documentation and backup files from the published static assets.

Verify the deployed `/webmcp.js`, the new `script.js?v=20260902-webmcp-v1` references,
native registration and the real search result. Roll back using the previous Cloudflare
Pages deployment if needed. No backend deployment or mobile build is required by the
API contract used here; a preview-specific CORS change, if necessary, is separate.

The user has made both existing repositories public and merged an MIT license into
each default branch. Use `MasterBek533551878/discounthub-website` for the website and
WebMCP source, and `MasterBek533551878/discounthub` for the Flutter application and
backend source. This change has not been deployed and no demo video or Devpost
submission has been completed.
