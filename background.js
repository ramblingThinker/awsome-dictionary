const DEFAULT_SETTINGS = {
  bubbleTimeoutMs: 10000,
  autoCloseOnSelectionClear: true,
  autoCloseOnInteraction: true,
  enableContextMenu: true,
  maxHistoryEntries: 50
};
const MAX_CACHE_ENTRIES = 60;
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHED_DEFINITION_CHARS = 1600;

browser.runtime.onInstalled.addListener(async () => {
  await ensureDefaultSettings();
  await syncContextMenu();
});

browser.runtime.onStartup.addListener(async () => {
  await ensureDefaultSettings();
  await syncContextMenu();
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === "define") {
    return handleDefine(msg.word, sender);
  }

  if (msg.action === "get_history") {
    return getHistory();
  }

  if (msg.action === "clear_history") {
    return clearHistory();
  }

  return null;
});

browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes.settings) {
    syncContextMenu();
  }
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "define-word" || !tab?.id) {
    return;
  }

  browser.tabs.sendMessage(tab.id, {
    action: "show_definition",
    definition: "Loading..."
  });

  const result = await getFullDefinition(info.selectionText || "");
  browser.tabs.sendMessage(tab.id, { action: "show_definition", ...result });
});

async function handleDefine(word, sender) {
  const result = await getFullDefinition(word);

  if (sender.tab?.id) {
    browser.tabs.sendMessage(sender.tab.id, { action: "show_definition", ...result });
  }

  return result;
}

async function getHistory() {
  const { history = [] } = await browser.storage.local.get("history");
  return history;
}

async function clearHistory() {
  await browser.storage.local.set({ history: [] });
  return { ok: true };
}

function escapeHtml(text) {
  const chars = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };
  return String(text).replace(/[&<>"']/g, (match) => chars[match]);
}

function normalizeWord(word) {
  return String(word || "").trim();
}

async function getFullDefinition(word) {
  const normalizedWord = normalizeWord(word);
  const cacheKey = normalizedWord.toLowerCase();
  if (!normalizedWord) {
    return { definition: "No word selected." };
  }

  try {
    const encodedWord = encodeURIComponent(normalizedWord);
    const res = await fetchWithRetry(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodedWord}`,
      { timeoutMs: 6000, retries: 1 }
    );
    const data = await res.json();

    if (!res.ok || data?.title === "No Definitions Found" || !Array.isArray(data) || data.length === 0) {
      return fallbackFromCacheOrDefault(cacheKey, normalizedWord, "No definition found.");
    }

    await appendToHistory(normalizedWord);

    const entry = data[0];
    const entryWord = escapeHtml(entry.word || normalizedWord).toUpperCase();
    const phonetic = entry.phonetic ? `/${escapeHtml(entry.phonetic)}/` : "";
    const meanings = Array.isArray(entry.meanings) ? entry.meanings.slice(0, 3) : [];
    let meaningHtml = "";

    for (const meaning of meanings) {
      const firstDefinition = Array.isArray(meaning.definitions) ? meaning.definitions[0] : null;
      if (!firstDefinition?.definition) {
        continue;
      }

      const pos = escapeHtml(meaning.partOfSpeech || "unknown").toUpperCase();
      const def = escapeHtml(firstDefinition.definition);
      const example = firstDefinition.example ? `<br>"${escapeHtml(firstDefinition.example)}"` : "";
      const synonyms = Array.isArray(firstDefinition.synonyms) ? firstDefinition.synonyms : [];
      const antonyms = Array.isArray(firstDefinition.antonyms) ? firstDefinition.antonyms : [];
      const syn = synonyms.length ? `<br>Synonyms: ${escapeHtml(synonyms.join(", "))}` : "";
      const ant = antonyms.length ? `<br>Antonyms: ${escapeHtml(antonyms.join(", "))}` : "";
      meaningHtml += `<br>• ${pos}<br>${def}${example}${syn}${ant}`;
    }

    const definition = `${entryWord}<br>${phonetic}${meaningHtml || "<br>No definition details available."}`;
    await saveDefinitionToCache(cacheKey, definition);
    return { definition, source: "live" };
  } catch {
    return fallbackFromCacheOrDefault(cacheKey, normalizedWord, "Unable to fetch definition right now.");
  }
}

async function appendToHistory(word) {
  const { history = [] } = await browser.storage.local.get("history");
  const lowerWord = word.toLowerCase();
  const nextHistory = history.filter((item) => String(item).toLowerCase() !== lowerWord);
  nextHistory.unshift(word);

  const settings = await getSettings();
  const maxEntries = sanitizeMaxHistoryEntries(settings.maxHistoryEntries);
  await browser.storage.local.set({ history: nextHistory.slice(0, maxEntries) });
}

async function fetchWithRetry(url, options) {
  const retries = Number(options?.retries || 0);
  let attempt = 0;
  while (true) {
    try {
      return await fetchWithTimeout(url, options?.timeoutMs || 6000);
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }
      attempt += 1;
    }
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveDefinitionToCache(wordKey, definition) {
  const now = Date.now();
  const { definitionCache = {} } = await browser.storage.local.get("definitionCache");
  const pruned = pruneCache(definitionCache, now);

  pruned[wordKey] = {
    definition: trimDefinitionForCache(definition),
    updatedAt: now
  };

  const entries = Object.entries(pruned);
  entries.sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
  const trimmed = Object.fromEntries(entries.slice(0, MAX_CACHE_ENTRIES));
  await browser.storage.local.set({ definitionCache: trimmed });
}

async function fallbackFromCacheOrDefault(wordKey, normalizedWord, fallbackMessage) {
  const now = Date.now();
  const { definitionCache = {} } = await browser.storage.local.get("definitionCache");
  const pruned = pruneCache(definitionCache, now);
  const cached = pruned[wordKey];

  if (Object.keys(pruned).length !== Object.keys(definitionCache).length) {
    await browser.storage.local.set({ definitionCache: pruned });
  }

  if (cached?.definition) {
    const staleMinutes = Math.max(1, Math.floor((now - (cached.updatedAt || 0)) / 60000));
    return {
      definition: cached.definition,
      source: "cache",
      cacheAgeMinutes: staleMinutes
    };
  }

  return {
    definition: `${escapeHtml(normalizedWord)}<br>${fallbackMessage}`,
    source: "unavailable"
  };
}

function pruneCache(definitionCache, now) {
  const next = {};
  for (const [key, value] of Object.entries(definitionCache)) {
    const updatedAt = Number(value?.updatedAt || 0);
    if (!value?.definition || now - updatedAt > MAX_CACHE_AGE_MS) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function trimDefinitionForCache(definition) {
  const text = String(definition || "");
  if (text.length <= MAX_CACHED_DEFINITION_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_CACHED_DEFINITION_CHARS)}<br>…`;
}

async function ensureDefaultSettings() {
  const { settings = {} } = await browser.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  if (JSON.stringify(merged) !== JSON.stringify(settings)) {
    await browser.storage.local.set({ settings: merged });
  }
}

async function getSettings() {
  const { settings = {} } = await browser.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function syncContextMenu() {
  const settings = await getSettings();
  await browser.contextMenus.removeAll();
  if (!settings.enableContextMenu) {
    return;
  }
  browser.contextMenus.create({
    id: "define-word",
    title: "Define '%s'",
    contexts: ["selection"]
  });
}

function sanitizeMaxHistoryEntries(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.maxHistoryEntries;
  }
  return Math.max(5, Math.min(100, Math.floor(numeric)));
}
