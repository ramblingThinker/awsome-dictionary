const DEFAULT_SETTINGS = {
  bubbleTimeoutMs: 10000,
  autoCloseOnSelectionClear: true,
  autoCloseOnInteraction: true
};

document.addEventListener('dblclick', handleSelection);
document.addEventListener('mouseup', handleMouseSelection);
document.addEventListener('selectionchange', handleSelectionChange);
document.addEventListener('scroll', handleUserInteraction, true);
document.addEventListener('wheel', handleUserInteraction, { passive: true });
document.addEventListener('touchmove', handleUserInteraction, { passive: true });
document.addEventListener('keydown', handleKeydown, true);
document.addEventListener('mousedown', handlePointerInteraction, true);
window.addEventListener('resize', handleUserInteraction);

let selectionX, selectionY;  // Capture position
let removeBubbleTimer = null;
let styleInjected = false;
let settings = { ...DEFAULT_SETTINGS };
let lastLookupKey = "";
let lastLookupAt = 0;

initializeSettings();

function handleSelection(e) {
  const text = window.getSelection().toString().trim();
  triggerLookup(text, e.pageX, e.pageY, { showLoading: true });
}

function handleMouseSelection(e) {
  const text = window.getSelection()?.toString().trim();
  if (isEventInsideBubble(e) || isEditableTarget(e.target)) {
    return;
  }
  triggerLookup(text, e.pageX, e.pageY, { showLoading: false });
}

function triggerLookup(text, pageX, pageY, options = {}) {
  const normalized = String(text || "").trim();
  if (!normalized || normalized.length >= 50) {
    return;
  }

  const now = Date.now();
  const lookupKey = normalized.toLowerCase();
  if (lookupKey === lastLookupKey && now - lastLookupAt < 450) {
    return;
  }
  lastLookupKey = lookupKey;
  lastLookupAt = now;

  selectionX = pageX;
  selectionY = pageY;
  if (options.showLoading) {
    showBubble('Loading...', 0, true);
  }
  browser.runtime.sendMessage({ action: 'define', word: normalized });
}

function handleSelectionChange() {
  if (!settings.autoCloseOnSelectionClear) {
    return;
  }
  const text = window.getSelection()?.toString().trim();
  if (!text) {
    removeBubble();
  }
}

function handleUserInteraction() {
  if (!settings.autoCloseOnInteraction) {
    return;
  }
  removeBubble();
}

function handleKeydown(event) {
  if (event.key === 'Escape') {
    removeBubble();
    return;
  }
  handleUserInteraction();
}

function handlePointerInteraction(event) {
  if (!settings.autoCloseOnInteraction) {
    return;
  }
  const bubble = document.getElementById('dict-bubble');
  if (!bubble) {
    return;
  }
  if (!bubble.contains(event.target)) {
    removeBubble();
  }
}

function isEventInsideBubble(event) {
  const bubble = document.getElementById('dict-bubble');
  return Boolean(bubble && event?.target && bubble.contains(event.target));
}

function isEditableTarget(target) {
  if (!target || !(target instanceof window.Element)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return Boolean(target.closest('[contenteditable=""], [contenteditable="true"]'));
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'show_definition') {
    const selection = window.getSelection();
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect?.width || rect?.height) {
        selectionX = rect.left + window.scrollX;
        selectionY = rect.bottom + window.scrollY;
      }
    }

    if (typeof selectionX !== 'number' || typeof selectionY !== 'number') {
      selectionX = window.scrollX + 20;
      selectionY = window.scrollY + 20;
    }

    showBubble(msg.definition, getBubbleTimeoutMs(), false, {
      source: msg.source,
      cacheAgeMinutes: msg.cacheAgeMinutes
    });
  }
});

function showBubble(definition, timeout, isLoading = false, meta = {}) {
  injectStylesOnce();

  let bubble = document.getElementById('dict-bubble');
  if (bubble && !isLoading) {
    renderBubbleContent(bubble, definition, meta);
    positionBubble(bubble);
    scheduleBubbleRemoval(bubble, timeout);
    return;
  }

  if (bubble) bubble.remove();
  
  bubble = document.createElement('div');
  bubble.id = 'dict-bubble';
  bubble.className = 'dict-bubble';
  bubble.tabIndex = -1;
  renderBubbleContent(bubble, definition, meta);
  document.body.appendChild(bubble);
  positionBubble(bubble);
  announceBubbleStatus(meta);

  scheduleBubbleRemoval(bubble, timeout);
}

function renderBubbleContent(bubble, definition, meta = {}) {
  bubble.textContent = '';

  const header = document.createElement('div');
  header.className = 'dict-header';

  const brand = document.createElement('span');
  brand.className = 'dict-brand';
  brand.textContent = 'Dictionary';

  if (meta.source === 'cache') {
    const badge = document.createElement('span');
    badge.className = 'dict-badge dict-badge-cache';
    const mins = Number(meta.cacheAgeMinutes || 0);
    badge.textContent = mins > 0 ? `Offline cache • ${mins}m` : 'Offline cache';
    brand.appendChild(badge);
  } else if (meta.source === 'unavailable') {
    const badge = document.createElement('span');
    badge.className = 'dict-badge dict-badge-unavailable';
    badge.textContent = 'Network unavailable';
    brand.appendChild(badge);
  }

  const actions = document.createElement('div');
  actions.className = 'dict-actions';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'dict-close';
  closeBtn.type = 'button';
  closeBtn.title = 'Close';
  closeBtn.setAttribute('aria-label', 'Close definition');
  closeBtn.textContent = '×';
  closeBtn.onclick = (event) => {
    event.stopPropagation();
    removeBubble();
  };
  actions.appendChild(closeBtn);

  header.appendChild(brand);
  header.appendChild(actions);

  const content = document.createElement('div');
  content.className = 'dict-content';
  content.appendChild(buildDefinitionLayout(definition));

  bubble.appendChild(header);
  bubble.appendChild(content);
}

function buildDefinitionLayout(definition) {
  const fragment = document.createDocumentFragment();
  const lines = splitDefinitionLines(definition);

  if (!lines.length) {
    const empty = document.createElement('p');
    empty.className = 'dict-empty';
    empty.textContent = 'No definition available.';
    fragment.appendChild(empty);
    return fragment;
  }

  const title = document.createElement('h3');
  title.className = 'dict-word';
  title.textContent = lines[0];
  fragment.appendChild(title);

  let index = 1;
  if (lines[index] && /^\/.+\/$/.test(lines[index])) {
    const phonetic = document.createElement('p');
    phonetic.className = 'dict-phonetic';
    phonetic.textContent = lines[index];
    fragment.appendChild(phonetic);
    index += 1;
  }

  const bodyLines = lines.slice(index);
  if (!bodyLines.length) {
    return fragment;
  }

  let block = null;
  for (const line of bodyLines) {
    if (line.startsWith('• ')) {
      block = createMeaningBlock(line.slice(2));
      fragment.appendChild(block);
      continue;
    }

    if (!block) {
      block = createMeaningBlock('DETAILS');
      fragment.appendChild(block);
    }

    if (/^Synonyms:\s*/i.test(line)) {
      appendTagLine(block, 'synonyms', line.replace(/^Synonyms:\s*/i, ''));
      continue;
    }

    if (/^Antonyms:\s*/i.test(line)) {
      appendTagLine(block, 'antonyms', line.replace(/^Antonyms:\s*/i, ''));
      continue;
    }

    if (/^".+"$/.test(line)) {
      const quote = document.createElement('p');
      quote.className = 'dict-example';
      quote.textContent = line;
      block.querySelector('.dict-meaning-body').appendChild(quote);
      continue;
    }

    const text = document.createElement('p');
    text.className = 'dict-definition';
    text.textContent = line;
    block.querySelector('.dict-meaning-body').appendChild(text);
  }

  return fragment;
}

function splitDefinitionLines(definition) {
  const rawLines = String(definition || '').split(/(?:\r?\n|<br\s*\/?>)/gi);
  return rawLines
    .map((line) => decodeHtmlEntities(line.trim()))
    .filter(Boolean);
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|#39|nbsp);/g, (entity, code) => {
    switch (code.toLowerCase()) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
      case '#39':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        if (code[0] === '#') {
          const isHex = code[1].toLowerCase() === 'x';
          const numeric = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
          if (!Number.isNaN(numeric)) {
            return String.fromCodePoint(numeric);
          }
        }
        return entity;
    }
  });
}

function createMeaningBlock(partOfSpeech) {
  const section = document.createElement('section');
  section.className = 'dict-meaning';

  const pos = document.createElement('div');
  pos.className = 'dict-pos';
  pos.textContent = partOfSpeech;

  const body = document.createElement('div');
  body.className = 'dict-meaning-body';

  section.appendChild(pos);
  section.appendChild(body);
  return section;
}

function appendTagLine(block, label, csvValues) {
  const values = csvValues.split(',').map((item) => item.trim()).filter(Boolean);
  if (!values.length) {
    return;
  }

  const row = document.createElement('div');
  row.className = 'dict-tags-row';

  const heading = document.createElement('span');
  heading.className = 'dict-tags-label';
  heading.textContent = label;
  row.appendChild(heading);

  const tags = document.createElement('div');
  tags.className = 'dict-tags';
  for (const value of values.slice(0, 6)) {
    const tag = document.createElement('span');
    tag.className = 'dict-tag';
    tag.textContent = value;
    tags.appendChild(tag);
  }
  row.appendChild(tags);

  block.querySelector('.dict-meaning-body').appendChild(row);
}

function positionBubble(bubble) {
  const gap = 12;
  const viewportPadding = 16;
  const initialLeft = selectionX - window.scrollX;
  const initialTop = selectionY - window.scrollY + gap;

  const rect = bubble.getBoundingClientRect();
  let left = initialLeft;
  let top = initialTop;

  if (left + rect.width > window.innerWidth - viewportPadding) {
    left = Math.max(viewportPadding, initialLeft - rect.width - gap);
  }
  if (top + rect.height > window.innerHeight - viewportPadding) {
    top = Math.max(viewportPadding, initialTop - rect.height - (gap * 2));
  }

  left = Math.max(viewportPadding, left);
  top = Math.max(viewportPadding, top);

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
}

function scheduleBubbleRemoval(bubble, timeout) {
  if (removeBubbleTimer) {
    clearTimeout(removeBubbleTimer);
    removeBubbleTimer = null;
  }
  if (timeout > 0) {
    removeBubbleTimer = setTimeout(() => {
      if (bubble?.isConnected) {
        bubble.remove();
      }
      removeBubbleTimer = null;
    }, timeout);
  }
}

function removeBubble() {
  const bubble = document.getElementById('dict-bubble');
  if (bubble) {
    bubble.remove();
  }
  if (removeBubbleTimer) {
    clearTimeout(removeBubbleTimer);
    removeBubbleTimer = null;
  }
}

function announceBubbleStatus(meta) {
  const region = getLiveRegion();
  if (meta.source === 'cache') {
    region.textContent = 'Showing cached definition.';
    return;
  }
  if (meta.source === 'unavailable') {
    region.textContent = 'Network unavailable for dictionary lookup.';
    return;
  }
  region.textContent = 'Definition loaded.';
}

function getLiveRegion() {
  let region = document.getElementById('dict-live-region');
  if (region) {
    return region;
  }
  region = document.createElement('div');
  region.id = 'dict-live-region';
  region.className = 'dict-sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

function getBubbleTimeoutMs() {
  const numeric = Number(settings.bubbleTimeoutMs);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.bubbleTimeoutMs;
  }
  return Math.max(0, Math.min(60000, Math.floor(numeric)));
}

async function initializeSettings() {
  try {
    const result = await browser.storage.local.get("settings");
    settings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.settings) {
      return;
    }
    settings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
  });
}

function injectStylesOnce() {
  if (styleInjected) {
    return;
  }
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .dict-bubble {
      position: fixed;
      z-index: 2147483646;
      width: min(430px, calc(100vw - 32px));
      max-height: min(56vh, 480px);
      border-radius: 16px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      background:
        radial-gradient(circle at top right, rgba(12, 180, 206, 0.16), transparent 44%),
        linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow:
        0 24px 50px rgba(2, 8, 23, 0.24),
        0 8px 16px rgba(2, 8, 23, 0.12);
      color: #0f172a;
      overflow: hidden;
      pointer-events: auto;
      animation: fadeIn 0.2s ease-out;
      backdrop-filter: blur(4px);
      font: 14px/1.65 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .dict-bubble:focus-visible {
      outline: 3px solid rgba(14, 165, 164, 0.42);
      outline-offset: 2px;
    }
    .dict-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.09);
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(245, 248, 255, 0.86));
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .dict-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0a6f7f;
    }
    .dict-badge {
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10px;
      letter-spacing: 0.02em;
      text-transform: none;
      font-weight: 700;
    }
    .dict-badge-cache {
      background: rgba(234, 179, 8, 0.16);
      color: #854d0e;
    }
    .dict-badge-unavailable {
      background: rgba(239, 68, 68, 0.14);
      color: #991b1b;
    }
    .dict-actions {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .dict-content {
      padding: 14px 16px 16px;
      overflow-y: auto;
      max-height: calc(min(56vh, 480px) - 48px);
      word-break: break-word;
      color: #1e293b;
      display: grid;
      gap: 10px;
    }
    .dict-content::selection {
      background: rgba(3, 105, 161, 0.18);
    }
    .dict-word {
      margin: 0;
      font-size: 21px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: 0.02em;
      color: #0f172a;
    }
    .dict-phonetic {
      margin: -2px 0 2px;
      color: #0f766e;
      font-weight: 600;
      font-size: 13px;
    }
    .dict-meaning {
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.82);
      padding: 10px 11px;
      display: grid;
      gap: 8px;
    }
    .dict-pos {
      width: fit-content;
      border-radius: 999px;
      background: rgba(14, 116, 144, 0.12);
      color: #0c4a6e;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 700;
      padding: 4px 8px;
    }
    .dict-meaning-body {
      display: grid;
      gap: 8px;
    }
    .dict-definition {
      margin: 0;
      font-size: 14px;
      color: #1e293b;
      line-height: 1.55;
    }
    .dict-example {
      margin: 0;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(2, 132, 199, 0.08);
      color: #0f3b4a;
      font-style: italic;
      font-size: 13px;
      line-height: 1.45;
    }
    .dict-tags-row {
      display: grid;
      gap: 6px;
    }
    .dict-tags-label {
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #475569;
      font-weight: 700;
    }
    .dict-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .dict-tag {
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.08);
      color: #334155;
      padding: 3px 8px;
      font-size: 12px;
      line-height: 1.2;
    }
    .dict-empty {
      margin: 0;
      color: #64748b;
    }
    .dict-close {
      width: 30px;
      height: 30px;
      border-radius: 10px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      background: rgba(255, 255, 255, 0.88);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
    }
    .dict-close:hover {
      transform: translateY(-1px);
      border-color: rgba(3, 105, 161, 0.42);
      background: rgba(240, 249, 255, 0.94);
    }
    .dict-close:focus-visible {
      outline: 2px solid rgba(14, 165, 164, 0.58);
      outline-offset: 2px;
    }
    .dict-close {
      color: #1e293b;
      font-size: 20px;
      line-height: 1;
      padding-bottom: 2px;
    }
    .dict-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;
  document.head.appendChild(style);
}
