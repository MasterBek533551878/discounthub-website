const glow = document.querySelector('.cursor-glow');
const percentLayer = document.querySelector('.percent-layer');
let lastParticle = 0;

window.addEventListener('pointermove', (event) => {
  if (glow) {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }
  const now = performance.now();
  if (now - lastParticle > 115 && percentLayer && window.innerWidth > 700) {
    lastParticle = now;
    const p = document.createElement('span');
    p.className = 'percent-particle';
    p.textContent = '%';
    p.style.left = `${event.clientX}px`;
    p.style.top = `${event.clientY}px`;
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 44}px`);
    p.style.setProperty('--dy', `${-18 - Math.random() * 34}px`);
    percentLayer.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.14 });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

function addRipple(target, event) {
  if (!target || !event || typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;

  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height) * 1.85;

  ripple.className = 'ripple';
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  ripple.style.width = ripple.style.height = `${size}px`;

  target.classList.add('ripple-host');
  target.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
}

// Do not attach the click ripple to every plain <a> tag. Inline links and
// static-position anchors can place the absolute ripple in the wrong corner.
// Keep it only on real button/card elements that are safe ripple containers.
const rippleTargets = [
  '.store-btn',
  '.nav-cta',
  '.feature-card',
  '.seo-entry-card',
  '.seo-chip',
  '.panel-link',
  '.offer-action',
  '.live-tab',
  '.store-cloud span',
].join(',');

document.querySelectorAll(rippleTargets).forEach((el) => {
  el.addEventListener('click', (event) => addRipple(el, event));
});

document.querySelectorAll('.tilt-card').forEach((card) => {
  card.addEventListener('pointermove', (event) => {
    if (window.innerWidth < 760) return;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) translateY(-3px)`;
  });
  card.addEventListener('pointerleave', () => {
    card.style.transform = '';
  });
});

document.querySelectorAll('.magnetic').forEach((el) => {
  el.addEventListener('pointermove', (event) => {
    if (window.innerWidth < 760) return;
    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px)`;
  });
  el.addEventListener('pointerleave', () => {
    el.style.transform = '';
  });
});

// v13: live app-preview sections powered by the public DiscountHub API.
// The website intentionally shows only a small preview. The full browsing
// experience should remain inside the mobile app.
const DISCOUNTHUB_API_BASE_URL = 'https://api.discounthub.uz';
const APP_DOWNLOAD_ANCHOR = '#download';

const livePreviewState = {
  fetchedAt: null,
};

const DEAL_PREVIEW_LIMIT = 6;
const DEAL_PLATFORM_CANDIDATE_LIMIT = 14;
const DEALS_PER_PLATFORM_REQUEST = 3;
const DEAL_MIN_STRICT_DIVERSE_COUNT = 4;
const DEAL_CATEGORY_SLOT_REQUESTS = [
  {
    label: 'Computers',
    categoryMatches: ['computer', 'computers', 'computer office', 'laptop', 'pc', 'electronics'],
    queries: ['laptop', 'computer', 'keyboard', 'monitor', 'tablet', 'pc'],
  },
  {
    label: 'Home',
    categoryMatches: ['home', 'home garden', 'furniture', 'kitchen', 'garden', 'decor'],
    queries: ['furniture', 'home', 'kitchen', 'chair', 'lamp', 'garden'],
  },
];
const PROMO_PREVIEW_LIMIT = 5;
const PROMO_STORE_CANDIDATE_LIMIT = 14;
const PROMOS_PER_STORE_REQUEST = 2;
// Keep the website preview visually diverse. Facets can be dominated by one
// newly-synced store, so we seed known public platform names first and then
// add live facet names. Unknown/empty platforms simply return no items.
const DEAL_PLATFORM_PRIORITY = [
  'TTfone',
  'AliExpress',
  'eBay',
  'Myprotein',
  'Alibaba',
  'El Corte Ingles ES',
  'Geekbuying',
  'Kinguin',
  'Navimow FR',
  'Gardenista',
  'Ready Steady Bed',
];

const PROMO_STORE_PRIORITY = [
  'El Corte Ingles ES',
  'Alibaba US',
  'Alibaba UK',
  'Alibaba EU',
  'Geekbuying DE',
  'Geekbuying',
  'Navimow FR',
  'Gardenista',
  'Ready Steady Bed',
  'startriteshoes.com',
  'Kinguin UK',
  'AliExpress UK',
  'AliExpress PL',
];

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getField(item, camelName, snakeName, fallback = '') {
  if (!item || typeof item !== 'object') return fallback;
  const value = item[camelName] ?? item[snakeName];
  return value === null || value === undefined ? fallback : value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function stripHtml(value) {
  const div = document.createElement('div');
  div.innerHTML = String(value ?? '');
  return div.textContent || div.innerText || '';
}

function normalizeText(value, maxLength = 96) {
  const text = stripHtml(value).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function formatMoney(value, currency = 'USD') {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: String(currency || 'USD').toUpperCase(),
      maximumFractionDigits: number >= 100 ? 0 : 2,
    }).format(number);
  } catch (_) {
    return `${number.toFixed(number >= 100 ? 0 : 2)} ${escapeHtml(currency || '')}`.trim();
  }
}

function apiUrl(path, params = {}) {
  const url = new URL(path, DISCOUNTHUB_API_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchJson(path, params = {}) {
  const response = await fetch(apiUrl(path, params), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`API ${path} failed with ${response.status}`);
  }
  return response.json();
}

function showPreviewError(container, label) {
  if (!container) return;
  container.innerHTML = `
    <div class="preview-empty">
      <strong>${escapeHtml(label)} is loading slowly.</strong>
      <span>Download the app to browse the full DiscountHub feed.</span>
      <a href="${APP_DOWNLOAD_ANCHOR}">Get the app</a>
    </div>
  `;
}

function clickUrl(type, id) {
  const safeId = encodeURIComponent(String(id || '').trim());
  if (!safeId) return APP_DOWNLOAD_ANCHOR;
  if (type === 'promotion') return `${DISCOUNTHUB_API_BASE_URL}/promotions/${safeId}/click`;
  if (type === 'partner') return `${DISCOUNTHUB_API_BASE_URL}/partner-offers/${safeId}/click`;
  return `${DISCOUNTHUB_API_BASE_URL}/deals/${safeId}/click`;
}

function renderDealCards(items) {
  const container = document.getElementById('latest-deals');
  if (!container) return;
  const deals = Array.isArray(items) ? items.slice(0, DEAL_PREVIEW_LIMIT) : [];
  if (!deals.length) {
    showPreviewError(container, 'Deals preview');
    return;
  }

  container.innerHTML = deals.map((deal) => {
    const id = getField(deal, 'id', 'id');
    const title = normalizeText(getField(deal, 'title', 'title'), 84);
    const platform = normalizeText(getField(deal, 'platform', 'platform'), 28);
    const category = normalizeText(getField(deal, 'category', 'category'), 28);
    const imageUrl = getField(deal, 'imageUrl', 'image_url');
    const discount = Number(getField(deal, 'discountPercent', 'discount_percent', 0));
    const currency = getField(deal, 'currency', 'currency', 'USD');
    const currentPrice = formatMoney(getField(deal, 'currentPrice', 'current_price'), currency);
    const oldPrice = formatMoney(getField(deal, 'oldPrice', 'old_price'), currency);
    const target = clickUrl('deal', id);

    return `
      <article class="offer-card">
        <div class="offer-image-wrap">
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.offer-image-wrap').classList.add('image-failed'); this.remove();" />` : ''}
          <span class="image-fallback">%</span>
          ${discount > 0 ? `<b class="discount-badge">-${escapeHtml(discount)}%</b>` : '<b class="discount-badge soft">Deal</b>'}
        </div>
        <div class="offer-body">
          <span class="offer-source">${escapeHtml(platform || 'Online store')}${category ? ` · ${escapeHtml(category)}` : ''}</span>
          <h4>${escapeHtml(title || 'Fresh DiscountHub deal')}</h4>
          <div class="price-row">
            ${currentPrice ? `<strong>${currentPrice}</strong>` : '<strong>Fresh offer</strong>'}
            ${oldPrice ? `<span>${oldPrice}</span>` : ''}
          </div>
          <div class="offer-actions">
            <a href="${target}" target="_blank" rel="noopener noreferrer">Preview deal</a>
            <a class="ghost" href="${APP_DOWNLOAD_ANCHOR}">More in app</a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderPromotionCards(items) {
  const container = document.getElementById('featured-promotions');
  if (!container) return;
  const promotions = Array.isArray(items) ? items.slice(0, 5) : [];
  if (!promotions.length) {
    showPreviewError(container, 'Promo codes preview');
    return;
  }

  container.innerHTML = promotions.map((promo) => {
    const id = getField(promo, 'id', 'id');
    const title = normalizeText(getField(promo, 'title', 'title'), 72);
    const store = normalizeText(getField(promo, 'store', 'store'), 32);
    const discountText = normalizeText(getField(promo, 'discountText', 'discount_text'), 46);
    const code = getField(promo, 'code', 'code');
    const type = getField(promo, 'type', 'type', 'sale');
    const target = clickUrl('promotion', id);

    return `
      <article class="compact-offer">
        <div class="compact-icon">${code ? '#' : '%'}</div>
        <div>
          <span>${escapeHtml(store || type || 'Promo')}</span>
          <h4>${escapeHtml(title || discountText || 'Special promotion')}</h4>
          <p>${code ? `Code: <b>${escapeHtml(code)}</b>` : escapeHtml(discountText || 'Limited-time offer')}</p>
        </div>
        <a href="${target}" target="_blank" rel="noopener noreferrer" aria-label="Preview ${escapeHtml(title || 'promotion')}">Open</a>
      </article>
    `;
  }).join('');
}

function renderPartnerOfferCards(items) {
  const container = document.getElementById('partner-offers-preview');
  if (!container) return;
  const offers = Array.isArray(items) ? items.slice(0, 4) : [];
  if (!offers.length) {
    container.innerHTML = `
      <div class="preview-empty partner-empty">
        <strong>Partner offers are ready.</strong>
        <span>Add more founder discounts from the admin panel and this block will update automatically.</span>
        <a href="contact.html">Submit an offer</a>
      </div>
    `;
    return;
  }

  container.innerHTML = offers.map((offer) => {
    const id = getField(offer, 'id', 'id');
    const title = normalizeText(getField(offer, 'title', 'title'), 72);
    const partnerName = normalizeText(getField(offer, 'partnerName', 'partner_name'), 30);
    const offerText = normalizeText(getField(offer, 'offerText', 'offer_text'), 52);
    const code = getField(offer, 'code', 'code');
    const verified = Boolean(getField(offer, 'verified', 'verified', false));
    const target = clickUrl('partner', id);

    return `
      <article class="compact-offer partner-offer-item">
        <div class="compact-icon">${verified ? '✓' : '↗'}</div>
        <div>
          <span>${escapeHtml(partnerName || 'Partner offer')}</span>
          <h4>${escapeHtml(title || offerText || 'DiscountHub partner deal')}</h4>
          <p>${code ? `Code: <b>${escapeHtml(code)}</b>` : escapeHtml(offerText || 'Exclusive offer preview')}</p>
        </div>
        <a href="${target}" target="_blank" rel="noopener noreferrer" aria-label="Preview ${escapeHtml(title || 'partner offer')}">Open</a>
      </article>
    `;
  }).join('');
}

function renderStoreCloud(facets) {
  const container = document.getElementById('dynamic-store-cloud');
  if (!container) return;
  const marketplaces = Array.isArray(facets?.marketplaces) ? facets.marketplaces : [];
  const stores = marketplaces.slice(0, 14).map((item) => ({
    name: getField(item, 'name', 'name'),
    count: Number(getField(item, 'count', 'count', 0)),
  })).filter((item) => item.name);

  if (!stores.length) return;
  container.innerHTML = stores.map((store) => `
    <a href="#download" title="${escapeHtml(store.count)} live offers in the app">
      ${escapeHtml(store.name)} <small>${escapeHtml(store.count)}</small>
    </a>
  `).join('');
}

function dealStoreName(deal) {
  return normalizeText(
    getField(deal, 'platform', 'platform')
      || getField(deal, 'store', 'store')
      || getField(deal, 'storeName', 'store_name')
      || getField(deal, 'merchant', 'merchant'),
    80,
  );
}


function promotionStoreName(promotion) {
  return normalizeText(
    getField(promotion, 'store', 'store')
      || getField(promotion, 'platform', 'platform')
      || getField(promotion, 'storeName', 'store_name')
      || getField(promotion, 'merchant', 'merchant'),
    80,
  );
}


function itemId(item) {
  return String(getField(item, 'id', 'id', '')).trim();
}

function facetCategoryCandidates(facets, slot) {
  const categories = Array.isArray(facets?.categories) ? facets.categories : [];
  const matches = Array.isArray(slot?.categoryMatches) ? slot.categoryMatches.map(normalizeKey) : [];
  const seen = new Set();
  const candidates = [];

  categories.forEach((item) => {
    const name = String(getField(item, 'name', 'name', '')).trim();
    const count = Number(getField(item, 'count', 'count', 0));
    if (!name || count <= 0) return;
    const key = normalizeKey(name);
    if (!key || seen.has(key)) return;

    const isMatch = matches.some((match) => key.includes(match) || match.includes(key));
    if (!isMatch) return;

    seen.add(key);
    candidates.push(name);
  });

  return candidates.slice(0, 4);
}

async function fetchCategorySlot(slot, facets, existingItems = []) {
  const usedIds = new Set(existingItems.map(itemId).filter(Boolean));
  const usedStoreKeys = new Set(existingItems.map((item) => normalizeKey(dealStoreName(item))).filter(Boolean));
  const categoryCandidates = facetCategoryCandidates(facets, slot);

  const requests = [];
  categoryCandidates.forEach((category) => {
    requests.push(fetchJson('/deals', {
      page_size: 8,
      sort: 'discount_desc',
      currency: 'USD',
      category,
    }));
  });

  (Array.isArray(slot?.queries) ? slot.queries : []).forEach((q) => {
    requests.push(fetchJson('/deals', {
      page_size: 8,
      sort: 'score_desc',
      currency: 'USD',
      q,
    }));
  });

  const settled = await Promise.allSettled(requests);
  const candidates = [];
  settled.forEach((result) => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value?.items)) return;
    result.value.items.forEach((item) => {
      if (item) candidates.push(item);
    });
  });

  let choice = candidates.find((item) => {
    const id = itemId(item);
    const storeKey = normalizeKey(dealStoreName(item));
    return (!id || !usedIds.has(id)) && (!storeKey || !usedStoreKeys.has(storeKey));
  });

  if (!choice) {
    choice = candidates.find((item) => {
      const id = itemId(item);
      return !id || !usedIds.has(id);
    });
  }

  return choice || null;
}

async function fetchCategorySlotDeals(facets, existingItems = []) {
  const selected = [];
  const usedItems = Array.isArray(existingItems) ? [...existingItems] : [];

  for (const slot of DEAL_CATEGORY_SLOT_REQUESTS) {
    try {
      const choice = await fetchCategorySlot(slot, facets, [...usedItems, ...selected]);
      if (!choice) continue;
      selected.push(choice);
    } catch (_) {
      // Ignore one empty category slot. The preview will fall back to general items.
    }
  }

  return selected.slice(0, DEAL_CATEGORY_SLOT_REQUESTS.length);
}

function pickCategorySlotDeals(slotResults, existingItems = []) {
  const selected = [];
  const usedIds = new Set(existingItems.map(itemId).filter(Boolean));
  const usedStoreKeys = new Set(existingItems.map((item) => normalizeKey(dealStoreName(item))).filter(Boolean));

  (Array.isArray(slotResults) ? slotResults : []).forEach((slotResult) => {
    const items = Array.isArray(slotResult?.items) ? slotResult.items.filter(Boolean) : [];
    if (!items.length) return;

    let choice = items.find((item) => {
      const id = itemId(item);
      const storeKey = normalizeKey(dealStoreName(item));
      return (!id || !usedIds.has(id)) && (!storeKey || !usedStoreKeys.has(storeKey));
    });

    if (!choice) {
      choice = items.find((item) => {
        const id = itemId(item);
        return !id || !usedIds.has(id);
      });
    }

    if (!choice) return;
    const id = itemId(choice);
    const storeKey = normalizeKey(dealStoreName(choice));
    if (id) usedIds.add(id);
    if (storeKey) usedStoreKeys.add(storeKey);
    selected.push(choice);
  });

  return selected.slice(0, DEAL_CATEGORY_SLOT_REQUESTS.length);
}

function appendDealFillers(target, pool, limit) {
  const output = Array.isArray(target) ? [...target] : [];
  const usedIds = new Set(output.map(itemId).filter(Boolean));
  const storeCounts = new Map();

  output.forEach((item) => {
    const key = normalizeKey(dealStoreName(item));
    if (key) storeCounts.set(key, (storeCounts.get(key) || 0) + 1);
  });

  const candidates = Array.isArray(pool) ? pool.filter(Boolean) : [];
  const passes = [0, 1];

  passes.forEach((maxExistingCount) => {
    candidates.forEach((item) => {
      if (output.length >= limit) return;
      const id = itemId(item);
      if (id && usedIds.has(id)) return;
      const key = normalizeKey(dealStoreName(item));
      const count = key ? (storeCounts.get(key) || 0) : 0;
      if (key && count > maxExistingCount) return;
      output.push(item);
      if (id) usedIds.add(id);
      if (key) storeCounts.set(key, count + 1);
    });
  });

  return output.slice(0, limit);
}

function mergeDiverseByGroup(items, {
  limit,
  groupName,
  minStrictDiverseCount = limit,
}) {
  const pool = Array.isArray(items) ? items.filter(Boolean) : [];
  const strict = [];
  const strictIds = new Set();
  const strictGroups = new Set();

  pool.forEach((item) => {
    if (strict.length >= limit) return;
    const id = String(getField(item, 'id', 'id', '')).trim();
    if (id && strictIds.has(id)) return;

    const groupKey = normalizeKey(groupName(item));
    if (groupKey && strictGroups.has(groupKey)) return;

    strict.push(item);
    if (id) strictIds.add(id);
    if (groupKey) strictGroups.add(groupKey);
  });

  // For a public landing page, showing fewer diverse cards is better than
  // filling the preview with repeated products from one newly synced store.
  if (strict.length >= minStrictDiverseCount || strict.length >= limit) {
    return strict.slice(0, limit);
  }

  const relaxed = [...strict];
  const relaxedIds = new Set(strictIds);
  const groupCounts = new Map();
  strict.forEach((item) => {
    const key = normalizeKey(groupName(item));
    if (!key) return;
    groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
  });

  pool.forEach((item) => {
    if (relaxed.length >= limit) return;
    const id = String(getField(item, 'id', 'id', '')).trim();
    if (id && relaxedIds.has(id)) return;

    const key = normalizeKey(groupName(item));
    const count = groupCounts.get(key) || 0;
    if (key && count >= 2) return;

    relaxed.push(item);
    if (id) relaxedIds.add(id);
    if (key) groupCounts.set(key, count + 1);
  });

  return relaxed.slice(0, limit);
}

function mergeDiverseDeals(primaryItems, fallbackItems = [], limit = DEAL_PREVIEW_LIMIT) {
  return mergeDiverseByGroup(
    [
      ...(Array.isArray(primaryItems) ? primaryItems : []),
      ...(Array.isArray(fallbackItems) ? fallbackItems : []),
    ],
    {
      limit,
      groupName: dealStoreName,
      minStrictDiverseCount: DEAL_MIN_STRICT_DIVERSE_COUNT,
    },
  );
}

function mergeDiversePromotions(primaryItems, fallbackItems = [], limit = PROMO_PREVIEW_LIMIT) {
  return mergeDiverseByGroup(
    [
      ...(Array.isArray(primaryItems) ? primaryItems : []),
      ...(Array.isArray(fallbackItems) ? fallbackItems : []),
    ],
    {
      limit,
      groupName: promotionStoreName,
      minStrictDiverseCount: Math.min(3, limit),
    },
  );
}

function pushPlatformCandidate(candidates, seen, name) {
  const value = String(name || '').trim();
  const key = normalizeKey(value);
  if (!value || !key || seen.has(key)) return;
  seen.add(key);
  candidates.push(value);
}

function platformCandidatesFromFacets(facets) {
  const marketplaces = Array.isArray(facets?.marketplaces) ? facets.marketplaces : [];
  const seen = new Set();
  const candidates = [];

  DEAL_PLATFORM_PRIORITY.forEach((name) => pushPlatformCandidate(candidates, seen, name));

  marketplaces.forEach((item) => {
    const name = String(getField(item, 'name', 'name', '')).trim();
    const count = Number(getField(item, 'count', 'count', 0));
    if (count <= 0) return;
    pushPlatformCandidate(candidates, seen, name);
  });

  return candidates.slice(0, DEAL_PLATFORM_CANDIDATE_LIMIT);
}


function promoStoreCandidatesFromFacets(storeFacets) {
  const stores = Array.isArray(storeFacets?.items) ? storeFacets.items : [];
  const seen = new Set();
  const candidates = [];

  PROMO_STORE_PRIORITY.forEach((name) => pushPlatformCandidate(candidates, seen, name));

  stores.forEach((item) => {
    const name = String(getField(item, 'name', 'name', '')).trim();
    const count = Number(getField(item, 'count', 'count', 0));
    if (count <= 0) return;
    pushPlatformCandidate(candidates, seen, name);
  });

  return candidates.slice(0, PROMO_STORE_CANDIDATE_LIMIT);
}

async function fetchDiverseDeals(facets) {
  const platforms = platformCandidatesFromFacets(facets);
  const generalPromise = fetchJson('/deals', {
    page_size: 40,
    sort: 'newest',
    currency: 'USD',
  });
  let perStoreDeals = [];
  if (platforms.length) {
    const platformResults = await Promise.allSettled(platforms.map((platform) => fetchJson('/deals', {
      page_size: DEALS_PER_PLATFORM_REQUEST,
      sort: 'newest',
      currency: 'USD',
      platform,
    })));

    platformResults.forEach((result) => {
      if (result.status !== 'fulfilled' || !Array.isArray(result.value?.items)) return;
      result.value.items.forEach((deal) => perStoreDeals.push(deal));
    });
  }

  let generalItems = [];
  try {
    const general = await generalPromise;
    generalItems = Array.isArray(general?.items) ? general.items : [];
  } catch (_) {
    generalItems = [];
  }

  const coreLimit = Math.max(1, DEAL_PREVIEW_LIMIT - DEAL_CATEGORY_SLOT_REQUESTS.length);
  const coreDeals = mergeDiverseDeals(perStoreDeals, generalItems, coreLimit);
  const categoryDeals = await fetchCategorySlotDeals(facets, coreDeals);
  const selected = [...coreDeals, ...categoryDeals];

  if (selected.length >= DEAL_PREVIEW_LIMIT) {
    return selected.slice(0, DEAL_PREVIEW_LIMIT);
  }

  return appendDealFillers(selected, [...categoryDeals, ...perStoreDeals, ...generalItems], DEAL_PREVIEW_LIMIT);
}


async function fetchDiversePromotions(storeFacets) {
  const stores = promoStoreCandidatesFromFacets(storeFacets);
  const generalPromise = fetchJson('/promotions', {
    page_size: 30,
    sort: 'featured',
  });

  if (!stores.length) {
    const general = await generalPromise;
    return mergeDiversePromotions(general.items, [], PROMO_PREVIEW_LIMIT);
  }

  const storeResults = await Promise.allSettled(stores.map((store) => fetchJson('/promotions', {
    page_size: PROMOS_PER_STORE_REQUEST,
    sort: 'featured',
    store,
  })));

  const perStorePromotions = [];
  storeResults.forEach((result) => {
    if (result.status !== 'fulfilled' || !Array.isArray(result.value?.items)) return;
    result.value.items.forEach((promotion) => perStorePromotions.push(promotion));
  });

  let generalItems = [];
  try {
    const general = await generalPromise;
    generalItems = Array.isArray(general?.items) ? general.items : [];
  } catch (_) {
    generalItems = [];
  }

  return mergeDiversePromotions(perStorePromotions, generalItems, PROMO_PREVIEW_LIMIT);
}

function refreshRevealAnimations() {
  document.querySelectorAll('.reveal:not(.visible)').forEach((el) => observer.observe(el));
}

async function loadLivePreview() {
  const liveContainers = document.querySelectorAll('[data-live-list]');
  if (!liveContainers.length) return;

  try {
    const [facets, promotionStores, partnerOffers] = await Promise.allSettled([
      fetchJson('/deals/facets', { currency: 'USD' }),
      fetchJson('/promotions/stores'),
      fetchJson('/partner-offers', { page_size: 4, sort: 'featured' }),
    ]);

    const facetsValue = facets.status === 'fulfilled' ? facets.value : null;
    const promotionStoresValue = promotionStores.status === 'fulfilled' ? promotionStores.value : null;

    if (facetsValue) renderStoreCloud(facetsValue);

    try {
      const diverseDeals = await fetchDiverseDeals(facetsValue);
      renderDealCards(diverseDeals);
    } catch (_) {
      showPreviewError(document.getElementById('latest-deals'), 'Deals preview');
    }

    try {
      const diversePromotions = await fetchDiversePromotions(promotionStoresValue);
      renderPromotionCards(diversePromotions);
    } catch (_) {
      showPreviewError(document.getElementById('featured-promotions'), 'Promo codes preview');
    }

    if (partnerOffers.status === 'fulfilled') renderPartnerOfferCards(partnerOffers.value.items);
    else renderPartnerOfferCards([]);

    livePreviewState.fetchedAt = new Date();
    refreshRevealAnimations();
  } catch (_) {
    showPreviewError(document.getElementById('latest-deals'), 'Deals preview');
    showPreviewError(document.getElementById('featured-promotions'), 'Promo codes preview');
    renderPartnerOfferCards([]);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadLivePreview);
} else {
  loadLivePreview();
}
