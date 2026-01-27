// Configuration
const CONFIG_KEY = 'consumption-tracker-config';
const DATA_FILE = 'consumption.json';

let config = {
    token: '',
    owner: '',
    repo: ''
};

let currentData = {
    entries: [],
    sha: null
};

let chart = null;

// ===== INITIALIZATION =====

window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    if (isConfigured()) {
        loadData();
    }
});

// ===== CONFIGURATION =====

function loadConfig() {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
        config = JSON.parse(saved);
        document.getElementById('github-token').value = config.token;
        document.getElementById('repo-owner').value = config.owner;
        document.getElementById('repo-name').value = config.repo;
        
        if (isConfigured()) {
            document.getElementById('config-section').classList.add('collapsed');
        }
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

async function saveData(entries) {
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

// ===== ENTRY MANAGEMENT =====

async function addEntry(category) {
    if (!isConfigured()) {
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

// ===== RENDERING =====

function renderAll() {
    renderEntries();
    updateChart();
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
        smoking: '🚬'
    };
    return emojis[category] || '📊';
}

// ===== CHART AND STATISTICS =====

function updateChart() {
    const period = parseInt(document.getElementById('time-period').value);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);
    
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
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Beer',
                    data: data.beer,
                    borderColor: '#FFB300',
                    backgroundColor: 'rgba(255, 179, 0, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Wine',
                    data: data.wine,
                    borderColor: '#C62828',
                    backgroundColor: 'rgba(198, 40, 40, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Liquor',
                    data: data.liquor,
                    borderColor: '#FF6F00',
                    backgroundColor: 'rgba(255, 111, 0, 0.1)',
                    tension: 0.3
                },
                {
                    label: 'Smoking',
                    data: data.smoking,
                    borderColor: '#616161',
                    backgroundColor: 'rgba(97, 97, 97, 0.1)',
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
    
    const total = stats.beer + stats.wine + stats.wine + stats.liquor + stats.smoking;
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
            <span class="stat-emoji">🚬</span>
            <span class="stat-label">Smoking:</span>
            <span class="stat-value">${stats.smoking}</span>
        </div>
        <div class="stat-item total">
            <span class="stat-emoji">📊</span>
            <span class="stat-label">Total:</span>
            <span class="stat-value">${total}</span>
        </div>
    `;
}
