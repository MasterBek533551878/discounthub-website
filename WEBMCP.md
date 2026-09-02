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

At preparation time, 15 local tests passed. Live API access from the preparation
environment timed out; live API, CORS and native agent execution remain unverified.
Do not describe this as a completed agent demo until the following check passes.

## Browser check before release

Use a WebMCP-capable browser configured according to its documentation. Open the
website preview at `/deals/`. In its developer console:

```javascript
await window.discountHubWebMcpReady
```

Expect `status: 'registered'` and the four tool names. `unsupported` means this browser
does not expose native WebMCP. `error` requires checking the console and script requests.

On a browser implementing the current draft, verify native discovery and execution:

```javascript
const mc = document.modelContext || navigator.modelContext;
const available = await mc.getTools();
const search = available.find(tool => tool.name === 'search_deals');
if (!search) throw new Error('search_deals is not discoverable');
await mc.executeTool(search, { min_discount: 20, limit: 3 });
```

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

If a preview origin is blocked by API CORS, inspect the current server allowlist.
Authorize that specific preview origin through the existing backend configuration if
necessary; do not assume a successful Node request proves browser access.

## Review and release

Keep the source changes in the website repository. Preserve local uncommitted work;
use a separate Git worktree when testing the draft branch. The main branch and public
deployment should only be updated after the live/native check above succeeds.
Back up the current website files before overwriting them. After review and merge,
use the existing Cloudflare Pages release process from the website directory:

```powershell
npx --yes wrangler pages deploy . --project-name discounthub-website
```

Verify the deployed `/webmcp.js`, the new `script.js?v=20260902-webmcp-v1` references,
native registration and the real search result. Roll back using the previous Cloudflare
Pages deployment if needed. No backend deployment or mobile build is required by the
API contract used here; a preview-specific CORS change, if necessary, is separate.

For a later public hackathon source repository, extract the adapter, its tests, and
appropriate documentation after verification. Do not change the visibility of the
existing private repositories. This draft does not create that public repository,
record a video, or submit Devpost.
