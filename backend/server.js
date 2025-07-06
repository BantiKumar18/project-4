const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('productivity.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL,
        date TEXT NOT NULL,
        time_spent INTEGER NOT NULL,
        category TEXT NOT NULL,
        visits INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS weekly_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start TEXT NOT NULL,
        total_time INTEGER NOT NULL,
        productive_time INTEGER NOT NULL,
        unproductive_time INTEGER NOT NULL,
        neutral_time INTEGER NOT NULL,
        productivity_score INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_domain_date ON time_entries(domain, date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_date ON time_entries(date)`);
});

// API Routes

// Track time entry
app.post('/api/track', (req, res) => {
    const { domain, timeSpent, date, category } = req.body;
    
    if (!domain || !timeSpent || !date || !category) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if entry exists for this domain and date
    db.get(
        'SELECT id, time_spent, visits FROM time_entries WHERE domain = ? AND date = ?',
        [domain, date],
        (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (row) {
                // Update existing entry
                db.run(
                    'UPDATE time_entries SET time_spent = ?, visits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [row.time_spent + timeSpent, row.visits + 1, row.id],
                    (err) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        res.json({ success: true, updated: true });
                    }
                );
            } else {
                // Create new entry
                db.run(
                    'INSERT INTO time_entries (domain, date, time_spent, category, visits) VALUES (?, ?, ?, ?, ?)',
                    [domain, date, timeSpent, category, 1],
                    (err) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        res.json({ success: true, created: true });
                    }
                );
            }
        }
    );
});

// Get today's data
app.get('/api/today', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    db.all(
        'SELECT * FROM time_entries WHERE date = ? ORDER BY time_spent DESC',
        [today],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const stats = calculateDayStats(rows);
            res.json({ data: rows, stats });
        }
    );
});

// Get weekly data
app.get('/api/week', (req, res) => {
    const { startDate } = req.query;
    let weekStart = startDate;
    
    if (!weekStart) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        weekStart = startOfWeek.toISOString().split('T')[0];
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    db.all(
        'SELECT * FROM time_entries WHERE date BETWEEN ? AND ? ORDER BY date, time_spent DESC',
        [weekStart, weekEndStr],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const weeklyData = processWeeklyData(rows);
            res.json(weeklyData);
        }
    );
});

// Get productivity analytics
app.get('/api/analytics', (req, res) => {
    const { period = 'week' } = req.query;
    
    let dateFilter = '';
    const today = new Date();
    
    if (period === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        dateFilter = `WHERE date >= '${weekAgo.toISOString().split('T')[0]}'`;
    } else if (period === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        dateFilter = `WHERE date >= '${monthAgo.toISOString().split('T')[0]}'`;
    }
    
    db.all(
        `SELECT date, category, SUM(time_spent) as total_time, COUNT(*) as site_count 
         FROM time_entries ${dateFilter} 
         GROUP BY date, category 
         ORDER BY date`,
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const analytics = processAnalyticsData(rows, period);
            res.json(analytics);
        }
    );
});

// Get weekly report
app.get('/api/report/weekly', (req, res) => {
    const { weekStart } = req.query;
    
    if (!weekStart) {
        return res.status(400).json({ error: 'Week start date required' });
    }
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    db.all(
        `SELECT domain, category, SUM(time_spent) as total_time, SUM(visits) as total_visits
         FROM time_entries 
         WHERE date BETWEEN ? AND ? 
         GROUP BY domain, category 
         ORDER BY total_time DESC`,
        [weekStart, weekEndStr],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            const report = generateWeeklyReport(rows, weekStart);
            
            // Store report in database
            storeWeeklyReport(report);
            
            res.json(report);
        }
    );
});

// Helper functions
function calculateDayStats(entries) {
    let totalTime = 0;
    let productiveTime = 0;
    let unproductiveTime = 0;
    let neutralTime = 0;
    
    entries.forEach(entry => {
        totalTime += entry.time_spent;
        
        switch (entry.category) {
            case 'productive':
                productiveTime += entry.time_spent;
                break;
            case 'unproductive':
                unproductiveTime += entry.time_spent;
                break;
            default:
                neutralTime += entry.time_spent;
        }
    });
    
    const productivityScore = totalTime > 0 ? 
        Math.round((productiveTime / totalTime) * 100) : 0;
    
    return {
        totalTime,
        productiveTime,
        unproductiveTime,
        neutralTime,
        productivityScore,
        totalSites: entries.length
    };
}

function processWeeklyData(entries) {
    const dailyData = {};
    const categoryTotals = { productive: 0, unproductive: 0, neutral: 0 };
    
    entries.forEach(entry => {
        if (!dailyData[entry.date]) {
            dailyData[entry.date] = {
                productive: 0,
                unproductive: 0,
                neutral: 0,
                sites: []
            };
        }
        
        dailyData[entry.date][entry.category] += entry.time_spent;
        dailyData[entry.date].sites.push(entry);
        categoryTotals[entry.category] += entry.time_spent;
    });
    
    const totalTime = Object.values(categoryTotals).reduce((sum, time) => sum + time, 0);
    const productivityScore = totalTime > 0 ? 
        Math.round((categoryTotals.productive / totalTime) * 100) : 0;
    
    return {
        dailyData,
        categoryTotals,
        totalTime,
        productivityScore
    };
}

function processAnalyticsData(rows, period) {
    const analytics = {
        period,
        dates: [],
        categories: {
            productive: [],
            unproductive: [],
            neutral: []
        },
        trends: {},
        insights: []
    };
    
    const dateGroups = {};
    
    rows.forEach(row => {
        if (!dateGroups[row.date]) {
            dateGroups[row.date] = { productive: 0, unproductive: 0, neutral: 0 };
        }
        dateGroups[row.date][row.category] = row.total_time;
    });
    
    const dates = Object.keys(dateGroups).sort();
    analytics.dates = dates;
    
    dates.forEach(date => {
        analytics.categories.productive.push(dateGroups[date].productive || 0);
        analytics.categories.unproductive.push(dateGroups[date].unproductive || 0);
        analytics.categories.neutral.push(dateGroups[date].neutral || 0);
    });
    
    // Generate insights
    analytics.insights = generateInsights(analytics);
    
    return analytics;
}

function generateWeeklyReport(entries, weekStart) {
    const stats = calculateDayStats(entries);
    const topSites = entries.slice(0, 10);
    
    const report = {
        weekStart,
        weekEnd: new Date(new Date(weekStart).getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        stats,
        topSites,
        recommendations: generateRecommendations(entries),
        createdAt: new Date().toISOString()
    };
    
    return report;
}

function generateInsights(analytics) {
    const insights = [];
    
    // Calculate average daily productivity
    const avgProductivity = analytics.categories.productive.reduce((sum, val) => sum + val, 0) / analytics.dates.length;
    const avgUnproductive = analytics.categories.unproductive.reduce((sum, val) => sum + val, 0) / analytics.dates.length;
    
    if (avgProductivity > avgUnproductive) {
        insights.push({
            type: 'positive',
            message: `Your productive time averages ${Math.round(avgProductivity / 60000)}m per day - great job!`
        });
    } else {
        insights.push({
            type: 'warning',
            message: `Consider reducing unproductive time (avg ${Math.round(avgUnproductive / 60000)}m/day)`
        });
    }
    
    // Find most productive day
    const productiveByDay = analytics.categories.productive;
    const maxProductiveIndex = productiveByDay.indexOf(Math.max(...productiveByDay));
    if (maxProductiveIndex !== -1) {
        insights.push({
            type: 'info',
            message: `${analytics.dates[maxProductiveIndex]} was your most productive day`
        });
    }
    
    return insights;
}

function generateRecommendations(entries) {
    const recommendations = [];
    
    const unproductiveSites = entries.filter(e => e.category === 'unproductive');
    const totalUnproductive = unproductiveSites.reduce((sum, site) => sum + site.time_spent, 0);
    
    if (totalUnproductive > 2 * 60 * 60 * 1000) { // More than 2 hours
        recommendations.push({
            type: 'time_management',
            message: 'Consider using website blockers during work hours to reduce distractions',
            priority: 'high'
        });
    }
    
    const productiveSites = entries.filter(e => e.category === 'productive');
    if (productiveSites.length < 3) {
        recommendations.push({
            type: 'productivity',
            message: 'Try to spend more time on learning and development platforms',
            priority: 'medium'
        });
    }
    
    return recommendations;
}

function storeWeeklyReport(report) {
    db.run(
        `INSERT OR REPLACE INTO weekly_reports 
         (week_start, total_time, productive_time, unproductive_time, neutral_time, productivity_score) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            report.weekStart,
            report.stats.totalTime,
            report.stats.productiveTime,
            report.stats.unproductiveTime,
            report.stats.neutralTime,
            report.stats.productivityScore
        ]
    );
}

// Serve dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Productivity Tracker Backend running on port ${PORT}`);
    console.log(`📊 Dashboard available at: http://localhost:${PORT}/dashboard`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed.');
        }
        process.exit(0);
    });
});