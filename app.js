// Configuration
const CONFIG_KEY = 'consumption-tracker-config';
const DATA_FILE = 'consumption.json';
const LOCAL_DATA_KEY = 'consumption-tracker-local-data';
const MODE_KEY = 'consumption-tracker-mode';
const CHART_TYPE_KEY = 'consumption-tracker-chart-type';
const TIME_PERIOD_KEY = 'consumption-tracker-time-period';
const CHART_COLLAPSED_KEY = 'consumption-tracker-chart-collapsed';

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
let daysChart = null;

// ===== INITIALIZATION =====

window.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadChartTypePreference();
    loadTimePeriodPreference();
    loadChartCollapsedPreference();
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

function toggleChart() {
    const section = document.getElementById('chart-section');
    section.classList.toggle('collapsed');
    localStorage.setItem(CHART_COLLAPSED_KEY, section.classList.contains('collapsed'));
}

function loadChartCollapsedPreference() {
    const isCollapsed = localStorage.getItem(CHART_COLLAPSED_KEY) === 'true';
    if (isCollapsed) {
        document.getElementById('chart-section').classList.add('collapsed');
    }
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

function loadTimePeriodPreference() {
    const savedPeriod = localStorage.getItem(TIME_PERIOD_KEY);
    if (savedPeriod) {
        document.getElementById('time-period').value = savedPeriod;
    } else {
        document.getElementById('time-period').value = '12';
    }
}

function updateTimePeriod() {
    const period = document.getElementById('time-period').value;
    localStorage.setItem(TIME_PERIOD_KEY, period);
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
    if (currentModalDate) renderDayModalEntries(currentModalDate);
}

// ===== DAY MODAL =====

let currentModalDate = null;

function openDayModal(dateStr) {
    currentModalDate = dateStr;
    const date = new Date(dateStr + 'T12:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    document.getElementById('day-modal-title').textContent =
        `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    renderDayModalEntries(dateStr);
    document.getElementById('day-modal-overlay').classList.add('open');
}

function renderDayModalEntries(dateStr) {
    const entries = currentData.entries
        .filter(e => getLocalDateString(new Date(e.timestamp)) === dateStr)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const container = document.getElementById('day-modal-entries');
    if (entries.length === 0) {
        container.innerHTML = '<p class="modal-empty">No entries for this day.</p>';
        return;
    }
    container.innerHTML = entries.map(entry => `
        <div class="modal-entry ${entry.category}">
            <span>${getCategoryEmoji(entry.category)} ${getCategoryDisplayName(entry.category)} &ndash; ${formatTime(new Date(entry.timestamp))}</span>
            <button onclick="deleteEntry('${entry.id}')" class="btn-delete">✕</button>
        </div>
    `).join('');
}

function closeDayModal(event) {
    if (event && event.target !== document.getElementById('day-modal-overlay')) return;
    document.getElementById('day-modal-overlay').classList.remove('open');
    currentModalDate = null;
}

async function addEntryForDate(category) {
    if (config.mode !== 'local' && !isConfigured()) {
        showStatus('Please configure GitHub settings first', 'error');
        return;
    }
    const dateStr = currentModalDate;
    const todayStr = getLocalDateString(new Date());
    let timestamp;
    if (dateStr === todayStr) {
        timestamp = new Date().toISOString();
    } else {
        // Use noon of the selected day
        timestamp = new Date(dateStr + 'T12:00:00').toISOString();
    }
    const entry = { id: Date.now().toString(), timestamp, category };
    const updatedEntries = [...currentData.entries, entry];
    await saveData(updatedEntries);
    renderDayModalEntries(dateStr);
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
    if (tabName === 'overview') {
        renderOverview();
    }
}

// ===== RENDERING =====

function renderAll() {
    renderEntries();
    updateChart();
    // Re-render active tab content
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.textContent.includes('Overview')) {
        renderOverview();
    }
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday = start
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function renderEntries() {
    const container = document.getElementById('entries-list');

    if (currentData.entries.length === 0) {
        container.innerHTML = '<p class="empty-message">No entries yet. Click a category button to start tracking!</p>';
        return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayStr = getLocalDateString(new Date());
    const currentWeekKey = getLocalDateString(getWeekStart(new Date()));

    // Group entries by week
    const weekGroups = {};
    currentData.entries.forEach(entry => {
        const weekStart = getWeekStart(new Date(entry.timestamp));
        const weekKey = getLocalDateString(weekStart);
        if (!weekGroups[weekKey]) {
            weekGroups[weekKey] = { weekStart, entries: [] };
        }
        weekGroups[weekKey].entries.push(entry);
    });

    const sortedWeeks = Object.keys(weekGroups).sort((a, b) => new Date(b) - new Date(a));

    container.innerHTML = sortedWeeks.map(weekKey => {
        const { weekStart, entries } = weekGroups[weekKey];
        const isCurrentWeek = weekKey === currentWeekKey;
        const isCollapsed = !isCurrentWeek;

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekLabel = `${months[weekStart.getMonth()]} ${weekStart.getDate()} – ${months[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;

        // Week-level category counts for header summary
        const weekCounts = { beer: 0, wine: 0, liquor: 0, smoking: 0 };
        entries.forEach(e => { if (weekCounts[e.category] !== undefined) weekCounts[e.category]++; });
        const weekSummary = buildCategorySummary(weekCounts);

        // Build day map for the 7 days of this week
        const dayMap = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            dayMap[getLocalDateString(d)] = { date: d, entries: [] };
        }
        entries.forEach(entry => {
            const key = getLocalDateString(new Date(entry.timestamp));
            if (dayMap[key]) dayMap[key].entries.push(entry);
        });

        const daycards = Object.values(dayMap).map(({ date, entries: dayEntries }) => {
            const dayKey = getLocalDateString(date);
            const isToday = dayKey === todayStr;
            const isEmpty = dayEntries.length === 0;

            const counts = { beer: 0, wine: 0, liquor: 0, smoking: 0 };
            dayEntries.forEach(e => { if (counts[e.category] !== undefined) counts[e.category]++; });

            const jsDay = date.getDay();
            const dayNameIdx = jsDay === 0 ? 6 : jsDay - 1;

            const summaryHtml = !isEmpty
                ? `<div class="day-summary">${buildCategorySummary(counts)}</div>`
                : '';

            return `
                <div class="day-card${isToday ? ' today' : ''}${isEmpty ? ' empty' : ''}" onclick="openDayModal('${dayKey}')">
                    <div class="day-card-header">
                        <span class="day-name">${dayNames[dayNameIdx]}</span>
                        <span class="day-date-num">${date.getDate()}</span>
                        <span class="day-month-year">${months[date.getMonth()]} ${date.getFullYear()}</span>
                    </div>
                    ${summaryHtml}
                </div>
            `;
        }).join('');

        return `
            <div class="week-row${isCollapsed ? ' collapsed' : ''}" id="week-${weekKey}">
                <div class="week-header" onclick="toggleWeekRow('${weekKey}')">
                    <span class="week-label">${weekLabel}</span>
                    <span class="week-summary">${weekSummary}</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="week-content">
                    <div class="week-days">${daycards}</div>
                </div>
            </div>
        `;
    }).join('');
}

function buildCategorySummary(counts) {
    const parts = [];
    if (counts.beer > 0) parts.push(`${counts.beer}🍺`);
    if (counts.wine > 0) parts.push(`${counts.wine}🍷`);
    if (counts.liquor > 0) parts.push(`${counts.liquor}🥃`);
    if (counts.smoking > 0) parts.push(`${counts.smoking}💨`);
    return parts.length ? `<span class="cat-pill">${parts.join('|')}</span>` : '';
}

function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

function toggleWeekRow(weekKey) {
    const row = document.getElementById(`week-${weekKey}`);
    if (row) row.classList.toggle('collapsed');
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

function getCategoryDisplayName(category) {
    const displayNames = {
        beer: 'Beer',
        wine: 'Wine',
        liquor: 'Liquor',
        smoking: 'Hookah'
    };
    return displayNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ===== CHART AND STATISTICS =====

function formatChartLabel(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

function updateChart() {
    const numWeeks = parseInt(document.getElementById('time-period').value);

    // Start from the Monday of (currentWeek - numWeeks + 1)
    const todayWeekStart = getWeekStart(new Date());
    const startDate = new Date(todayWeekStart);
    startDate.setDate(startDate.getDate() - (numWeeks - 1) * 7);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(todayWeekStart);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const filteredEntries = currentData.entries.filter(entry => {
        const entryDate = new Date(entry.timestamp);
        return entryDate >= startDate && entryDate <= endDate;
    });

    const aggregatedData = aggregateByWeek(filteredEntries, startDate, endDate);

    renderUnitsChart(aggregatedData);
    renderDaysChart(aggregatedData);
    renderSummaryStats(filteredEntries);
}

function aggregateByWeek(entries, startDate, endDate) {
    const data = {
        labels: [],
        units: { beer: [], wine: [], liquor: [], smoking: [] },
        days: { beer: [], wine: [], liquor: [], smoking: [] }
    };

    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        data.labels.push(formatChartLabel(current));

        const weekEntries = entries.filter(e => {
            const d = new Date(e.timestamp);
            return d >= current && d <= weekEnd;
        });

        ['beer', 'wine', 'liquor', 'smoking'].forEach(cat => {
            const catEntries = weekEntries.filter(e => e.category === cat);
            data.units[cat].push(catEntries.length);
            const distinctDays = new Set(catEntries.map(e => getLocalDateString(new Date(e.timestamp)))).size;
            data.days[cat].push(distinctDays);
        });

        current.setDate(current.getDate() + 7);
    }

    return data;
}

function buildDatasets(dataObj, isBar) {
    return [
        {
            label: 'Beer',
            data: dataObj.beer,
            borderColor: '#FFB300',
            backgroundColor: isBar ? '#FFB300' : 'rgba(255, 179, 0, 0.1)',
            tension: 0.3
        },
        {
            label: 'Wine',
            data: dataObj.wine,
            borderColor: '#C62828',
            backgroundColor: isBar ? '#C62828' : 'rgba(198, 40, 40, 0.1)',
            tension: 0.3
        },
        {
            label: 'Liquor',
            data: dataObj.liquor,
            borderColor: '#FF6F00',
            backgroundColor: isBar ? '#FF6F00' : 'rgba(255, 111, 0, 0.1)',
            tension: 0.3
        },
        {
            label: 'Hookah',
            data: dataObj.smoking,
            borderColor: '#616161',
            backgroundColor: isBar ? '#616161' : 'rgba(97, 97, 97, 0.1)',
            tension: 0.3
        }
    ];
}

function renderUnitsChart(data) {
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
            datasets: buildDatasets(data.units, isBar)
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false },
                title: { display: true, text: 'Units Consumed per Week', font: { size: 14 } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: 'Units' }
                },
                x: {
                    title: { display: false }
                }(data) {
    const ctx = document.getElementById('daysChart').getContext('2d');

    if (daysChart) {
        daysChart.destroy();
    }

    const chartType = document.getElementById('chart-type').value;
    const isBar = chartType === 'bar';

    daysChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: data.labels,
            datasets: buildDatasets(data.days, isBar)
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' },
                tooltip: { mode: 'index', intersect: false },
                title: { display: true, text: 'Days Consumed per Week', font: { size: 14 } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 7,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: 'Days' }
                },
                x: {
                    title: { display: false }
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


// ===== OVERVIEW VIEW =====

function renderOverview() {
    const today = new Date();

    // Get current week (Monday to Sunday)
    const currentWeekStart = new Date(today);
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day); // Adjust for Sunday (0) being at the end of the week
    currentWeekStart.setDate(today.getDate() + diff);
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    // Get previous week (Monday to Sunday)
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    previousWeekStart.setHours(0, 0, 0, 0);

    const previousWeekEnd = new Date(previousWeekStart);
    previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
    previousWeekEnd.setHours(23, 59, 59, 999);

    // Get week before previous (Monday to Sunday)
    const weekBeforePreviousStart = new Date(previousWeekStart);
    weekBeforePreviousStart.setDate(previousWeekStart.getDate() - 7);
    weekBeforePreviousStart.setHours(0, 0, 0, 0);

    const weekBeforePreviousEnd = new Date(weekBeforePreviousStart);
    weekBeforePreviousEnd.setDate(weekBeforePreviousStart.getDate() + 6);
    weekBeforePreviousEnd.setHours(23, 59, 59, 999);

    const categories = {
        drinking: ['beer', 'wine', 'liquor'],
        hookah: ['smoking']
    };

    function getStats(startDate, endDate, categoryList) {
        const filtered = currentData.entries.filter(entry => {
            const d = new Date(entry.timestamp);
            return d >= startDate && d <= endDate && categoryList.includes(entry.category);
        });

        const weekdays = filtered.filter(entry => {
            const day = new Date(entry.timestamp).getDay();
            return day !== 0 && day !== 6;
        });

        const weekends = filtered.filter(entry => {
            const day = new Date(entry.timestamp).getDay();
            return day === 0 || day === 6;
        });

        return {
            total: filtered.length,
            weekdays: weekdays.length,
            weekends: weekends.length
        };
    }

    const drinkingStats = {
        current: getStats(currentWeekStart, currentWeekEnd, categories.drinking),
        previous: getStats(previousWeekStart, previousWeekEnd, categories.drinking),
        weekBeforePrevious: getStats(weekBeforePreviousStart, weekBeforePreviousEnd, categories.drinking)
    };

    const hookahStats = {
        current: getStats(currentWeekStart, currentWeekEnd, categories.hookah),
        previous: getStats(previousWeekStart, previousWeekEnd, categories.hookah),
        weekBeforePrevious: getStats(weekBeforePreviousStart, weekBeforePreviousEnd, categories.hookah)
    };

    function calculateChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    function renderChangeTag(current, previous, compact = false) {
        const change = calculateChange(current, previous);
        const isBetter = change < 0; // Less consumption is better
        const isWorse = change > 0;
        const absChange = Math.abs(change).toFixed(0);

        let statusClass = 'neutral';
        let icon = '•';
        if (isBetter) {
            statusClass = 'success';
            icon = '↓';
        } else if (isWorse) {
            statusClass = 'danger';
            icon = '↑';
        }

        return `
            <div class="change-tag ${statusClass}">
                <span class="icon">${icon}</span>
                ${absChange}% ${compact ? '' : 'vs prev.'}
            </div>
        `;
    }

    function formatDateRange(start, end) {
        const options = { month: 'short', day: 'numeric' };
        return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
    }

    const currentVsPrevText = `${formatDateRange(currentWeekStart, currentWeekEnd)} vs ${formatDateRange(previousWeekStart, previousWeekEnd)}`;
    const prevVsBeforeTrendText = `${formatDateRange(previousWeekStart, previousWeekEnd)} vs ${formatDateRange(weekBeforePreviousStart, weekBeforePreviousEnd)}`;

    function generateSectionHtml(title, emoji, stats, typeClass) {
        // Only show historical trend if there's any data in those weeks (or if user requested)
        const hasHistory = stats.previous.total > 0 || stats.weekBeforePrevious.total > 0;

        return `
            <div class="category-stats-group ${typeClass}">
                <div class="group-header">
                    <h2>${emoji} ${title} Overview</h2>
                    <p class="date-range-sub">${currentVsPrevText}</p>
                </div>
                <div class="stats-main-grid">
                    <div class="main-stat-card">
                        <div class="label">Current Week Total</div>
                        <div class="value">${stats.current.total}</div>
                        ${renderChangeTag(stats.current.total, stats.previous.total)}
                    </div>
                    <div class="comparison-grid">
                        <div class="comparison-card">
                            <div class="label">Weekdays</div>
                            <div class="current-value">${stats.current.weekdays}</div>
                            ${renderChangeTag(stats.current.weekdays, stats.previous.weekdays)}
                        </div>
                        <div class="comparison-card">
                            <div class="label">Weekends</div>
                            <div class="current-value">${stats.current.weekends}</div>
                            ${renderChangeTag(stats.current.weekends, stats.previous.weekends)}
                        </div>
                        <div class="comparison-card">
                            <div class="label">Units/Day Avg</div>
                            <div class="current-value">${(stats.current.total / 7).toFixed(1)}</div>
                            ${renderChangeTag(stats.current.total / 7, stats.previous.total / 7)}
                        </div>
                    </div>
                </div>

                ${hasHistory ? `
                <div class="secondary-comparison-row">
                    <div class="row-label">Historical Trend: ${prevVsBeforeTrendText}</div>
                    <div class="trend-grid">
                        <div class="trend-card">
                            <div class="label">Prev. Week Total</div>
                            <div class="value">${stats.previous.total}</div>
                            ${renderChangeTag(stats.previous.total, stats.weekBeforePrevious.total, true)}
                        </div>
                        <div class="trend-card">
                            <div class="label">Prev. Weekdays</div>
                            <div class="value">${stats.previous.weekdays}</div>
                            ${renderChangeTag(stats.previous.weekdays, stats.weekBeforePrevious.weekdays, true)}
                        </div>
                        <div class="trend-card">
                            <div class="label">Prev. Weekends</div>
                            <div class="value">${stats.previous.weekends}</div>
                            ${renderChangeTag(stats.previous.weekends, stats.weekBeforePrevious.weekends, true)}
                        </div>
                        <div class="trend-card">
                            <div class="label">Prev. Units/Day</div>
                            <div class="value">${(stats.previous.total / 7).toFixed(1)}</div>
                            ${renderChangeTag(stats.previous.total / 7, stats.weekBeforePrevious.total / 7, true)}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    const container = document.getElementById('overview-grid');
    container.className = 'overview-sections'; // Update class for new layout
    container.innerHTML = `
        ${generateSectionHtml('Drinking', '🍷', drinkingStats, 'drinking')}
        ${generateSectionHtml('Hookah', '💨', hookahStats, 'hookah')}
    `;
}