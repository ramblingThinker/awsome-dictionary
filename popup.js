document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  document.getElementById('search').onclick = () => {
    searchWord();
  };
  document.getElementById('open-settings').onclick = () => {
    browser.runtime.openOptionsPage();
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
    renderMultilineText(resultDiv, response.definition);
    await loadHistory();
  } catch (error) {
    resultDiv.textContent = 'Unable to fetch definition right now.';
  } finally {
    searchButton.disabled = false;
  }
}

function renderMultilineText(container, text) {
  container.textContent = '';
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) {
      container.appendChild(document.createElement('br'));
    }
    container.appendChild(document.createTextNode(line));
  });
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

const style = document.createElement('style');
style.textContent = `
  #top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  #open-settings {
    border: 1px solid #d0d7de;
    border-radius: 8px;
    background: #ffffff;
    color: #334155;
    font-size: 12px;
    padding: 6px 10px;
    cursor: pointer;
  }
  #open-settings:hover {
    background: #f8fafc;
  }
  #history-container {
    margin-top: 20px;
  }
  #history-container h2 {
    font-size: 16px;
    margin: 0 0 8px;
    color: #5f6368;
  }
  #clear-history {
    background: none;
    border: none;
    color: #4285f4;
    cursor: pointer;
    font-size: 12px;
    padding: 0;
    float: right;
  }
  #history-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 150px;
    overflow-y: auto;
  }
  #history-list li {
    padding: 8px;
    cursor: pointer;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  #history-list li:hover {
    background-color: #f1f3f4;
  }
`;
document.head.appendChild(style);
