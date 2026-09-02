import test from 'node:test';
import assert from 'node:assert/strict';
import { createTools, detectContext, registerTools } from '../webmcp.js';

const NOW = Date.parse('2026-09-02T12:00:00Z');
const deal = { id: 'awin:1', title: 'Headphones', platform: 'eBay', currentPrice: 50, oldPrice: 100, currency: 'USD', discountPercent: 50, updatedAt: '2026-09-02T10:00:00Z', expiresAt: null };
const coupon = { id: 'promo:1', title: 'Store coupon', store: 'AliExpress', type: 'coupon', code: 'SAVE10', validUntil: '2026-09-05T00:00:00Z' };
const page = (items, extra = {}) => ({ items, total: items.length, hasNextPage: false, ...extra });
const ok = (data) => ({ ok: true, json: async () => data });
const unpack = response => JSON.parse(response.content[0].text);
const tool = (name, options) => createTools({ now: () => NOW, ...options }).find(t => t.name === name);

test('search uses actual API filters, preserves UTF-8, encodes inputs and never opens a click route', async () => {
  const calls = [];
  const response = await tool('search_deals', { fetchImpl: async (url, options) => { calls.push([new URL(url), options]); return ok(page([deal])); } }).execute({ query: 'наушники & audio', store: 'eBay', min_discount: 20, max_price: 60, country: 'uz', limit: 3, page: 2 });
  const data = unpack(response);
  const [url, options] = calls[0];
  assert.equal(calls.length, 1);
  assert.equal(url.origin, 'https://api.discounthub.uz');
  assert.equal(url.pathname, '/deals');
  assert.equal(url.searchParams.get('q'), 'наушники & audio');
  assert.equal(url.searchParams.get('platform'), 'eBay');
  assert.equal(url.searchParams.get('min_discount'), '20');
  assert.equal(url.searchParams.get('max_price'), '60');
  assert.equal(url.searchParams.get('country'), 'UZ');
  assert.equal(url.searchParams.get('page_size'), '3');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(url.searchParams.get('currency'), 'USD');
  assert.equal(options.credentials, 'omit');
  assert.equal(data.collections[0].items[0].current_price, 50);
  assert.equal(data.collections[0].items[0].offer_url, 'https://api.discounthub.uz/deals/awin%3A1/click');
});

test('invalid inputs fail before network, including injected URLs and wrong types', async () => {
  let calls = 0;
  const t = tool('search_deals', { fetchImpl: async () => { calls++; return ok(page([])); } });
  for (const input of [null, [], { url: 'https://example.com' }, { limit: 21 }, { limit: 1.5 }, { min_discount: 0 }, { min_discount: 101 }, { max_price: 0 }, { max_price: Infinity }, { country: 'USA' }, { query: '' }, { query: 'x'.repeat(201) }, { page: '2' }]) {
    const response = await t.execute(input);
    assert.equal(response.isError, true);
    assert.equal(unpack(response).errors[0].code, 'invalid_input');
  }
  assert.equal(calls, 0);
});

test('store offers requires a store', async () => {
  const response = await tool('get_store_offers', { fetchImpl: () => assert.fail('network called') }).execute({});
  assert.equal(unpack(response).errors[0].code, 'invalid_input');
});

test('best deals uses server discount order and minimum real discount', async () => {
  await tool('get_best_deals', { fetchImpl: async raw => { const url = new URL(raw); assert.equal(url.searchParams.get('sort'), 'discount_desc'); assert.equal(url.searchParams.get('min_discount'), '1'); return ok(page([deal])); } }).execute({ category: 'Electronics' });
});

test('expired, future and malformed validity windows are excluded; pagination remains usable', async () => {
  const items = [coupon, { ...coupon, id: 'old', validUntil: '2026-09-01' }, { ...coupon, id: 'future', validFrom: '2026-10-01' }, { ...coupon, id: 'bad', validUntil: 'not a date' }, { ...coupon, id: 'empty', code: ' ' }, { ...coupon, id: 'sale', type: 'sale' }];
  const data = unpack(await tool('find_promo_codes', { fetchImpl: async raw => { assert.equal(new URL(raw).searchParams.get('type'), 'coupon'); return ok(page(items, { total: 100, hasNextPage: true })); } }).execute({ limit: 10 }));
  assert.deepEqual(data.collections[0].items.map(x => x.id), ['promo:1']);
  assert.equal(data.collections[0].omitted_on_page, 5);
  assert.equal(data.collections[0].source_total, 100);
  assert.equal(data.collections[0].has_next_page, true);
});

test('snake_case data and zero results are handled without fabricated offers', async () => {
  const snake = { id: 'x', title: 'A deal', current_price: 10, discount_percent: 20, expires_at: '2026-10-01' };
  const data = unpack(await tool('search_deals', { fetchImpl: async () => ok(page([snake, { ...snake, id: 'no-discount', discount_percent: 0 }, { ...snake, id: 'expired', expires_at: '2026-09-01' }])) }).execute());
  assert.deepEqual(data.collections[0].items.map(x => x.id), ['x']);
  const empty = unpack(await tool('search_deals', { fetchImpl: async () => ok(page([])) }).execute({ query: 'nonexistent' }));
  assert.equal(empty.status, 'ok');
  assert.deepEqual(empty.collections[0].items, []);
});

test('combined store search returns partial results when one endpoint fails', async () => {
  const response = await tool('get_store_offers', { fetchImpl: async raw => new URL(raw).pathname === '/deals' ? ok(page([deal])) : { ok: false, status: 503 } }).execute({ store: 'eBay' });
  const data = unpack(response);
  assert.equal(data.status, 'partial');
  assert.equal(data.collections.length, 1);
  assert.equal(data.errors[0].kind, 'promotions');
  assert.equal(response.isError, undefined);
});

test('both store collections failing is an error, not an empty successful search', async () => {
  const response = await tool('get_store_offers', { fetchImpl: async () => { throw new TypeError('fetch failed'); } }).execute({ store: 'eBay' });
  assert.equal(response.isError, true);
  assert.equal(unpack(response).status, 'error');
  assert.equal(unpack(response).errors.length, 2);
});

test('malformed API response is an explicit error', async () => {
  for (const data of [{ detail: 'maintenance' }, { items: [null], total: 1 }, { items: [], total: '0' }]) {
    const response = await tool('search_deals', { fetchImpl: async () => ok(data) }).execute();
    assert.equal(unpack(response).errors[0].code, 'invalid_response');
  }
});

test('timeouts abort requests and report timeout', async () => {
  const response = await tool('search_deals', { timeoutMs: 5, fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }).execute();
  assert.equal(unpack(response).errors[0].code, 'timeout');
});

test('pre-cancelled and in-flight calls respect browser cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  const response = await tool('search_deals', { fetchImpl: () => assert.fail('network called') }).execute({}, { signal: controller.signal });
  assert.equal(unpack(response).errors[0].code, 'cancelled');
  const live = new AbortController();
  const pending = tool('search_deals', { fetchImpl: async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) }).execute({}, { signal: live.signal });
  live.abort();
  assert.equal(unpack(await pending).errors[0].code, 'cancelled');
});

test('older searches cannot replace the newest visible results', async () => {
  let finishOld;
  const shown = [];
  const tools = createTools({ now: () => NOW, onResult: data => shown.push(data.tool), fetchImpl: async raw => new URL(raw).searchParams.get('q') === 'old' ? new Promise(resolve => { finishOld = () => resolve(ok(page([deal]))); }) : ok(page([deal])) });
  const older = tools[0].execute({ query: 'old' });
  await tools[3].execute({ query: 'new' });
  finishOld();
  await older;
  assert.deepEqual(shown, ['get_best_deals']);
});

test('unsafe image URLs and arbitrary provider fields are excluded', async () => {
  const data = unpack(await tool('search_deals', { fetchImpl: async () => ok(page([{ ...deal, imageUrl: 'javascript:alert(1)', privateField: 'hidden', affiliateUrl: 'https://example.com' }])) }).execute());
  const result = data.collections[0].items[0];
  assert.equal(result.image_url, null);
  assert.equal(result.privateField, undefined);
  assert.equal(result.affiliateUrl, undefined);
});

test('native current/legacy detection and idempotent registration', async () => {
  const seen = [];
  const current = { registerTool: async (tool, options) => { assert.ok(options.signal); seen.push(tool); } };
  const legacy = { registerTool() {} };
  assert.equal(detectContext({ modelContext: current }, { modelContext: legacy }), current);
  assert.equal(detectContext({}, { modelContext: legacy }), legacy);
  assert.equal((await registerTools(undefined, [])).status, 'unsupported');
  const tools = createTools();
  const results = await Promise.all([registerTools(current, tools), registerTools(current, tools)]);
  assert.equal(results[0].status, 'registered');
  assert.equal(seen.length, 4);
  assert.ok(seen.every(t => t.annotations.readOnlyHint && t.annotations.untrustedContentHint));
});

test('failed registration rolls back only owned tools', async () => {
  const removed = [];
  let count = 0;
  const context = { registerTool() { if (++count === 2) throw new Error('duplicate'); }, unregisterTool(name) { removed.push(name); } };
  const result = await registerTools(context, createTools());
  assert.equal(result.status, 'error');
  assert.deepEqual(removed, ['search_deals']);
});
