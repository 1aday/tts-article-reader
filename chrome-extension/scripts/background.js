// Background service worker
console.log('Article to Audio: Background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed');
    // Set default server URL
    chrome.storage.local.set({ serverUrl: 'http://localhost:3000' });

    // Open welcome page
    chrome.tabs.create({
      url: 'http://localhost:3000'
    });
  } else if (details.reason === 'update') {
    console.log('Extension updated');
  }

  // Create context menu items (optional - for right-click integration)
  // Remove all existing menus first to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'send-to-audio',
      title: 'Convert to Audio',
      contexts: ['page', 'selection']
    });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'send-to-audio') {
    // Open popup or send to server
    chrome.action.openPopup();
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openTab') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  }
  return true;
});
