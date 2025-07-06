let currentTab = null;
let startTime = null;
let syncInterval = null;

const PRODUCTIVE_SITES = [
  'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'w3schools.com',
  'codepen.io', 'jsfiddle.net', 'repl.it', 'codesandbox.io', 'leetcode.com',
  'hackerrank.com', 'freecodecamp.org', 'coursera.org', 'udemy.com',
  'khanacademy.org', 'edx.org', 'pluralsight.com', 'lynda.com'
];

const UNPRODUCTIVE_SITES = [
  'facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'netflix.com', 'twitch.tv', 'reddit.com',
  'pinterest.com', 'snapchat.com', 'linkedin.com', 'whatsapp.com'
];

chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
  startSyncInterval();
});

async function initializeStorage() {
  const result = await chrome.storage.local.get(['timeData', 'settings']);
  
  if (!result.timeData) {
    await chrome.storage.local.set({
      timeData: {},
      settings: {
        trackingEnabled: true,
        productiveSites: PRODUCTIVE_SITES,
        unproductiveSites: UNPRODUCTIVE_SITES
      }
    });
  }
}

// Track tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await handleTabChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await handleTabChange(tabId);
  }
});

// Handle window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await recordTimeForCurrentTab();
    currentTab = null;
  } else {
    // Browser gained focus
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      await handleTabChange(tabs[0].id);
    }
  }
});

// Handle tab changes
async function handleTabChange(tabId) {
  // Record time for previous tab
  await recordTimeForCurrentTab();
  
  // Start tracking new tab
  const tab = await chrome.tabs.get(tabId);
  if (tab && tab.url && !tab.url.startsWith('chrome://')) {
    currentTab = {
      id: tabId,
      url: tab.url,
      domain: extractDomain(tab.url),
      title: tab.title
    };
    startTime = Date.now();
  } else {
    currentTab = null;
  }
}

// Record time spent on current tab
async function recordTimeForCurrentTab() {
  if (!currentTab || !startTime) return;
  
  const timeSpent = Date.now() - startTime;
  const domain = currentTab.domain;
  const today = new Date().toISOString().split('T')[0];
  
  // Get current data
  const result = await chrome.storage.local.get(['timeData']);
  const timeData = result.timeData || {};
  
  // Initialize data structure if needed
  if (!timeData[today]) {
    timeData[today] = {};
  }
  
  if (!timeData[today][domain]) {
    timeData[today][domain] = {
      time: 0,
      visits: 0,
      category: categorizeSite(domain),
      title: currentTab.title,
      url: currentTab.url
    };
  }
  
  // Update time and visits
  timeData[today][domain].time += timeSpent;
  timeData[today][domain].visits += 1;
  
  // Save updated data
  await chrome.storage.local.set({ timeData });
  
  // Sync with backend
  await syncWithBackend(domain, timeSpent, today);
}

// Categorize website as productive, unproductive, or neutral
function categorizeSite(domain) {
  const settings = chrome.storage.local.get(['settings']);
  const productiveSites = settings.settings?.productiveSites || PRODUCTIVE_SITES;
  const unproductiveSites = settings.settings?.unproductiveSites || UNPRODUCTIVE_SITES;
  
  if (productiveSites.some(site => domain.includes(site))) {
    return 'productive';
  } else if (unproductiveSites.some(site => domain.includes(site))) {
    return 'unproductive';
  }
  return 'neutral';
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

// Sync data with backend
async function syncWithBackend(domain, timeSpent, date) {
  try {
    const response = await fetch('http://localhost:3000/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain,
        timeSpent,
        date,
        category: categorizeSite(domain)
      })
    });
    
    if (!response.ok) {
      console.error('Failed to sync with backend:', response.statusText);
    }
  } catch (error) {
    console.error('Error syncing with backend:', error);
  }
}

// Start periodic sync
function startSyncInterval() {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  syncInterval = setInterval(async () => {
    await recordTimeForCurrentTab();
    startTime = Date.now(); // Reset start time
  }, 30000); // Sync every 30 seconds
}

// Message listener for popup communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTodayData') {
    getTodayData().then(sendResponse);
    return true;
  } else if (request.action === 'getWeeklyData') {
    getWeeklyData().then(sendResponse);
    return true;
  }
});

// Get today's data
async function getTodayData() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.local.get(['timeData']);
  const timeData = result.timeData || {};
  
  return timeData[today] || {};
}

// Get weekly data
async function getWeeklyData() {
  const result = await chrome.storage.local.get(['timeData']);
  const timeData = result.timeData || {};
  
  const weekData = {};
  const today = new Date();
  
  // Get last 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    if (timeData[dateStr]) {
      weekData[dateStr] = timeData[dateStr];
    }
  }
  
  return weekData;
}