const DEFAULT_SETTINGS = {
  bubbleTimeoutMs: 10000,
  autoCloseOnSelectionClear: true,
  autoCloseOnInteraction: true,
  enableContextMenu: true,
  maxHistoryEntries: 50
};

const formElements = {
  bubbleTimeoutMs: document.getElementById("bubbleTimeoutMs"),
  autoCloseOnSelectionClear: document.getElementById("autoCloseOnSelectionClear"),
  autoCloseOnInteraction: document.getElementById("autoCloseOnInteraction"),
  enableContextMenu: document.getElementById("enableContextMenu"),
  maxHistoryEntries: document.getElementById("maxHistoryEntries")
};

const statusEl = document.getElementById("status");
document.getElementById("save").addEventListener("click", saveSettings);
document.getElementById("reset").addEventListener("click", resetDefaults);

loadSettings();

async function loadSettings() {
  const { settings = {} } = await browser.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  applyToForm(merged);
}

function applyToForm(settings) {
  formElements.bubbleTimeoutMs.value = settings.bubbleTimeoutMs;
  formElements.maxHistoryEntries.value = settings.maxHistoryEntries;
  formElements.autoCloseOnSelectionClear.checked = settings.autoCloseOnSelectionClear;
  formElements.autoCloseOnInteraction.checked = settings.autoCloseOnInteraction;
  formElements.enableContextMenu.checked = settings.enableContextMenu;
}

function readFromForm() {
  return {
    bubbleTimeoutMs: sanitizeTimeout(formElements.bubbleTimeoutMs.value),
    maxHistoryEntries: sanitizeMaxHistory(formElements.maxHistoryEntries.value),
    autoCloseOnSelectionClear: Boolean(formElements.autoCloseOnSelectionClear.checked),
    autoCloseOnInteraction: Boolean(formElements.autoCloseOnInteraction.checked),
    enableContextMenu: Boolean(formElements.enableContextMenu.checked)
  };
}

async function saveSettings() {
  const settings = readFromForm();
  await browser.storage.local.set({ settings });
  showStatus("Settings saved.");
}

async function resetDefaults() {
  await browser.storage.local.set({ settings: { ...DEFAULT_SETTINGS } });
  applyToForm(DEFAULT_SETTINGS);
  showStatus("Defaults restored.");
}

function sanitizeTimeout(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.bubbleTimeoutMs;
  }
  return Math.max(0, Math.min(60000, Math.floor(numeric)));
}

function sanitizeMaxHistory(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.maxHistoryEntries;
  }
  return Math.max(5, Math.min(100, Math.floor(numeric)));
}

function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 1800);
}
