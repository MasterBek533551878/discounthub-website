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

// v13: live homepage sections powered by the public DiscountHub API.
// The homepage stays curated, while full browsing lives on the web pages.
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
      <span>Open the web pages to browse the full DiscountHub feed.</span>
      <a href="/deals/">Browse web</a>
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

function shareDiscountHubUrl(type, id) {
  const path = type === 'promotion' ? '/promo-codes/' : '/deals/';
  const cleanId = String(id || '').trim();
  if (!cleanId) return path;
  const params = new URLSearchParams();
  params.set(type === 'promotion' ? 'promotion_id' : 'deal_id', cleanId);
  return `${path}?${params.toString()}`;
}

async function shareDiscountHubItem(button) {
  const relativeUrl = String(button?.dataset?.shareUrl || '').trim();
  if (!relativeUrl) return;

  const title = String(button.dataset.shareTitle || 'DiscountHub offer').trim();
  const url = new URL(relativeUrl, window.location.origin).href;
  const originalText = button.textContent;

  try {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    button.textContent = 'Link copied';
    button.classList.add('copied');
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('copied');
    }, 1800);
  } catch (error) {
    if (error?.name !== 'AbortError') {
      button.textContent = 'Copy failed';
      window.setTimeout(() => { button.textContent = originalText; }, 1800);
    }
  }
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
    const shareUrl = shareDiscountHubUrl('deal', id);

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
            <a href="${target}" target="_blank" rel="noopener noreferrer">View deal</a>
            <button class="share-offer-btn" type="button" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(title || 'DiscountHub deal')}">Share</button>
            <a class="ghost" href="/deals/">Browse more</a>
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
    const shareUrl = shareDiscountHubUrl('promotion', id);

    return `
      <article class="compact-offer">
        <div class="compact-icon">${code ? '#' : '%'}</div>
        <div>
          <span>${escapeHtml(store || type || 'Promo')}</span>
          <h4>${escapeHtml(title || discountText || 'Special promotion')}</h4>
          <p>${code ? `Code: <b>${escapeHtml(code)}</b>` : escapeHtml(discountText || 'Limited-time offer')}</p>
        </div>
        <div class="compact-actions">
          <a href="${target}" target="_blank" rel="noopener noreferrer" aria-label="Preview ${escapeHtml(title || 'promotion')}">Open</a>
          <button class="share-offer-btn" type="button" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(title || discountText || 'DiscountHub promotion')}">Share</button>
        </div>
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
        <strong>Partner offers are coming soon.</strong>
        <span>New founder and store discounts will appear here when they are available.</span>
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
    <a href="/deals/?platform=${encodeURIComponent(store.name)}" title="${escapeHtml(store.count)} offers on DiscountHub">
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


// v20260707: full web product pages powered by the public API.
const FULL_PAGE_SIZE = 24;
const fullBrowserState = {
  deals: { page: 1, hasNext: false, loading: false, params: {} },
  promotions: { page: 1, hasNext: false, loading: false, params: {} },
  partner: { page: 1, hasNext: false, loading: false, params: {} },
  stores: { all: [] },
};

function getQueryParams() {
  return new URLSearchParams(window.location.search || '');
}

function setFormFromUrl(form) {
  if (!form) return;
  const params = getQueryParams();
  Array.from(form.elements).forEach((el) => {
    if (!el.name || !params.has(el.name)) return;
    el.value = params.get(el.name) || '';
  });
}

function readFormParams(form) {
  const params = {};
  if (!form) return params;
  const data = new FormData(form);
  data.forEach((value, key) => {
    const clean = String(value || '').trim();
    if (clean) params[key] = clean;
  });
  return params;
}

function updateBrowserUrl(pathParams) {
  const params = new URLSearchParams();
  Object.entries(pathParams || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, '', next);
}

function optionMarkup(name, count) {
  const label = count ? `${name} (${count})` : name;
  return `<option value="${escapeHtml(name)}">${escapeHtml(label)}</option>`;
}

function populateFacetSelect(select, items) {
  if (!select || !Array.isArray(items)) return;
  const first = select.querySelector('option')?.outerHTML || '<option value="">All</option>';
  const values = [];
  const seen = new Set();
  items.forEach((item) => {
    const name = String(getField(item, 'name', 'name', '')).trim();
    const key = normalizeKey(name);
    const count = Number(getField(item, 'count', 'count', 0));
    if (!name || !key || seen.has(key) || count <= 0) return;
    seen.add(key);
    values.push({ name, count });
  });
  select.innerHTML = first + values.map((item) => optionMarkup(item.name, item.count)).join('');
}

function setStatus(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setLoadMore(id, visible, label) {
  const el = document.getElementById(id);
  if (!el) return;
  const shouldShow = Boolean(visible);
  el.hidden = !shouldShow;
  el.disabled = !shouldShow;
  el.style.display = shouldShow ? 'flex' : 'none';
  if (label) el.textContent = label;
}

function renderEmpty(container, title, text) {
  if (!container) return;
  container.innerHTML = `<div class="empty-state"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function discountLabel(discount) {
  const value = Number(discount);
  return Number.isFinite(value) && value > 0 ? `-${value}%` : 'Deal';
}

function dealCardMarkup(deal) {
  const id = getField(deal, 'id', 'id');
  const title = normalizeText(getField(deal, 'title', 'title'), 96);
  const description = normalizeText(getField(deal, 'description', 'description'), 120);
  const platform = normalizeText(getField(deal, 'platform', 'platform'), 34);
  const category = normalizeText(getField(deal, 'category', 'category'), 34);
  const imageUrl = getField(deal, 'imageUrl', 'image_url');
  const discount = Number(getField(deal, 'discountPercent', 'discount_percent', 0));
  const currency = getField(deal, 'currency', 'currency', 'USD');
  const currentPrice = formatMoney(getField(deal, 'currentPrice', 'current_price'), currency);
  const oldPrice = formatMoney(getField(deal, 'oldPrice', 'old_price'), currency);
  const target = clickUrl('deal', id);
  const shareUrl = shareDiscountHubUrl('deal', id);

  return `<article class="web-deal-card reveal visible">
    <div class="web-deal-image">
      ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();" />` : ''}
      <span class="image-fallback">%</span>
      <b class="discount-badge">${escapeHtml(discountLabel(discount))}</b>
    </div>
    <div class="web-deal-body">
      <div class="web-source"><span>${escapeHtml(platform || 'Online store')}</span>${category ? `<span>· ${escapeHtml(category)}</span>` : ''}</div>
      <h3>${escapeHtml(title || 'DiscountHub deal')}</h3>
      ${description ? `<p>${escapeHtml(description)}</p>` : ''}
      <div class="web-price-row">${currentPrice ? `<strong>${currentPrice}</strong>` : '<strong>Fresh offer</strong>'}${oldPrice ? `<span>${oldPrice}</span>` : ''}</div>
      <div class="web-actions">
        <a href="${target}" target="_blank" rel="noopener noreferrer">View deal</a>
        <button class="share-offer-btn ghost-link" type="button" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(title || 'DiscountHub deal')}">Share</button>
      </div>
    </div>
  </article>`;
}

function promoCardMarkup(promo) {
  const id = getField(promo, 'id', 'id');
  const title = normalizeText(getField(promo, 'title', 'title'), 100);
  const description = normalizeText(getField(promo, 'description', 'description'), 150);
  const store = normalizeText(getField(promo, 'store', 'store'), 44);
  const discountText = normalizeText(getField(promo, 'discountText', 'discount_text'), 90);
  const code = getField(promo, 'code', 'code');
  const type = getField(promo, 'type', 'type', 'sale');
  const target = clickUrl('promotion', id);
  const shareUrl = shareDiscountHubUrl('promotion', id);

  return `<article class="web-promo-card reveal visible">
    <div class="web-meta"><span>${escapeHtml(store || 'Store')}</span><span class="type-pill">${escapeHtml(String(type).replace('_', ' '))}</span></div>
    <h3>${escapeHtml(title || discountText || 'Store promotion')}</h3>
    <p>${escapeHtml(description || discountText || 'Open the store offer to view details.')}</p>
    <div class="web-actions">
      ${code ? `<span class="promo-code-pill">${escapeHtml(code)}</span><button class="copy-code-btn" type="button" data-copy-code="${escapeHtml(code)}">Copy code</button>` : ''}
      <a href="${target}" target="_blank" rel="noopener noreferrer">Open offer</a>
      <button class="share-offer-btn ghost-link" type="button" data-share-url="${escapeHtml(shareUrl)}" data-share-title="${escapeHtml(title || discountText || 'DiscountHub promotion')}">Share</button>
    </div>
  </article>`;
}

function formatPartnerDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  } catch (_) {
    return String(value).slice(0, 10);
  }
}

function partnerCardMarkup(offer) {
  const id = getField(offer, 'id', 'id');
  const title = normalizeText(getField(offer, 'title', 'title'), 100);
  const partnerName = normalizeText(getField(offer, 'partnerName', 'partner_name'), 44);
  const category = normalizeText(getField(offer, 'category', 'category'), 32);
  const subtitle = normalizeText(getField(offer, 'subtitle', 'subtitle'), 120);
  const offerText = normalizeText(getField(offer, 'offerText', 'offer_text'), 110);
  const currentPrice = normalizeText(getField(offer, 'currentPriceText', 'current_price_text'), 44);
  const originalPrice = normalizeText(getField(offer, 'originalPriceText', 'original_price_text'), 44);
  const code = getField(offer, 'code', 'code');
  const verified = Boolean(getField(offer, 'verified', 'verified', false));
  const imageUrl = String(getField(offer, 'imageUrl', 'image_url', '') || '').trim();
  const validUntil = formatPartnerDate(getField(offer, 'validUntil', 'valid_until', ''));
  const target = clickUrl('partner', id);

  const imageMarkup = imageUrl ? `
    <div class="web-partner-image">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title || partnerName || 'Partner offer')} banner" loading="lazy" />
    </div>
  ` : '';

  return `<article class="web-partner-card ${imageUrl ? 'has-partner-image' : ''} reveal visible">
    ${imageMarkup}
    <div class="web-partner-content">
      <div class="web-meta"><span>${escapeHtml(partnerName || 'Partner')}</span>${category ? `<span class="type-pill">${escapeHtml(category)}</span>` : ''}${verified ? '<span class="type-pill">Verified</span>' : ''}</div>
      <h3>${escapeHtml(title || 'Partner offer')}</h3>
      <p>${escapeHtml(subtitle || offerText || 'Open the partner offer to view details.')}</p>
      ${currentPrice || originalPrice ? `<div class="web-price-row">${currentPrice ? `<strong>${escapeHtml(currentPrice)}</strong>` : ''}${originalPrice ? `<span>${escapeHtml(originalPrice)}</span>` : ''}</div>` : ''}
      ${validUntil ? `<div class="partner-validity">Valid until ${escapeHtml(validUntil)}</div>` : ''}
      <div class="web-actions">
        ${code ? `<span class="promo-code-pill">${escapeHtml(code)}</span><button class="copy-code-btn" type="button" data-copy-code="${escapeHtml(code)}">Copy code</button>` : ''}
        <a href="${target}" target="_blank" rel="noopener noreferrer">Open offer</a>
      </div>
    </div>
  </article>`;
}

async function copyCodeValue(value, button) {
  try {
    await navigator.clipboard.writeText(String(value || ''));
    if (button) {
      const old = button.textContent;
      button.textContent = 'Copied';
      button.classList.add('copied-feedback');
      setTimeout(() => { button.textContent = old; button.classList.remove('copied-feedback'); }, 1400);
    }
  } catch (_) {
    if (button) button.textContent = 'Copy manually';
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  copyCodeValue(button.getAttribute('data-copy-code'), button);
});

async function initDealsBrowser() {
  const container = document.getElementById('deals-browser');
  const form = document.getElementById('deals-controls');
  if (!container || !form) return;
  const state = fullBrowserState.deals;
  const sharedDealId = String(getQueryParams().get('deal_id') || '').trim();

  setFormFromUrl(form);
  try {
    const facets = await fetchJson('/deals/facets', { currency: 'USD' });
    populateFacetSelect(document.getElementById('deal-platform-filter'), facets.marketplaces);
    populateFacetSelect(document.getElementById('deal-category-filter'), facets.categories);
    setFormFromUrl(form);
  } catch (_) {}

  async function load(reset = false) {
    if (state.loading) return;
    state.loading = true;
    if (reset) {
      state.page = 1;
      container.innerHTML = '';
      state.params = readFormParams(form);
      updateBrowserUrl(state.params);
    }
    setStatus('deals-status', state.page === 1 ? 'Loading deals…' : 'Loading more deals…');
    setLoadMore('deals-load-more', false);
    try {
      const data = await fetchJson('/deals', { ...state.params, currency: 'USD', page: state.page, page_size: FULL_PAGE_SIZE });
      const items = Array.isArray(data?.items) ? data.items : [];
      state.hasNext = Boolean(data?.hasNextPage ?? data?.has_next_page);
      if (state.page === 1 && !items.length) renderEmpty(container, 'No deals found', 'Try a different search, store or discount filter.');
      else container.insertAdjacentHTML('beforeend', items.map(dealCardMarkup).join(''));
      const total = Number(data?.total || 0);
      setStatus('deals-status', total ? `Showing ${Math.min(state.page * FULL_PAGE_SIZE, total)} of ${total} deals` : `${items.length} deals loaded`);
      setLoadMore('deals-load-more', state.hasNext, 'Load more deals');
      if (state.hasNext) state.page += 1;
    } catch (_) {
      renderEmpty(container, 'Deals are loading slowly', 'Please refresh the page or try again later.');
      setStatus('deals-status', 'Could not load deals right now.');
    } finally {
      state.loading = false;
    }
  }

  async function loadSharedDeal(id) {
    if (state.loading) return;
    state.loading = true;
    container.innerHTML = '';
    setStatus('deals-status', 'Loading shared deal…');
    setLoadMore('deals-load-more', false);
    try {
      const deal = await fetchJson(`/deals/${encodeURIComponent(id)}`, { currency: 'USD' });
      container.innerHTML = dealCardMarkup(deal);
      setStatus('deals-status', 'Showing shared deal');
    } catch (_) {
      renderEmpty(container, 'Deal not found', 'This shared deal may have expired or been removed.');
      setStatus('deals-status', 'Shared deal is unavailable.');
    } finally {
      state.loading = false;
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(true); });
  document.getElementById('deals-clear')?.addEventListener('click', () => { form.reset(); load(true); });
  document.getElementById('deals-load-more')?.addEventListener('click', () => { if (!state.loading && state.hasNext) load(false); });

  if (sharedDealId) await loadSharedDeal(sharedDealId);
  else load(true);
}

async function initPromotionsBrowser() {
  const container = document.getElementById('promotions-browser');
  const form = document.getElementById('promotions-controls');
  if (!container || !form) return;
  const state = fullBrowserState.promotions;
  const sharedPromotionId = String(getQueryParams().get('promotion_id') || '').trim();

  setFormFromUrl(form);
  try {
    const stores = await fetchJson('/promotions/stores');
    populateFacetSelect(document.getElementById('promotion-store-filter'), stores.items);
    setFormFromUrl(form);
  } catch (_) {}

  async function load(reset = false) {
    if (state.loading) return;
    state.loading = true;
    if (reset) {
      state.page = 1;
      container.innerHTML = '';
      state.params = readFormParams(form);
      updateBrowserUrl(state.params);
    }
    setStatus('promotions-status', state.page === 1 ? 'Loading promo codes…' : 'Loading more promotions…');
    setLoadMore('promotions-load-more', false);
    try {
      const data = await fetchJson('/promotions', { ...state.params, page: state.page, page_size: FULL_PAGE_SIZE });
      const items = Array.isArray(data?.items) ? data.items : [];
      state.hasNext = Boolean(data?.hasNextPage ?? data?.has_next_page);
      if (state.page === 1 && !items.length) renderEmpty(container, 'No promotions found', 'Try another search, store or promotion type.');
      else container.insertAdjacentHTML('beforeend', items.map(promoCardMarkup).join(''));
      const total = Number(data?.total || 0);
      setStatus('promotions-status', total ? `Showing ${Math.min(state.page * FULL_PAGE_SIZE, total)} of ${total} promotions` : `${items.length} promotions loaded`);
      setLoadMore('promotions-load-more', state.hasNext, 'Load more promotions');
      if (state.hasNext) state.page += 1;
    } catch (_) {
      renderEmpty(container, 'Promotions are loading slowly', 'Please refresh the page or try again later.');
      setStatus('promotions-status', 'Could not load promotions right now.');
    } finally {
      state.loading = false;
    }
  }

  async function loadSharedPromotion(id) {
    if (state.loading) return;
    state.loading = true;
    container.innerHTML = '';
    setStatus('promotions-status', 'Loading shared promotion…');
    setLoadMore('promotions-load-more', false);
    try {
      const promotion = await fetchJson(`/promotions/${encodeURIComponent(id)}`);
      container.innerHTML = promoCardMarkup(promotion);
      setStatus('promotions-status', 'Showing shared promotion');
    } catch (_) {
      renderEmpty(container, 'Promotion not found', 'This shared promotion may have expired or been removed.');
      setStatus('promotions-status', 'Shared promotion is unavailable.');
    } finally {
      state.loading = false;
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(true); });
  document.getElementById('promotions-clear')?.addEventListener('click', () => { form.reset(); load(true); });
  document.getElementById('promotions-load-more')?.addEventListener('click', () => { if (!state.loading && state.hasNext) load(false); });

  if (sharedPromotionId) await loadSharedPromotion(sharedPromotionId);
  else load(true);
}

async function initPartnerBrowser() {
  const container = document.getElementById('partner-browser');
  const form = document.getElementById('partner-controls');
  if (!container || !form) return;
  const state = fullBrowserState.partner;
  setFormFromUrl(form);
  try {
    const categories = await fetchJson('/partner-offers/categories');
    populateFacetSelect(document.getElementById('partner-category-filter'), categories.items);
    setFormFromUrl(form);
  } catch (_) {}

  async function load(reset = false) {
    if (state.loading) return;
    state.loading = true;
    if (reset) {
      state.page = 1;
      container.innerHTML = '';
      state.params = readFormParams(form);
      updateBrowserUrl(state.params);
    }
    setStatus('partner-status', state.page === 1 ? 'Loading partner offers…' : 'Loading more partner offers…');
    setLoadMore('partner-load-more', false);
    try {
      const data = await fetchJson('/partner-offers', { ...state.params, page: state.page, page_size: FULL_PAGE_SIZE });
      const items = Array.isArray(data?.items) ? data.items : [];
      state.hasNext = Boolean(data?.hasNextPage ?? data?.has_next_page);
      if (state.page === 1 && !items.length) renderEmpty(container, 'No partner offers yet', 'Submit early founder and store discounts through the contact page.');
      else container.insertAdjacentHTML('beforeend', items.map(partnerCardMarkup).join(''));
      const total = Number(data?.total || 0);
      setStatus('partner-status', total ? `Showing ${Math.min(state.page * FULL_PAGE_SIZE, total)} of ${total} partner offers` : `${items.length} partner offers loaded`);
      setLoadMore('partner-load-more', state.hasNext, 'Load more partner offers');
      if (state.hasNext) state.page += 1;
    } catch (_) {
      renderEmpty(container, 'Partner offers are loading slowly', 'Please refresh the page or submit an offer through the contact page.');
      setStatus('partner-status', 'Could not load partner offers right now.');
    } finally {
      state.loading = false;
    }
  }

  form.addEventListener('submit', (event) => { event.preventDefault(); load(true); });
  document.getElementById('partner-clear')?.addEventListener('click', () => { form.reset(); load(true); });
  document.getElementById('partner-load-more')?.addEventListener('click', () => { if (!state.loading && state.hasNext) load(false); });
  load(true);
}

function storeSlug(name) {
  return normalizeKey(name).replace(/\s+/g, '-');
}

function renderStoreDirectory(items, q = '') {
  const container = document.getElementById('stores-browser');
  if (!container) return;
  const query = normalizeKey(q);
  const filtered = (Array.isArray(items) ? items : []).filter((item) => !query || normalizeKey(item.name).includes(query));
  if (!filtered.length) {
    renderEmpty(container, 'No stores found', 'Try another store name.');
    return;
  }
  container.innerHTML = filtered.map((item) => {
    const name = item.name;
    const dealUrl = `/deals/?platform=${encodeURIComponent(name)}`;
    const promoUrl = `/promo-codes/?store=${encodeURIComponent(name)}`;
    return `<article class="store-directory-card reveal visible">
      <div class="web-meta"><span>Store</span><span class="type-pill">${escapeHtml(storeSlug(name))}</span></div>
      <h3>${escapeHtml(name)}</h3>
      <p>Open live product deals or store promotions from DiscountHub.</p>
      <div class="store-counts">
        <span class="count-pill">${Number(item.deals || 0)} deals</span>
        <span class="count-pill">${Number(item.promos || 0)} promos</span>
      </div>
      <div class="web-actions"><a href="${dealUrl}">Deals</a><a class="ghost-link" href="${promoUrl}">Promo codes</a></div>
    </article>`;
  }).join('');
}

async function initStoresBrowser() {
  const container = document.getElementById('stores-browser');
  const form = document.getElementById('stores-controls');
  if (!container || !form) return;
  setFormFromUrl(form);
  setStatus('stores-status', 'Loading stores…');
  try {
    const [dealFacets, promoStores] = await Promise.allSettled([
      fetchJson('/deals/facets', { currency: 'USD' }),
      fetchJson('/promotions/stores'),
    ]);
    const storeMap = new Map();
    function add(name, key, count) {
      const clean = String(name || '').trim();
      const mapKey = normalizeKey(clean);
      if (!clean || !mapKey) return;
      const item = storeMap.get(mapKey) || { name: clean, deals: 0, promos: 0 };
      item[key] += Number(count || 0);
      storeMap.set(mapKey, item);
    }
    if (dealFacets.status === 'fulfilled') {
      (dealFacets.value.marketplaces || []).forEach((item) => add(getField(item, 'name', 'name'), 'deals', getField(item, 'count', 'count', 0)));
    }
    if (promoStores.status === 'fulfilled') {
      (promoStores.value.items || []).forEach((item) => add(getField(item, 'name', 'name'), 'promos', getField(item, 'count', 'count', 0)));
    }
    fullBrowserState.stores.all = Array.from(storeMap.values()).sort((a, b) => (b.deals + b.promos) - (a.deals + a.promos));
    const q = readFormParams(form).q || '';
    renderStoreDirectory(fullBrowserState.stores.all, q);
    setStatus('stores-status', `${fullBrowserState.stores.all.length} stores available`);
  } catch (_) {
    renderEmpty(container, 'Stores are loading slowly', 'Please refresh the page or browse all deals instead.');
    setStatus('stores-status', 'Could not load stores right now.');
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const q = readFormParams(form).q || '';
    updateBrowserUrl(q ? { q } : {});
    renderStoreDirectory(fullBrowserState.stores.all, q);
  });
  document.getElementById('stores-clear')?.addEventListener('click', () => {
    form.reset();
    updateBrowserUrl({});
    renderStoreDirectory(fullBrowserState.stores.all, '');
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-share-url]');
  if (!button) return;
  shareDiscountHubItem(button);
});

function initFullWebPages() {
  initDealsBrowser();
  initPromotionsBrowser();
  initPartnerBrowser();
  initStoresBrowser();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFullWebPages);
} else {
  initFullWebPages();
}
