// Content script for activity tracking
let isActive = true;
let lastActivity = Date.now();
let inactivityTimer = null;

// Track user activity
function trackActivity() {
  isActive = true;
  lastActivity = Date.now();
  
  // Reset inactivity timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  // Set new inactivity timer (5 minutes)
  inactivityTimer = setTimeout(() => {
    isActive = false;
    chrome.runtime.sendMessage({
      action: 'userInactive',
      timestamp: Date.now()
    });
  }, 5 * 60 * 1000);
}

// Listen for user interactions
document.addEventListener('mousedown', trackActivity);
document.addEventListener('mousemove', trackActivity);
document.addEventListener('keydown', trackActivity);
document.addEventListener('scroll', trackActivity);
document.addEventListener('click', trackActivity);

// Send page view data
chrome.runtime.sendMessage({
  action: 'pageView',
  url: window.location.href,
  title: document.title,
  timestamp: Date.now()
});

// Track page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    chrome.runtime.sendMessage({
      action: 'pageHidden',
      timestamp: Date.now()
    });
  } else {
    chrome.runtime.sendMessage({
      action: 'pageVisible',
      timestamp: Date.now()
    });
    trackActivity();
  }
});

// Initial activity tracking
trackActivity();