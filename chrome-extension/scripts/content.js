// Content script - runs on every page
// This helps extract article content more intelligently

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    const pageInfo = extractDetailedPageInfo();
    sendResponse(pageInfo);
  }
  return true;
});

function extractDetailedPageInfo() {
  // Get page metadata
  const title = getPageTitle();
  const url = window.location.href;
  const author = getAuthor();
  const publishDate = getPublishDate();

  // Extract main content
  const content = extractMainContent();
  const words = content.split(/\s+/).filter(w => w.length > 0).length;

  return {
    title,
    url,
    content,
    words,
    author,
    publishDate,
  };
}

function getPageTitle() {
  // Try Open Graph title first
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) return ogTitle.content;

  // Try Twitter title
  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) return twitterTitle.content;

  // Try h1
  const h1 = document.querySelector('h1');
  if (h1) return h1.textContent.trim();

  // Fallback to document title
  return document.title;
}

function getAuthor() {
  // Try meta tags
  const authorMeta = document.querySelector('meta[name="author"]') ||
    document.querySelector('meta[property="article:author"]');
  if (authorMeta) return authorMeta.content;

  // Try common author selectors
  const authorSelectors = [
    '.author-name',
    '.author',
    '[rel="author"]',
    '.byline',
  ];

  for (const selector of authorSelectors) {
    const element = document.querySelector(selector);
    if (element) return element.textContent.trim();
  }

  return null;
}

function getPublishDate() {
  // Try meta tags
  const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
    document.querySelector('meta[name="publish_date"]');
  if (dateMeta) return dateMeta.content;

  // Try time elements
  const timeElement = document.querySelector('time[datetime]');
  if (timeElement) return timeElement.getAttribute('datetime');

  return null;
}

function extractMainContent() {
  // Remove unwanted elements
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    '.advertisement',
    '.ad',
    '.sidebar',
    '.comments',
    '[role="navigation"]',
    '[role="complementary"]',
  ];

  const clone = document.body.cloneNode(true);
  unwantedSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Try to find main content
  let content = '';

  // Priority 1: Article tag
  const article = clone.querySelector('article');
  if (article) {
    content = article.innerText;
  }

  // Priority 2: Main tag or role="main"
  if (!content || content.length < 300) {
    const main = clone.querySelector('main, [role="main"]');
    if (main) content = main.innerText;
  }

  // Priority 3: Common content class names
  if (!content || content.length < 300) {
    const contentSelectors = [
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content-body',
      '#article',
      '#content',
    ];

    for (const selector of contentSelectors) {
      const element = clone.querySelector(selector);
      if (element && element.innerText.length > content.length) {
        content = element.innerText;
      }
    }
  }

  // Fallback to body
  if (!content) {
    content = clone.innerText;
  }

  // Clean up content
  content = content
    .replace(/\s+/g, ' ')           // Multiple spaces to single
    .replace(/\n{3,}/g, '\n\n')     // Multiple newlines to double
    .replace(/\t+/g, ' ')           // Tabs to space
    .trim();

  return content;
}

// Helper function to check if extension can access the page
function canAccessPage() {
  const url = window.location.href;
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'about:', 'data:'];
  return !restrictedProtocols.some(protocol => url.startsWith(protocol));
}

// Initialize
if (canAccessPage()) {
  console.log('Article to Audio: Content script loaded');
}
