document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  document.getElementById('search').onclick = () => {
    searchWord();
  };
  document.getElementById('open-settings').onclick = () => {
    browser.runtime.openOptionsPage();
  };
  document.getElementById('open-native-setup').onclick = () => {
    window.open('https://github.com/ramblingThinker/awsome-dictionary/blob/main/native/macos/SETUP.md', '_blank', 'noopener');
  };
  document.getElementById('check-native').onclick = () => {
    checkNativeHost();
  };
  document.getElementById('clear-history').onclick = () => {
    clearHistory();
  };
  document.getElementById('word').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      searchWord();
    }
  });
});

async function searchWord() {
  const word = document.getElementById('word').value.trim();
  if (!word) {
    return;
  }

  const resultDiv = document.getElementById('result');
  const searchButton = document.getElementById('search');
  resultDiv.textContent = 'Loading...';
  searchButton.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({ action: 'define', word });
    renderResult(resultDiv, response);
    await loadHistory();
  } catch (error) {
    renderResult(resultDiv, {
      source: 'unavailable',
      definition: 'Unable to fetch definition right now.'
    });
  } finally {
    searchButton.disabled = false;
  }
}

function renderResult(container, response) {
  container.textContent = '';

  const sourceLabel = formatSourceLabel(response);
  if (sourceLabel) {
    const metaRow = document.createElement('div');
    metaRow.className = 'result-meta';

    const sourceBadge = document.createElement('span');
    sourceBadge.className = `result-source result-source-${response.source || 'default'}`;
    sourceBadge.textContent = sourceLabel;
    metaRow.appendChild(sourceBadge);
    container.appendChild(metaRow);
  }

  const body = document.createElement('div');
  body.className = 'result-body';
  renderMultilineText(body, response.definition);
  container.appendChild(body);
}

function renderMultilineText(container, text) {
  container.textContent = '';
  const lines = splitDefinitionLines(text);
  lines.forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement('br'));
    }
    container.appendChild(document.createTextNode(line));
  });
}

function splitDefinitionLines(text) {
  return String(text || '')
    .split(/(?:\r?\n|<br\s*\/?>)/gi)
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

function formatSourceLabel(response) {
  if (response.source === 'native') {
    return 'macOS dictionary';
  }
  if (response.source === 'live') {
    return 'API';
  }
  if (response.source === 'cache') {
    const mins = Number(response.cacheAgeMinutes || 0);
    return mins > 0 ? `Offline cache • ${mins}m` : 'Offline cache';
  }
  if (response.source === 'unavailable') {
    return 'Network unavailable';
  }
  return '';
}

async function loadHistory() {
  try {
    const history = await browser.runtime.sendMessage({ action: 'get_history' });
    const historyList = document.getElementById('history-list');
    historyList.replaceChildren();
    for (const word of history) {
      const li = document.createElement('li');
      li.textContent = word;
      li.onclick = () => {
        document.getElementById('word').value = word;
        searchWord();
      };
      historyList.appendChild(li);
    }
  } catch {
    // Keep popup usable even if storage access fails.
  }
}

async function clearHistory() {
  await browser.runtime.sendMessage({ action: 'clear_history' });
  await loadHistory();
}

async function checkNativeHost() {
  const statusEl = document.getElementById('native-status');
  statusEl.className = 'native-status checking';
  statusEl.textContent = 'Checking native host...';

  try {
    const result = await browser.runtime.sendMessage({ action: 'check_native_host' });
    statusEl.className = result.ok ? 'native-status ok' : 'native-status error';
    statusEl.textContent = result.message || 'Native host check completed.';
  } catch (error) {
    statusEl.className = 'native-status error';
    statusEl.textContent = 'Native host check failed.';
  }
}
