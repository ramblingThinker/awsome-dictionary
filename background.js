const DEFAULT_SETTINGS = {
  bubbleTimeoutMs: 10000,
  autoCloseOnSelectionClear: true,
  autoCloseOnInteraction: true,
  enableContextMenu: true,
  maxHistoryEntries: 50
};
const MAX_CACHE_ENTRIES = 200;
const MAX_CACHE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHED_DEFINITION_CHARS = 2400;
const MAC_NATIVE_HOST = "com.ramblingthinker.awesome_dictionary";
const NATIVE_POS_TERMS = [
  "possessive determiner",
  "possessive pronoun",
  "phrasal verb",
  "auxiliary verb",
  "modal verb",
  "transitive verb",
  "intransitive verb",
  "proper noun",
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "interjection",
  "determiner",
  "article"
];
const NATIVE_SECTION_HEADERS = ["PHRASES", "ORIGIN", "USAGE", "DERIVATIVES", "ETYMOLOGY", "GRAMMAR"];

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

  if (msg.action === "check_native_host") {
    return checkNativeHost();
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

  const nativeResult = await tryGetMacNativeDefinition(cacheKey, normalizedWord);
  if (nativeResult) {
    return nativeResult;
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
    const definition = formatDefinitionMarkup({
      word: entry.word || normalizedWord,
      phonetic: entry.phonetic,
      meanings: entry.meanings
    });
    await saveDefinitionToCache(cacheKey, definition);
    return { definition, source: "live" };
  } catch {
    return fallbackFromCacheOrDefault(cacheKey, normalizedWord, "Unable to fetch definition right now.");
  }
}

async function tryGetMacNativeDefinition(cacheKey, normalizedWord) {
  const isMac = await isMacPlatform();
  if (!isMac) {
    return null;
  }

  if (typeof browser.runtime?.sendNativeMessage !== "function") {
    return null;
  }

  let response;
  try {
    response = await browser.runtime.sendNativeMessage(MAC_NATIVE_HOST, {
      action: "define",
      word: normalizedWord
    });
  } catch {
    return null;
  }

  if (response?.ok === false && response.error === "not_found") {
    return fallbackFromCacheOrDefault(cacheKey, normalizedWord, "No definition found.");
  }

  const definition = formatNativeDefinition(normalizedWord, response);
  if (!definition) {
    return null;
  }

  await appendToHistory(normalizedWord);
  await saveDefinitionToCache(cacheKey, definition);
  return { definition, source: "native" };
}

async function checkNativeHost() {
  const isMac = await isMacPlatform();
  if (!isMac) {
    return {
      ok: false,
      source: "diagnostic",
      status: "not_macos",
      message: "Native macOS dictionary is only available on macOS."
    };
  }

  if (typeof browser.runtime?.sendNativeMessage !== "function") {
    return {
      ok: false,
      source: "diagnostic",
      status: "native_messaging_unavailable",
      message: "Native Messaging API is not available in this environment."
    };
  }

  try {
    const response = await browser.runtime.sendNativeMessage(MAC_NATIVE_HOST, {
      action: "define",
      word: "dictionary"
    });
    if (response?.ok === true) {
      return {
        ok: true,
        source: "diagnostic",
        status: "connected",
        message: "macOS native dictionary host is connected."
      };
    }
    return {
      ok: false,
      source: "diagnostic",
      status: "host_error",
      message: `Native host responded with error: ${response?.error || "unknown"}`
    };
  } catch (error) {
    const detail = String(error?.message || error || "");
    const missingHost = /not found|not registered|does not exist|specified native messaging host/i.test(detail);
    return {
      ok: false,
      source: "diagnostic",
      status: missingHost ? "host_missing" : "connection_failed",
      message: missingHost
        ? "Native host is not installed or not registered."
        : `Failed to connect to native host: ${detail || "unknown error"}`
    };
  }
}

async function isMacPlatform() {
  if (typeof browser.runtime?.getPlatformInfo !== "function") {
    return false;
  }
  try {
    const platform = await browser.runtime.getPlatformInfo();
    return platform?.os === "mac";
  } catch {
    return false;
  }
}

function formatNativeDefinition(fallbackWord, response) {
  if (Array.isArray(response?.meanings) && response.meanings.length > 0) {
    return formatDefinitionMarkup({
      word: response.word || fallbackWord,
      phonetic: response.phonetic,
      meanings: response.meanings
    });
  }

  const text = normalizeWord(response?.definition || response?.text || "");
  if (!text) {
    return null;
  }

  return formatNativeTextAsMarkup(response?.word || fallbackWord, text);
}

function formatNativeTextAsMarkup(fallbackWord, text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/\s+\|\s+/).map((part) => part.trim()).filter(Boolean);
  let word = fallbackWord;
  let phonetic = "";
  let startIndex = 0;

  if (parts[0] && looksLikeHeadword(parts[0])) {
    word = parts[0];
    startIndex = 1;
  }
  if (parts[startIndex] && looksLikePhonetic(parts[startIndex])) {
    phonetic = normalizePhonetic(parts[startIndex]);
    startIndex += 1;
  }

  const sections = parts.slice(startIndex);
  const rawSectionText = sections.length ? sections.join(" | ") : normalized;
  const lines = parseNativeDefinitionLines(rawSectionText);

  let body = "";
  if (lines.length) {
    for (const line of lines) {
      body += `<br>${escapeHtml(line)}`;
    }
  } else {
    body = "<br>No definition details available.";
  }

  const phoneticLine = phonetic ? `/${escapeHtml(phonetic)}/` : "";
  return `${escapeHtml(word).toUpperCase()}<br>${phoneticLine}${body}`;
}

function parseNativeDefinitionLines(text) {
  const posAlternation = NATIVE_POS_TERMS.map(escapeRegex).join("|");
  const posBoundaryRegex = new RegExp(`\\.\\s+(${posAlternation})\\b`, "gi");
  const posLineRegex = new RegExp(`^(${posAlternation})\\b\\s*`, "i");

  const normalized = String(text || "")
    .replace(/\s+\|\s+/g, "\n")
    .replace(new RegExp(`\\s+(${NATIVE_SECTION_HEADERS.join("|")})\\b`, "g"), "\n$1")
    .replace(/\s+([0-9]{1,2})\s+(?=[A-Za-z(])/g, "\n$1 ")
    .replace(/\s+•\s+/g, "\n• ")
    .replace(posBoundaryRegex, ".\n$1");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  const output = [];
  for (const line of lines) {
    const header = NATIVE_SECTION_HEADERS.find((name) => line.toUpperCase().startsWith(name));
    if (header) {
      output.push(`• ${header}`);
      const remainder = line.slice(header.length).trim();
      pushNativeDetailLines(output, remainder);
      continue;
    }

    const posMatch = line.match(posLineRegex);
    if (posMatch) {
      output.push(`• ${posMatch[1].toUpperCase()}`);
      const remainder = line.slice(posMatch[0].length).trim();
      pushNativeDetailLines(output, remainder);
      continue;
    }

    pushNativeDetailLines(output, line);
  }

  return output;
}

function looksLikeHeadword(text) {
  return /^[A-Za-z][A-Za-z' -]*$/.test(String(text || "").trim());
}

function looksLikePhonetic(text) {
  const value = String(text || "").trim();
  if (!value || /\s{2,}/.test(value)) {
    return false;
  }
  return /[ɪʊəɛæɑɔʌɒθðŋˈˌ]/.test(value) || /^[A-Za-z/, .()-]+$/.test(value);
}

function normalizePhonetic(text) {
  return String(text || "").replace(/^\/+|\/+$/g, "").trim();
}

function pushNativeDetailLines(output, text) {
  if (!text) {
    return;
  }
  const lines = String(text)
    .replace(/\s+([0-9]{1,2})\s+(?=[A-Za-z(])/g, "\n$1 ")
    .replace(/\s+•\s+/g, "\n• ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    output.push(line);
  }
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatDefinitionMarkup({ word, phonetic, meanings }) {
  const entryWord = escapeHtml(word || "").toUpperCase();
  const phoneticLine = phonetic ? `/${escapeHtml(phonetic)}/` : "";
  const meaningsList = Array.isArray(meanings) ? meanings.slice(0, 3) : [];
  let meaningHtml = "";

  for (const meaning of meaningsList) {
    const firstDefinition = Array.isArray(meaning?.definitions) ? meaning.definitions[0] : null;
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

  return `${entryWord}<br>${phoneticLine}${meaningHtml || "<br>No definition details available."}`;
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
