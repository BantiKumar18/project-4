// Popup script for Chrome extension
document.addEventListener('DOMContentLoaded', async () => {
    // Set current date
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('currentDate').textContent = currentDate;

    // Load today's data
    await loadTodayData();

    // Add event listeners
    document.getElementById('dashboardBtn').addEventListener('click', openDashboard);
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
});

async function loadTodayData() {
    try {
        const response = await chrome.runtime.sendMessage({action: 'getTodayData'});
        const data = response || {};
        
        // Calculate statistics
        const stats = calculateStats(data);
        
        // Update UI
        updateUI(stats, data);
        
        // Hide loading, show content
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('loadingState').textContent = 'Error loading data';
    }
}

function calculateStats(data) {
    let totalTime = 0;
    let productiveTime = 0;
    let unproductiveTime = 0;
    let neutralTime = 0;
    
    const sites = [];
    
    for (const [domain, info] of Object.entries(data)) {
        totalTime += info.time;
        
        switch (info.category) {
            case 'productive':
                productiveTime += info.time;
                break;
            case 'unproductive':
                unproductiveTime += info.time;
                break;
            default:
                neutralTime += info.time;
        }
        
        sites.push({
            domain,
            time: info.time,
            category: info.category,
            visits: info.visits,
            title: info.title
        });
    }
    
    // Sort sites by time spent
    sites.sort((a, b) => b.time - a.time);
    
    // Calculate productivity score
    const productivityScore = totalTime > 0 ? 
        Math.round((productiveTime / totalTime) * 100) : 0;
    
    return {
        totalTime,
        productiveTime,
        unproductiveTime,
        neutralTime,
        productivityScore,
        sites: sites.slice(0, 5) // Top 5 sites
    };
}

function updateUI(stats, data) {
    // Update time displays
    document.getElementById('totalTime').textContent = formatTime(stats.totalTime);
    document.getElementById('productiveTime').textContent = formatTime(stats.productiveTime);
    document.getElementById('unproductiveTime').textContent = formatTime(stats.unproductiveTime);
    document.getElementById('neutralTime').textContent = formatTime(stats.neutralTime);
    
    // Update productivity score
    const scoreElement = document.getElementById('productivityScore');
    scoreElement.textContent = `${stats.productivityScore}%`;
    
    // Color code the score
    if (stats.productivityScore >= 70) {
        scoreElement.className = 'score-value productive';
    } else if (stats.productivityScore >= 40) {
        scoreElement.className = 'score-value neutral';
    } else {
        scoreElement.className = 'score-value unproductive';
    }
    
    // Update top sites list
    const topSitesList = document.getElementById('topSitesList');
    topSitesList.innerHTML = '';
    
    if (stats.sites.length === 0) {
        topSitesList.innerHTML = '<div style="text-align: center; opacity: 0.7; font-size: 13px;">No data available</div>';
        return;
    }
    
    stats.sites.forEach(site => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        
        const categoryColor = getCategoryColor(site.category);
        
        siteItem.innerHTML = `
            <div style="display: flex; align-items: center; flex: 1;">
                <div class="category-indicator" style="background-color: ${categoryColor};"></div>
                <div class="site-name" title="${site.domain}">${site.domain}</div>
            </div>
            <div class="site-time ${site.category}">${formatTime(site.time)}</div>
        `;
        
        topSitesList.appendChild(siteItem);
    });
}

function formatTime(milliseconds) {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

function getCategoryColor(category) {
    switch (category) {
        case 'productive':
            return '#4ade80';
        case 'unproductive':
            return '#f87171';
        default:
            return '#fbbf24';
    }
}

function openDashboard() {
    chrome.tabs.create({
        url: 'http://localhost:3000/dashboard'
    });
}

function openSettings() {
    chrome.tabs.create({
        url: chrome.runtime.getURL('settings.html')
    });
}