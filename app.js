// Configuration
const CONFIG_KEY = 'consumption-tracker-config';
const DATA_FILE = 'consumption.json';
const LOCAL_DATA_KEY = 'consumption-tracker-local-data';
const MODE_KEY = 'consumption-tracker-mode';
const CHART_TYPE_KEY = 'consumption-tracker-chart-type';

let config = {
    token: '',
    owner: '',
    repo: '',
    mode: 'local' // 'local' or 'github'
};

let currentData = {
    entries: [],
    sha: null
};

let chart = null;

// ===== INITIALIZATION =====

window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadChartTypePreference();
    updateModeUI();
    if (config.mode === 'local' || isConfigured()) {
        loadData();
    }
});

// ===== CONFIGURATION =====

function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
        config = JSON.parse(saved);
        document.getElementById('github-token').value = config.token || '';
        document.getElementById('repo-owner').value = config.owner || '';
        document.getElementById('repo-name').value = config.repo || '';
        config.mode = config.mode || 'local';
        
        if (config.mode === 'local' || isConfigured()) {
            document.getElementById('config-section').classList.add('collapsed');
        }
    } else {
        config.mode = 'local';
    }
}

function saveConfig() {
    config.token = document.getElementById('github-token').value.trim();
    config.owner = document.getElementById('repo-owner').value.trim();
    config.repo = document.getElementById('repo-name').value.trim();
    
    if (!config.token || !config.owner || !config.repo) {
        showStatus('Please fill in all configuration fields', 'error');
        return;
    }
    
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    showStatus('Configuration saved!', 'success');
    document.getElementById('config-section').classList.add('collapsed');
    loadData();
}

function toggleConfig() {
    document.getElementById('config-section').classList.toggle('collapsed');
}

function isConfigured() {
    return config.token && config.owner && config.repo;
}

function loadChartTypePreference() {
    const savedType = localStorage.getItem(CHART_TYPE_KEY);
    if (savedType) {
        document.getElementById('chart-type').value = savedType;
    } else {
        document.getElementById('chart-type').value = 'bar';
    }
}

function updateChartType() {
    const chartType = document.getElementById('chart-type').value;
    localStorage.setItem(CHART_TYPE_KEY, chartType);
    updateChart();
}

function setMode(mode) {
    config.mode = mode;
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    updateModeUI();
    loadData();
}

function updateModeUI() {
    const isLocal = config.mode === 'local';
    
    // Update button states
    document.getElementById('mode-local').classList.toggle('active', isLocal);
    document.getElementById('mode-github').classList.toggle('active', !isLocal);
    
    // Show/hide relevant sections
    document.getElementById('github-config').style.display = isLocal ? 'none' : '';
    document.getElementById('local-controls').style.display = isLocal ? '' : 'none';
    document.getElementById('github-help').style.display = isLocal ? 'none' : '';
    document.getElementById('local-help').style.display = isLocal ? '' : 'none';
    
    // Auto-collapse config section when mode is configured
    if ((isLocal || isConfigured()) && !document.getElementById('config-section').classList.contains('collapsed')) {
        document.getElementById('config-section').classList.add('collapsed');
    }
}

function generateDummyData() {
    const categories = ['beer', 'wine', 'liquor', 'smoking'];
    const entries = [];
    
    // Generate data for the last 30 days
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        // Random number of entries per day (0-5)
        const numEntries = Math.floor(Math.random() * 6);
        
        for (let j = 0; j < numEntries; j++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const hour = Math.floor(Math.random() * 14) + 10; // Between 10:00 and 23:59
            const minute = Math.floor(Math.random() * 60);
            
            date.setHours(hour, minute, 0, 0);
            
            entries.push({
                id: `${date.getTime()}-${j}`,
                timestamp: date.toISOString(),
                category: category
            });
        }
    }
    
    currentData.entries = entries;
    saveDataLocal();
    showStatus('Sample data generated!', 'success');
}

function clearLocalData() {
    if (!confirm('Are you sure you want to clear all local data?')) {
        return;
    }
    
    currentData.entries = [];
    localStorage.removeItem(LOCAL_DATA_KEY);
    renderAll();
    showStatus('All data cleared', 'success');
}

// ===== STATUS MESSAGES =====

function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }
}

// ===== GITHUB API =====

async function githubRequest(method, endpoint, body = null) {
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${endpoint}`;
    
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${config.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} - ${errorText}`);
    }
    
    return response.json();
}

async function loadData() {
    if (config.mode === 'local') {
        loadDataLocal();
        return;
    }
    
    if (!isConfigured()) {
        showStatus('Please configure GitHub settings first', 'error');
        return;
    }
    
    try {
        showStatus('Loading data...', 'info');
        const data = await githubRequest('GET', DATA_FILE);
        const content = JSON.parse(atob(data.content));
        
        currentData = {
            entries: content.entries || [],
            sha: data.sha
        };
        
        renderAll();
        showStatus('Data loaded successfully', 'success');
    } catch (error) {
        if (error.message.includes('404')) {
            // File doesn't exist, create it
            await saveData([]);
        } else {
            showStatus(`Error loading data: ${error.message}`, 'error');
            console.error('Load error:', error);
        }
    }
}

function loadDataLocal() {
    const saved = localStorage.getItem(LOCAL_DATA_KEY);
    if (saved) {
        currentData = JSON.parse(saved);
    } else {
        currentData = { entries: [], sha: null };
    }
    renderAll();
}

async function saveData(entries) {
    if (config.mode === 'local') {
        currentData.entries = entries;
        saveDataLocal();
        return;
    }
    
    const content = btoa(JSON.stringify({ entries }, null, 2));
    
    const body = {
        message: `Update consumption data - ${new Date().toISOString()}`,
        content: content
    };
    
    if (currentData.sha) {
        body.sha = currentData.sha;
    }
    
    try {
        showStatus('Saving...', 'info');
        const response = await githubRequest('PUT', DATA_FILE, body);
        
        currentData = {
            entries: entries,
            sha: response.content.sha
        };
        
        renderAll();
        showStatus('Saved successfully', 'success');
    } catch (error) {
        showStatus(`Error saving: ${error.message}`, 'error');
        console.error('Save error:', error);
    }
}

function saveDataLocal() {
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(currentData));
    renderAll();
    showStatus('Saved locally', 'success');
}

// ===== ENTRY MANAGEMENT =====

async function addEntry(category) {
    if (config.mode !== 'local' && !isConfigured()) {
        showStatus('Please configure GitHub settings first', 'error');
        return;
    }
    
    const entry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        category: category
    };
    
    const updatedEntries = [...currentData.entries, entry];
    await saveData(updatedEntries);
}

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) {
        return;
    }
    
    const updatedEntries = currentData.entries.filter(e => e.id !== id);
    await saveData(updatedEntries);
}

// ===== TAB MANAGEMENT =====

function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Render the content for the selected tab
    if (tabName === 'table') {
        renderTableView();
    } else if (tabName === 'overview') {
        renderOverview();
    }
}

// ===== RENDERING =====

function renderAll() {
    renderEntries();
    updateChart();
    // Re-render active tab content
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.textContent.includes('Table')) {
        renderTableView();
    } else if (activeTab && activeTab.textContent.includes('Overview')) {
        renderOverview();
    }
}

function renderEntries() {
    const container = document.getElementById('entries-list');
    
    if (currentData.entries.length === 0) {
        container.innerHTML = '<p class="empty-message">No entries yet. Click a category button to start tracking!</p>';
        return;
    }
    
    // Sort by timestamp, newest first
    const sortedEntries = [...currentData.entries].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    container.innerHTML = sortedEntries.map(entry => {
        const date = new Date(entry.timestamp);
        const formatted = formatDateTime(date);
        const emoji = getCategoryEmoji(entry.category);
        const categoryName = entry.category.charAt(0).toUpperCase() + entry.category.slice(1);
        
        return `
            <div class="entry-item ${entry.category}">
                <span class="entry-text">${emoji} ${categoryName} - ${formatted}</span>
                <button onclick="deleteEntry('${entry.id}')" class="btn-delete">Delete</button>
            </div>
        `;
    }).join('');
}

function formatDateTime(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

function getCategoryEmoji(category) {
    const emojis = {
        beer: '🍺',
        wine: '🍷',
        liquor: '🥃',
        smoking: '💨'
    };
    return emojis[category] || '📊';
}

// ===== CHART AND STATISTICS =====

function updateChart() {
    const period = parseInt(document.getElementById('time-period').value);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Include entire current day
    let startDate = new Date();
    
    // If there are entries, set the start date based on the first entry
    if (currentData.entries.length > 0) {
        const sortedEntries = [...currentData.entries].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        const firstEntryDate = new Date(sortedEntries[0].timestamp);
        firstEntryDate.setHours(0, 0, 0, 0);
        
        // Calculate the end of the period from the first entry
        const periodEndDate = new Date(firstEntryDate);
        periodEndDate.setDate(periodEndDate.getDate() + period - 1);
        
        // Use the first entry date as start, and the minimum of period end or today as end
        startDate = firstEntryDate;
        if (periodEndDate < endDate) {
            endDate.setTime(periodEndDate.getTime());
        }
    } else {
        // If no entries, use the default period from today
        startDate.setDate(startDate.getDate() - period);
    }
    
    // Filter entries by date range
    const filteredEntries = currentData.entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
    });
    
    // Aggregate data
    let aggregatedData;
    if (period <= 30) {
        // Daily aggregation for 7 and 30 days
        aggregatedData = aggregateByDay(filteredEntries, startDate, endDate);
    } else {
        // Weekly aggregation for 90 and 365 days
        aggregatedData = aggregateByWeek(filteredEntries, startDate, endDate);
    }
    
    renderChart(aggregatedData, period);
    renderSummaryStats(filteredEntries);
}

function aggregateByDay(entries, startDate, endDate) {
    const data = {
        labels: [],
        beer: [],
        wine: [],
        liquor: [],
        smoking: []
    };
    
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        data.labels.push(formatChartLabel(current, false));
        
        const dayEntries = entries.filter(e => {
            const entryDate = new Date(e.timestamp);
            return entryDate.toISOString().split('T')[0] === dateStr;
        });
        
        data.beer.push(dayEntries.filter(e => e.category === 'beer').length);
        data.wine.push(dayEntries.filter(e => e.category === 'wine').length);
        data.liquor.push(dayEntries.filter(e => e.category === 'liquor').length);
        data.smoking.push(dayEntries.filter(e => e.category === 'smoking').length);
        
        current.setDate(current.getDate() + 1);
    }
    
    return data;
}

function aggregateByWeek(entries, startDate, endDate) {
    const data = {
        labels: [],
        beer: [],
        wine: [],
        liquor: [],
        smoking: []
    };
    
    // Start from the beginning of the week
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - dayOfWeek); // Go to Sunday
    
    while (current <= endDate) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        data.labels.push(formatChartLabel(current, true));
        
        const weekEntries = entries.filter(e => {
            const entryDate = new Date(e.timestamp);
            return entryDate >= current && entryDate <= weekEnd;
        });
        
        data.beer.push(weekEntries.filter(e => e.category === 'beer').length);
        data.wine.push(weekEntries.filter(e => e.category === 'wine').length);
        data.liquor.push(weekEntries.filter(e => e.category === 'liquor').length);
        data.smoking.push(weekEntries.filter(e => e.category === 'smoking').length);
        
        current.setDate(current.getDate() + 7);
    }
    
    return data;
}

function formatChartLabel(date, isWeek) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (isWeek) {
        return `${months[date.getMonth()]} ${date.getDate()}`;
    } else {
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
}

function renderChart(data, period) {
    const ctx = document.getElementById('consumptionChart').getContext('2d');
    
    if (chart) {
        chart.destroy();
    }
    
    const chartType = document.getElementById('chart-type').value;
    const isBar = chartType === 'bar';
    
    chart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Beer',
                    data: data.beer,
                    borderColor: '#FFB300',
                    backgroundColor: isBar ? '#FFB300' : 'rgba(255, 179, 0, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Wine',
                    data: data.wine,
                    borderColor: '#C62828',
                    backgroundColor: isBar ? '#C62828' : 'rgba(198, 40, 40, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Liquor',
                    data: data.liquor,
                    borderColor: '#FF6F00',
                    backgroundColor: isBar ? '#FF6F00' : 'rgba(255, 111, 0, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Hookah',
                    data: data.smoking,
                    borderColor: '#616161',
                    backgroundColor: isBar ? '#616161' : 'rgba(97, 97, 97, 0.1)',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: period <= 30 ? 'Date' : 'Week Starting'
                    }
                }
            }
        }
    });
}

function renderSummaryStats(entries) {
    const stats = {
        beer: entries.filter(e => e.category === 'beer').length,
        wine: entries.filter(e => e.category === 'wine').length,
        liquor: entries.filter(e => e.category === 'liquor').length,
        smoking: entries.filter(e => e.category === 'smoking').length
    };
    
    const total = stats.beer + stats.wine + stats.liquor + stats.smoking;
    const period = document.getElementById('time-period').value;
    
    const container = document.getElementById('summary-stats');
    container.innerHTML = `
        <div class="stat-item">
            <span class="stat-emoji">🍺</span>
            <span class="stat-label">Beer:</span>
            <span class="stat-value">${stats.beer}</span>
        </div>
        <div class="stat-item">
            <span class="stat-emoji">🍷</span>
            <span class="stat-label">Wine:</span>
            <span class="stat-value">${stats.wine}</span>
        </div>
        <div class="stat-item">
            <span class="stat-emoji">🥃</span>
            <span class="stat-label">Liquor:</span>
            <span class="stat-value">${stats.liquor}</span>
        </div>
        <div class="stat-item">
            <span class="stat-emoji">💨</span>
            <span class="stat-label">Hookah:</span>
            <span class="stat-value">${stats.smoking}</span>
        </div>
        <div class="stat-item total">
            <span class="stat-emoji">📊</span>
            <span class="stat-label">Total:</span>
            <span class="stat-value">${total}</span>
        </div>
    `;
}
// ===== TABLE VIEW =====

function renderTableView() {
    const period = parseInt(document.getElementById('time-period').value);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Include entire current day
    let startDate = new Date();
    
    // Use the same date logic as the chart
    if (currentData.entries.length > 0) {
        const sortedEntries = [...currentData.entries].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        const firstEntryDate = new Date(sortedEntries[0].timestamp);
        firstEntryDate.setHours(0, 0, 0, 0);
        
        const periodEndDate = new Date(firstEntryDate);
        periodEndDate.setDate(periodEndDate.getDate() + period - 1);
        
        startDate = firstEntryDate;
        if (periodEndDate < endDate) {
            endDate.setTime(periodEndDate.getTime());
        }
    } else {
        startDate.setDate(startDate.getDate() - period);
    }
    
    // Filter entries by date range
    const filteredEntries = currentData.entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
    });
    
    // Aggregate by day
    const dailyData = [];
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);
    
    while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0];
        
        const dayEntries = filteredEntries.filter(e => {
            const entryDate = new Date(e.timestamp);
            return entryDate.toISOString().split('T')[0] === dateStr;
        });
        
        const beer = dayEntries.filter(e => e.category === 'beer').length;
        const wine = dayEntries.filter(e => e.category === 'wine').length;
        const liquor = dayEntries.filter(e => e.category === 'liquor').length;
        const smoking = dayEntries.filter(e => e.category === 'smoking').length;
        const total = beer + wine + liquor + smoking;
        
        if (total > 0) {
            dailyData.push({
                date: new Date(current),
                beer,
                wine,
                liquor,
                smoking,
                total
            });
        }
        
        current.setDate(current.getDate() + 1);
    }
    
    // Render table
    const tbody = document.getElementById('table-body');
    
    if (dailyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #999;">No data for this period</td></tr>';
        return;
    }
    
    tbody.innerHTML = dailyData.reverse().map(day => {
        const dayOfWeek = day.date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const rowClass = isWeekend ? 'row-weekend' : '';
        
        return `
            <tr class="${rowClass}">
                <td>${formatTableDate(day.date)}</td>
                <td>${day.beer || '-'}</td>
                <td>${day.wine || '-'}</td>
                <td>${day.liquor || '-'}</td>
                <td>${day.smoking || '-'}</td>
                <td class="total-cell">${day.total}</td>
            </tr>
        `;
    }).join('');
}

function formatTableDate(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// ===== OVERVIEW VIEW =====

function renderOverview() {
    const period = parseInt(document.getElementById('time-period').value);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // Include entire current day
    let startDate = new Date();
    
    // Use the same date logic as the chart
    if (currentData.entries.length > 0) {
        const sortedEntries = [...currentData.entries].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        const firstEntryDate = new Date(sortedEntries[0].timestamp);
        firstEntryDate.setHours(0, 0, 0, 0);
        
        const periodEndDate = new Date(firstEntryDate);
        periodEndDate.setDate(periodEndDate.getDate() + period - 1);
        
        startDate = firstEntryDate;
        if (periodEndDate < endDate) {
            endDate.setTime(periodEndDate.getTime());
        }
    } else {
        startDate.setDate(startDate.getDate() - period);
    }
    
    // Filter entries by date range
    const filteredEntries = currentData.entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
    });
    
    // Separate weekday and weekend entries
    const weekdayEntries = filteredEntries.filter(entry => {
        const day = new Date(entry.timestamp).getDay();
        return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
    });
    
    const weekendEntries = filteredEntries.filter(entry => {
        const day = new Date(entry.timestamp).getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    });
    
    // Calculate statistics
    const stats = {
        beer: filteredEntries.filter(e => e.category === 'beer').length,
        wine: filteredEntries.filter(e => e.category === 'wine').length,
        liquor: filteredEntries.filter(e => e.category === 'liquor').length,
        smoking: filteredEntries.filter(e => e.category === 'smoking').length
    };
    
    const weekdayStats = {
        beer: weekdayEntries.filter(e => e.category === 'beer').length,
        wine: weekdayEntries.filter(e => e.category === 'wine').length,
        liquor: weekdayEntries.filter(e => e.category === 'liquor').length,
        smoking: weekdayEntries.filter(e => e.category === 'smoking').length
    };
    
    const weekendStats = {
        beer: weekendEntries.filter(e => e.category === 'beer').length,
        wine: weekendEntries.filter(e => e.category === 'wine').length,
        liquor: weekendEntries.filter(e => e.category === 'liquor').length,
        smoking: weekendEntries.filter(e => e.category === 'smoking').length
    };
    
    const total = stats.beer + stats.wine + stats.liquor + stats.smoking;
    const weekdayTotal = weekdayStats.beer + weekdayStats.wine + weekdayStats.liquor + weekdayStats.smoking;
    const weekendTotal = weekendStats.beer + weekendStats.wine + weekendStats.liquor + weekendStats.smoking;
    
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Calculate number of weekdays and weekend days
    let weekdayCount = 0;
    let weekendCount = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
        const day = current.getDay();
        if (day === 0 || day === 6) {
            weekendCount++;
        } else {
            weekdayCount++;
        }
        current.setDate(current.getDate() + 1);
    }
    
    // Calculate averages per category
    const dailyAvg = {
        beer: days > 0 ? (stats.beer / days).toFixed(1) : 0,
        wine: days > 0 ? (stats.wine / days).toFixed(1) : 0,
        liquor: days > 0 ? (stats.liquor / days).toFixed(1) : 0,
        smoking: days > 0 ? (stats.smoking / days).toFixed(1) : 0
    };
    
    // Render overview cards
    const container = document.getElementById('overview-grid');
    container.innerHTML = `
        <div class="overview-card beer">
            <h3>🍺 Beer</h3>
            <div class="value">${stats.beer}</div>
            <div class="label">${dailyAvg.beer} per day average</div>
        </div>
        
        <div class="overview-card wine">
            <h3>🍷 Wine</h3>
            <div class="value">${stats.wine}</div>
            <div class="label">${dailyAvg.wine} per day average</div>
        </div>
        
        <div class="overview-card liquor">
            <h3>🥃 Liquor</h3>
            <div class="value">${stats.liquor}</div>
            <div class="label">${dailyAvg.liquor} per day average</div>
        </div>
        
        <div class="overview-card smoking">
            <h3>💨 Hookah</h3>
            <div class="value">${stats.smoking}</div>
            <div class="label">${dailyAvg.smoking} per day average</div>
        </div>
        
        <div class="overview-card total">
            <h3>Total Consumption</h3>
            <div class="value">${total}</div>
            <div class="label">${days} days tracked</div>
        </div>
        
        <div class="overview-card weekday">
            <h3>📅 Weekdays</h3>
            <div class="value">${weekdayTotal}</div>
            <div class="label">${weekdayCount} days · ${(weekdayTotal / (weekdayCount || 1)).toFixed(1)} per day</div>
            <div class="breakdown">
                🍺 ${weekdayStats.beer} · 🍷 ${weekdayStats.wine} · 🥃 ${weekdayStats.liquor} · 💨 ${weekdayStats.smoking}
            </div>
        </div>
        
        <div class="overview-card weekend">
            <h3>🎉 Weekend</h3>
            <div class="value">${weekendTotal}</div>
            <div class="label">${weekendCount} days · ${(weekendTotal / (weekendCount || 1)).toFixed(1)} per day</div>
            <div class="breakdown">
                🍺 ${weekendStats.beer} · 🍷 ${weekendStats.wine} · 🥃 ${weekendStats.liquor} · 💨 ${weekendStats.smoking}
            </div>
        </div>
    `;
}