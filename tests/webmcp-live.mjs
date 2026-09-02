// Run from a machine with access to api.discounthub.uz. GET requests only.
// This checks live data, not native browser tool discovery.
import assert from 'node:assert/strict';
import { createTools } from '../webmcp.js';

const tools = createTools();
async function run(name, input) {
  const response = await tools.find(t => t.name === name).execute(input);
  const result = JSON.parse(response.content[0].text);
  assert.equal(result.status, 'ok', `${name}: ${JSON.stringify(result.errors)}`);
  for (const group of result.collections) {
    assert.ok(group.returned <= input.limit);
    for (const item of group.items) {
      assert.ok(item.id && item.title);
      if (group.kind === 'deals') assert.ok(item.current_price > 0 && item.discount_percent >= (input.min_discount ?? 1));
      if (name === 'find_promo_codes') assert.ok(item.code && item.type === 'coupon');
    }
    console.log(`${name}: ${group.kind}: ${group.returned} returned, source_total=${group.source_total}, next=${group.has_next_page}`);
  }
  return result;
}
try {
  const first = await run('search_deals', { limit: 3, min_discount: 1 });
  const store = first.collections[0].items[0]?.platform || 'eBay';
  await run('find_promo_codes', { limit: 3 });
  await run('get_store_offers', { store, limit: 3 });
  const best = await run('get_best_deals', { limit: 3, min_discount: 20 });
  const items = best.collections[0].items;
  assert.ok(items.every((item, index) => !index || items[index - 1].discount_percent >= item.discount_percent));
  if (!first.collections[0].items.length) console.log('NOTE: No live deal rows returned. Choose a populated query before recording the demo.');
  console.log('Live API checks passed. Native WebMCP discovery/call still needs the browser check in WEBMCP.md.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
