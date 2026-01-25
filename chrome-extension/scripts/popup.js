// State
let currentMode = 'scrape';
let pageInfo = null;
let serverUrl = 'http://localhost:3000';

// DOM Elements
const modeBtns = document.querySelectorAll('.mode-btn');
const scrapeContent = document.getElementById('scrape-content');
const urlContent = document.getElementById('url-content');
const scrapeBtn = document.getElementById('scrape-btn');
const scrapeGenerateBtn = document.getElementById('scrape-generate-btn');
const urlBtn = document.getElementById('url-btn');
const urlGenerateBtn = document.getElementById('url-generate-btn');
const urlInput = document.getElementById('url-input');
const serverUrlInput = document.getElementById('server-url');
const statusEl = document.getElementById('status');
const openAppLink = document.getElementById('open-app');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved server URL
  const saved = await chrome.storage.local.get(['serverUrl']);
  if (saved.serverUrl) {
    serverUrl = saved.serverUrl;
    serverUrlInput.value = serverUrl;
  }

  // Get current page info
  await loadPageInfo();

  // Setup event listeners
  setupEventListeners();
});

// Mode switching
function setupEventListeners() {
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      switchMode(mode);
    });
  });

  scrapeBtn.addEventListener('click', () => handleScrape(false));
  scrapeGenerateBtn.addEventListener('click', () => handleScrape(true));
  urlBtn.addEventListener('click', () => handleUrl(false));
  urlGenerateBtn.addEventListener('click', () => handleUrl(true));

  urlInput.addEventListener('input', () => {
    const hasValue = urlInput.value.trim().length > 0;
    urlBtn.disabled = !hasValue;
    urlGenerateBtn.disabled = !hasValue;
  });

  serverUrlInput.addEventListener('change', async () => {
    serverUrl = serverUrlInput.value.trim();
    await chrome.storage.local.set({ serverUrl });
  });

  openAppLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: serverUrl });
  });
}

function switchMode(mode) {
  currentMode = mode;

  // Update buttons
  modeBtns.forEach(btn => {
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update content
  if (mode === 'scrape') {
    scrapeContent.classList.add('active');
    urlContent.classList.remove('active');
  } else {
    scrapeContent.classList.remove('active');
    urlContent.classList.add('active');
  }
}

async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('error', 'Could not access current tab');
      return;
    }

    // Inject content script and get page info
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageInfo
    });

    if (results && results[0] && results[0].result) {
      pageInfo = results[0].result;
      displayPageInfo();
    } else {
      showStatus('error', 'Could not extract page info');
    }
  } catch (error) {
    console.error('Error loading page info:', error);
    showStatus('error', 'Failed to load page info: ' + error.message);
  }
}

function extractPageInfo() {
  // This runs in the page context
  const title = document.title || 'Untitled';
  const url = window.location.href;

  // Extract main content
  let content = '';

  // Try article tag first
  const article = document.querySelector('article');
  if (article) {
    content = article.innerText;
  } else {
    // Try common content selectors
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element && element.innerText.length > content.length) {
        content = element.innerText;
      }
    }

    // Fallback to body if nothing found
    if (!content) {
      content = document.body.innerText;
    }
  }

  // Clean up content
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const words = content.split(/\s+/).length;

  return {
    title,
    url,
    content,
    words
  };
}

function displayPageInfo() {
  if (!pageInfo) return;

  document.getElementById('page-title').textContent = pageInfo.title;
  document.getElementById('page-url').textContent = pageInfo.url;
  document.getElementById('page-words').textContent = `${pageInfo.words.toLocaleString()} words`;
}

async function handleScrape(generateNow) {
  if (!pageInfo) {
    showStatus('error', 'No page information available');
    return;
  }

  if (!pageInfo.content || pageInfo.content.length < 100) {
    showStatus('error', 'Page content is too short (minimum 100 characters)');
    return;
  }

  showStatus('loading', 'Saving article...');
  scrapeBtn.disabled = true;
  scrapeGenerateBtn.disabled = true;

  try {
    // Save article
    const response = await fetch(`${serverUrl}/api/article/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: pageInfo.title,
        text: pageInfo.content,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save article');
    }

    const data = await response.json();
    const articleId = data.article.id;

    if (generateNow) {
      // Open voice selection page
      chrome.tabs.create({
        url: `${serverUrl}/voice-select/${articleId}`
      });
      showStatus('success', 'Article saved! Opening voice selection...');
    } else {
      // Just save to library
      showStatus('success', 'Article added to library! ✓');

      // Show success for 2 seconds then offer to open library
      setTimeout(() => {
        showStatus('success', 'Article saved! <a href="#" id="open-library" style="text-decoration: underline; font-weight: 600;">View Library →</a>');
        document.getElementById('open-library')?.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: `${serverUrl}/library` });
        });
      }, 2000);
    }
  } catch (error) {
    console.error('Error:', error);
    showStatus('error', error.message);
  } finally {
    scrapeBtn.disabled = false;
    scrapeGenerateBtn.disabled = false;
  }
}

async function handleUrl(generateNow) {
  const url = urlInput.value.trim();

  if (!url) {
    showStatus('error', 'Please enter a URL');
    return;
  }

  showStatus('loading', 'Scraping article...');
  urlBtn.disabled = true;
  urlGenerateBtn.disabled = true;

  try {
    // Scrape article from URL
    const response = await fetch(`${serverUrl}/api/article/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scrape article');
    }

    const data = await response.json();
    const articleId = data.article.id;

    if (generateNow) {
      // Open voice selection page
      chrome.tabs.create({
        url: `${serverUrl}/voice-select/${articleId}`
      });
      showStatus('success', 'Article scraped! Opening voice selection...');
    } else {
      // Just save to library
      showStatus('success', 'Article added to library! ✓');

      // Show success for 2 seconds then offer to open library
      setTimeout(() => {
        showStatus('success', 'Article saved! <a href="#" id="open-library" style="text-decoration: underline; font-weight: 600;">View Library →</a>');
        document.getElementById('open-library')?.addEventListener('click', (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: `${serverUrl}/library` });
        });
      }, 2000);
    }

    // Clear input
    urlInput.value = '';
  } catch (error) {
    console.error('Error:', error);
    showStatus('error', error.message);
  } finally {
    urlBtn.disabled = false;
    urlGenerateBtn.disabled = false;
  }
}

function showStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.innerHTML = type === 'loading'
    ? `<span class="spinner"></span> ${message}`
    : message;
}
