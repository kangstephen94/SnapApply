// ═══════════════════════════════════════════════════════════════════
// Background Service Worker
// Handles messages between content scripts and popup,
// programmatic injection ("Scan This Page" from popup)
// ═══════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Content script saved a job
  if (message.type === 'JOB_SAVED') {
    chrome.action.setBadgeText({ text: '✓' });
    chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    setTimeout(function () {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
    sendResponse({ ok: true });
  }

  // Popup requests: inject content script into the active tab
  if (message.type === 'SCAN_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0]) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      var tab = tabs[0];

      if (
        !tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://')
      ) {
        sendResponse({ ok: false, error: 'Cannot scan this page type' });
        return;
      }

      chrome.scripting
        .insertCSS({ target: { tabId: tab.id }, files: ['content.css'] })
        .then(function () {
          return chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js'],
          });
        })
        .then(function () {
          sendResponse({ ok: true, url: tab.url });
        })
        .catch(function (err) {
          sendResponse({ ok: false, error: err.message });
        });
    });
    return true;
  }

  // Get current tab info
  if (message.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        sendResponse({ url: tabs[0].url, title: tabs[0].title, id: tabs[0].id });
      } else {
        sendResponse({ url: '', title: '', id: null });
      }
    });
    return true;
  }

  if (message.type === 'UPDATE_BADGE') {
    if (message.count > 0) {
      chrome.action.setBadgeText({ text: String(message.count) });
      chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    sendResponse({ ok: true });
  }

  return false;
});

// On install
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      'job-apps': '[]',
      'webhook-url': '',
    });
  }
});
