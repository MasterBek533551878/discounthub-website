(() => {
  'use strict';

  const API_BASE = 'https://api.discounthub.uz';
  const HISTORY_KEY = 'discounthub_ai_history';
  const SESSION_KEY = 'discounthub_ai_session_id';
  const MAX_HISTORY = 8;

  const form = document.getElementById('ai-form');
  const input = document.getElementById('ai-input');
  const send = document.getElementById('ai-send');
  const messages = document.getElementById('ai-messages');
  const suggestions = document.getElementById('ai-suggestions');
  const reset = document.getElementById('ai-reset');
  const status = document.getElementById('ai-status');
  if (!form || !input || !send || !messages || !suggestions || !status) return;

  let busy = false;
  let history = loadHistory();
  const sessionId = getSessionId();

  function loadHistory() {
    try {
      const value = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(value)
        ? value.filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').slice(-MAX_HISTORY)
        : [];
    } catch (_) {
      return [];
    }
  }

  function getSessionId() {
    try {
      const current = sessionStorage.getItem(SESSION_KEY);
      if (current) return current;
    } catch (_) {}
    const value = window.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try { sessionStorage.setItem(SESSION_KEY, value); } catch (_) {}
    return value;
  }

  function remember(role, content) {
    const clean = String(content || '').trim().slice(0, 500);
    if (!clean) return;
    history.push({ role, content: clean });
    history = history.slice(-MAX_HISTORY);
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
  }

  function setBusy(value) {
    busy = value;
    input.disabled = value;
    send.disabled = value;
    if (value) status.textContent = 'Searching current DiscountHub offers…';
  }

  function scrollBottom() {
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function addMessage(role, text) {
    const row = document.createElement('div');
    row.className = `ai-message ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    const paragraph = document.createElement('p');
    paragraph.textContent = String(text || '');
    bubble.appendChild(paragraph);
    row.appendChild(bubble);
    messages.appendChild(row);
    scrollBottom();
    return row;
  }

  function addLoading() {
    const row = document.createElement('div');
    row.className = 'ai-message assistant loading';
    const bubble = document.createElement('div');
    bubble.className = 'ai-bubble';
    bubble.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    row.appendChild(bubble);
    messages.appendChild(row);
    scrollBottom();
    return row;
  }

  function money(value, currency) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '';
    try {
      return new Intl.NumberFormat('en', {
        style: 'currency',
        currency: String(currency || 'USD').toUpperCase(),
        maximumFractionDigits: number >= 100 ? 0 : 2,
      }).format(number);
    } catch (_) {
      return `${number} ${currency || ''}`.trim();
    }
  }

  function kindLabel(kind) {
    if (kind === 'promotion') return 'Promo';
    if (kind === 'partner_offer') return 'Partner';
    return 'Deal';
  }

  function imageFor(item) {
    const frame = document.createElement('div');
    frame.className = 'ai-result-image';
    frame.textContent = item.kind === 'promotion' ? '#' : '%';
    if (!item.imageUrl) return frame;
    const image = document.createElement('img');
    image.src = item.imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => frame.replaceChildren(document.createTextNode('%')), { once: true });
    frame.replaceChildren(image);
    return frame;
  }

  function addResults(items) {
    if (!Array.isArray(items) || !items.length) return;
    const grid = document.createElement('div');
    grid.className = 'ai-result-grid';

    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'ai-result-card';
      card.appendChild(imageFor(item));

      const content = document.createElement('div');
      content.className = 'ai-result-content';
      const meta = document.createElement('div');
      meta.className = 'ai-result-meta';
      const kind = document.createElement('span');
      kind.className = 'ai-result-kind';
      kind.textContent = kindLabel(item.kind);
      meta.appendChild(kind);
      if (item.badge) {
        const badge = document.createElement('span');
        badge.className = 'ai-result-badge';
        badge.textContent = item.badge;
        meta.appendChild(badge);
      }
      content.appendChild(meta);

      const title = document.createElement('h3');
      title.textContent = item.title || 'DiscountHub offer';
      content.appendChild(title);
      const merchant = document.createElement('span');
      merchant.className = 'ai-result-merchant';
      merchant.textContent = item.merchant || 'DiscountHub';
      content.appendChild(merchant);

      const current = money(item.currentPrice, item.currency);
      const old = money(item.oldPrice, item.currency);
      if (current) {
        const price = document.createElement('div');
        const currentNode = document.createElement('span');
        currentNode.className = 'ai-result-price';
        currentNode.textContent = current;
        price.appendChild(currentNode);
        if (old && old !== current) {
          const oldNode = document.createElement('span');
          oldNode.className = 'ai-result-old';
          oldNode.textContent = old;
          price.appendChild(oldNode);
        }
        content.appendChild(price);
      }

      if (item.code) {
        const code = document.createElement('button');
        code.type = 'button';
        code.className = 'ai-result-code';
        code.textContent = item.code;
        code.title = 'Copy promo code';
        code.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(item.code);
            const original = code.textContent;
            code.textContent = 'Copied';
            setTimeout(() => { code.textContent = original; }, 1200);
          } catch (_) {}
        });
        content.appendChild(code);
      }

      const actions = document.createElement('div');
      actions.className = 'ai-result-actions';
      const open = document.createElement('a');
      open.href = item.clickUrl || item.pageUrl || '/deals/';
      open.target = '_blank';
      open.rel = 'noopener noreferrer';
      open.textContent = item.kind === 'promotion' && item.code ? 'Use code' : 'Open offer';
      actions.appendChild(open);
      if (item.pageUrl) {
        const details = document.createElement('a');
        details.href = item.pageUrl;
        details.textContent = 'Details';
        actions.appendChild(details);
      }
      content.appendChild(actions);
      card.appendChild(content);
      grid.appendChild(card);
    });

    messages.appendChild(grid);
    scrollBottom();
  }

  function renderSuggestions(items) {
    suggestions.replaceChildren();
    (Array.isArray(items) ? items : []).slice(0, 3).forEach((text) => {
      const value = String(text || '').trim();
      if (!value) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.prompt = value;
      button.textContent = value;
      suggestions.appendChild(button);
    });
  }

  function addManualSearch(message, row) {
    const link = document.createElement('a');
    link.className = 'ai-error-link';
    link.href = `/deals/?q=${encodeURIComponent(message)}`;
    link.textContent = 'Continue with normal DiscountHub search';
    row.querySelector('.ai-bubble')?.appendChild(link);
  }

  async function submit(raw) {
    const message = String(raw || '').trim();
    if (busy || message.length < 2) return;

    addMessage('user', message);
    input.value = '';
    resize();
    renderSuggestions([]);
    const requestHistory = history.slice(-MAX_HISTORY);
    remember('user', message);
    const loading = addLoading();
    setBusy(true);

    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: requestHistory, sessionId }),
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      loading.remove();

      if (!response.ok) {
        const text = typeof data.detail === 'string' ? data.detail : 'The assistant is temporarily unavailable.';
        addManualSearch(message, addMessage('assistant', text));
        return;
      }

      const reply = String(data.reply || 'Here are the closest current DiscountHub results.');
      addMessage('assistant', reply);
      remember('assistant', reply);
      addResults(data.items);
      renderSuggestions(data.suggestions);
      const remaining = Number(data.remainingRequests);
      status.textContent = Number.isFinite(remaining)
        ? `${remaining} anonymous AI requests remaining this hour`
        : 'Ready to search current offers';
    } catch (_) {
      loading.remove();
      addManualSearch(message, addMessage('assistant', 'I could not reach the assistant right now. You can continue with the normal DiscountHub search.'));
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  function resize() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(input.value);
  });
  input.addEventListener('input', resize);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-prompt]');
    if (button && !busy) submit(button.dataset.prompt);
  });
  reset?.addEventListener('click', () => {
    history = [];
    try { sessionStorage.removeItem(HISTORY_KEY); } catch (_) {}
    messages.replaceChildren();
    addMessage('assistant', 'New chat started. What would you like me to find?');
    renderSuggestions(['Tech deals under $50', 'Shopping promo codes', 'Lifetime partner offers']);
    status.textContent = 'Ready to search current offers';
    input.focus();
  });

  // Show the same context that will be sent to the assistant after navigating
  // away and back. Restoring text does not pretend to restore live offer cards.
  if (history.length) {
    messages.replaceChildren();
    history.forEach(({ role, content }) => addMessage(role, content));
    addMessage('assistant', 'Conversation restored. Ask a follow-up to refresh the offers.');
  }
  resize();
})();
