// Admin Panel JavaScript
let supabaseClient;
let currentUser;
let charts = {};

// Initialize admin panel
async function initializeAdminPanel() {
    try {
        // Initialize Supabase client
        supabaseClient = supabase.createClient(config.supabase.url, config.supabase.anonKey);
        
        // Check authentication
        await checkAdminAuth();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load dashboard data
        await loadDashboardData();
        
        // Show dashboard by default
        showTab('dashboard');
        
    } catch (error) {
        console.error('Error initializing admin panel:', error);
        showNotification('Failed to initialize admin panel', 'error');
    }
}

// Check admin authentication
async function checkAdminAuth() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error || !user) {
            // Redirect to login if not authenticated
            window.location.href = 'index.html';
            return;
        }
        
        currentUser = user;
        
        // Check if user has admin role
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (profileError || !profile || profile.role !== 'admin') {
            showNotification('Access denied. Admin privileges required.', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        // Update user info
        document.getElementById('adminUserInfo').textContent = user.email;
        
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = 'index.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.getElementById('dashboardTab').addEventListener('click', () => showTab('dashboard'));
    document.getElementById('issuesTab').addEventListener('click', () => showTab('issues'));
    document.getElementById('spamTab').addEventListener('click', () => showTab('spam'));
    document.getElementById('usersTab').addEventListener('click', () => showTab('users'));
    document.getElementById('analyticsTab').addEventListener('click', () => showTab('analytics'));
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Filters
    document.getElementById('issueStatusFilter').addEventListener('change', loadIssues);
    document.getElementById('issueCategoryFilter').addEventListener('change', loadIssues);
    document.getElementById('timeRange').addEventListener('change', loadAnalytics);
    
    // Bulk actions
    document.getElementById('approveAllBtn').addEventListener('click', approveAllSpam);
    document.getElementById('deleteAllBtn').addEventListener('click', deleteAllSpam);
    document.getElementById('banUserBtn').addEventListener('click', banSelectedUsers);
    document.getElementById('unbanUserBtn').addEventListener('click', unbanSelectedUsers);
    
    // Select all checkboxes
    document.getElementById('selectAllSpam').addEventListener('change', toggleSelectAllSpam);
    document.getElementById('selectAllUsers').addEventListener('change', toggleSelectAllUsers);
    
    // Modal
    document.getElementById('closeModal').addEventListener('click', hideModal);
    document.getElementById('closeNotification').addEventListener('click', hideNotification);
}

// Show/hide tabs
function showTab(tabName) {
    // Hide all content
    const contents = ['dashboardContent', 'issuesContent', 'spamContent', 'usersContent', 'analyticsContent'];
    contents.forEach(content => {
        document.getElementById(content).classList.add('hidden');
    });
    
    // Remove active state from all tabs
    const tabs = ['dashboardTab', 'issuesTab', 'spamTab', 'usersTab', 'analyticsTab'];
    tabs.forEach(tab => {
        document.getElementById(tab).classList.remove('bg-blue-50', 'text-blue-700', 'font-medium');
        document.getElementById(tab).classList.add('text-gray-700', 'hover:bg-gray-100');
    });
    
    // Show selected content
    document.getElementById(tabName + 'Content').classList.remove('hidden');
    
    // Add active state to selected tab
    document.getElementById(tabName + 'Tab').classList.add('bg-blue-50', 'text-blue-700', 'font-medium');
    document.getElementById(tabName + 'Tab').classList.remove('text-gray-700', 'hover:bg-gray-100');
    
    // Load data for the tab
    switch (tabName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'issues':
            loadIssues();
            break;
        case 'spam':
            loadSpamIssues();
            break;
        case 'users':
            loadUsers();
            break;
        case 'analytics':
            loadAnalytics();
            break;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Get total issues
        const { count: totalIssues } = await supabaseClient
            .from('issues')
            .select('*', { count: 'exact', head: true });
        
        // Get pending issues (reported status)
        const { count: pendingIssues } = await supabaseClient
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'reported');
        
        // Get spam/invalid issues
        const { count: spamIssues } = await supabaseClient
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .in('status', ['spam', 'invalid']);
        
        // Get active users
        const { count: activeUsers } = await supabaseClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_banned', false);
        
        // Update stats
        document.getElementById('totalIssues').textContent = totalIssues || 0;
        document.getElementById('pendingIssues').textContent = pendingIssues || 0;
        document.getElementById('spamIssues').textContent = spamIssues || 0;
        document.getElementById('activeUsers').textContent = activeUsers || 0;
        
        // Update last updated time
        document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        
        // Load recent activity
        await loadRecentActivity();
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showNotification('Failed to load dashboard data', 'error');
    }
}

// Load recent activity
async function loadRecentActivity() {
    try {
        const { data: activities, error } = await supabaseClient
            .from('issues')
            .select(`
                *,
                profiles!reporter_id(username, email)
            `)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const activityContainer = document.getElementById('recentActivity');
        activityContainer.innerHTML = '';
        
        activities.forEach(issue => {
            const activityDiv = document.createElement('div');
            activityDiv.className = 'flex items-center space-x-3 p-3 bg-gray-50 rounded-lg';
            
            const statusClass = getStatusClass(issue.status);
            const reporter = issue.is_anonymous ? 'Anonymous' : (issue.profiles?.username || 'Unknown');
            
            activityDiv.innerHTML = `
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span class="text-blue-600 text-sm">📝</span>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900">${issue.title}</p>
                    <p class="text-sm text-gray-500">Reported by ${reporter} • ${new Date(issue.created_at).toLocaleDateString()}</p>
                </div>
                <div class="flex-shrink-0">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                        ${issue.status.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
            `;
            
            activityContainer.appendChild(activityDiv);
        });
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
    }
}

// Load issues
async function loadIssues() {
    try {
        const statusFilter = document.getElementById('issueStatusFilter').value;
        const categoryFilter = document.getElementById('issueCategoryFilter').value;
        
        let query = supabaseClient
            .from('issues')
            .select(`
                *,
                profiles!reporter_id(username, email)
            `)
            .order('created_at', { ascending: false });
        
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }
        
        if (categoryFilter) {
            query = query.eq('category', categoryFilter);
        }
        
        const { data: issues, error } = await query;
        
        if (error) throw error;
        
        displayIssues(issues);
        
    } catch (error) {
        console.error('Error loading issues:', error);
        showNotification('Failed to load issues', 'error');
    }
}

// Display issues in table
function displayIssues(issues) {
    const tbody = document.getElementById('issuesTableBody');
    tbody.innerHTML = '';
    
    issues.forEach(issue => {
        const row = document.createElement('tr');
        const statusClass = getStatusClass(issue.status);
        const reporter = issue.is_anonymous ? 'Anonymous' : (issue.profiles?.username || 'Unknown');
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${issue.title}</div>
                <div class="text-sm text-gray-500">${issue.description.substring(0, 50)}...</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    ${config.categories[issue.category]?.name || issue.category}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${issue.status.replace('_', ' ').toUpperCase()}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${reporter}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(issue.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewIssue('${issue.id}')" class="text-blue-600 hover:text-blue-900 mr-2">View</button>
                <button onclick="updateIssueStatus('${issue.id}')" class="text-green-600 hover:text-green-900 mr-2">Update</button>
                <button onclick="deleteIssue('${issue.id}')" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load spam/invalid issues
async function loadSpamIssues() {
    try {
        const { data: issues, error } = await supabaseClient
            .from('issues')
            .select(`
                *,
                profiles!reporter_id(username, email)
            `)
            .in('status', ['spam', 'invalid'])
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        displaySpamIssues(issues);
        
    } catch (error) {
        console.error('Error loading spam issues:', error);
        showNotification('Failed to load spam issues', 'error');
    }
}

// Display spam issues
function displaySpamIssues(issues) {
    const tbody = document.getElementById('spamTableBody');
    tbody.innerHTML = '';
    
    issues.forEach(issue => {
        const row = document.createElement('tr');
        const statusClass = getStatusClass(issue.status);
        const reporter = issue.is_anonymous ? 'Anonymous' : (issue.profiles?.username || 'Unknown');
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="spam-checkbox rounded border-gray-300" value="${issue.id}">
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${issue.title}</div>
                <div class="text-sm text-gray-500">${issue.description.substring(0, 50)}...</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${issue.status.toUpperCase()}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${reporter}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(issue.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="approveIssue('${issue.id}')" class="text-green-600 hover:text-green-900 mr-2">Approve</button>
                <button onclick="viewIssue('${issue.id}')" class="text-blue-600 hover:text-blue-900 mr-2">View</button>
                <button onclick="deleteIssue('${issue.id}')" class="text-red-600 hover:text-red-900">Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load users
async function loadUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('profiles')
            .select(`
                *,
                issues(count)
            `)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        displayUsers(users);
        
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Failed to load users', 'error');
    }
}

// Display users
function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const statusClass = user.is_banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
        const statusText = user.is_banned ? 'BANNED' : 'ACTIVE';
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <input type="checkbox" class="user-checkbox rounded border-gray-300" value="${user.id}">
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${user.username || 'No username'}</div>
                <div class="text-sm text-gray-500">${user.phone || 'No phone'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${user.email}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.issues?.[0]?.count || 0}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(user.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                ${user.is_banned ? 
                    `<button onclick="unbanUser('${user.id}')" class="text-green-600 hover:text-green-900">Unban</button>` :
                    `<button onclick="banUser('${user.id}')" class="text-red-600 hover:text-red-900">Ban</button>`
                }
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load analytics
async function loadAnalytics() {
    try {
        const timeRange = parseInt(document.getElementById('timeRange').value);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - timeRange);
        
        // Get issues by category
        const { data: categoryData, error: categoryError } = await supabaseClient
            .from('issues')
            .select('category')
            .gte('created_at', startDate.toISOString());
        
        if (categoryError) throw categoryError;
        
        // Get issues by status
        const { data: statusData, error: statusError } = await supabaseClient
            .from('issues')
            .select('status')
            .gte('created_at', startDate.toISOString());
        
        if (statusError) throw statusError;
        
        // Get issues over time
        const { data: timelineData, error: timelineError } = await supabaseClient
            .from('issues')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });
        
        if (timelineError) throw timelineError;
        
        // Get top reporters
        const { data: reportersData, error: reportersError } = await supabaseClient
            .from('profiles')
            .select(`
                username,
                issues(count)
            `)
            .not('is_banned', 'eq', true)
            .order('issues.count', { ascending: false })
            .limit(10);
        
        if (reportersError) throw reportersError;
        
        // Create charts
        createCategoryChart(categoryData);
        createStatusChart(statusData);
        createTimelineChart(timelineData);
        displayTopReporters(reportersData);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showNotification('Failed to load analytics', 'error');
    }
}

// Create category chart
function createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    // Count categories
    const categoryCounts = {};
    data.forEach(issue => {
        categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
    });
    
    // Destroy existing chart
    if (charts.categoryChart) {
        charts.categoryChart.destroy();
    }
    
    charts.categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryCounts).map(cat => config.categories[cat]?.name || cat),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: [
                    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#06B6D4'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Create status chart
function createStatusChart(data) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    // Count statuses
    const statusCounts = {};
    data.forEach(issue => {
        statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
    });
    
    // Destroy existing chart
    if (charts.statusChart) {
        charts.statusChart.destroy();
    }
    
    charts.statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(statusCounts).map(status => status.replace('_', ' ').toUpperCase()),
            datasets: [{
                label: 'Issues',
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#6B7280'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Create timeline chart
function createTimelineChart(data) {
    const ctx = document.getElementById('timelineChart').getContext('2d');
    
    // Group by date
    const dateCounts = {};
    data.forEach(issue => {
        const date = new Date(issue.created_at).toLocaleDateString();
        dateCounts[date] = (dateCounts[date] || 0) + 1;
    });
    
    // Destroy existing chart
    if (charts.timelineChart) {
        charts.timelineChart.destroy();
    }
    
    charts.timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dateCounts),
            datasets: [{
                label: 'Issues',
                data: Object.values(dateCounts),
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Display top reporters
function displayTopReporters(data) {
    const container = document.getElementById('topReporters');
    container.innerHTML = '';
    
    data.forEach((user, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        
        div.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span class="text-blue-600 text-sm font-medium">${index + 1}</span>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${user.username || 'Anonymous'}</p>
                    <p class="text-xs text-gray-500">${user.issues?.[0]?.count || 0} issues</p>
                </div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

// Issue management functions
async function viewIssue(issueId) {
    try {
        const { data: issue, error } = await supabaseClient
            .from('issues')
            .select(`
                *,
                profiles!reporter_id(username, email),
                issue_photos(photo_url)
            `)
            .eq('id', issueId)
            .single();
        
        if (error) throw error;
        
        showIssueModal(issue);
        
    } catch (error) {
        console.error('Error loading issue:', error);
        showNotification('Failed to load issue details', 'error');
    }
}

function showIssueModal(issue) {
    document.getElementById('modalTitle').textContent = issue.title;
    
    const content = document.getElementById('modalContent');
    const statusClass = getStatusClass(issue.status);
    
    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <div class="mb-4">
                    ${issue.issue_photos && issue.issue_photos.length > 0 ? 
                        `<img src="${issue.issue_photos[0].photo_url}" alt="${issue.title}" class="w-full h-64 object-cover rounded-lg">` :
                        `<div class="w-full h-64 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">No Image</div>`
                    }
                </div>
                <div class="space-y-2">
                    <p><strong>Date:</strong> ${new Date(issue.created_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${issue.status.replace('_', ' ').toUpperCase()}</span></p>
                    <p><strong>Reporter:</strong> ${issue.is_anonymous ? 'Anonymous' : (issue.profiles?.username || 'Unknown')}</p>
                    <p><strong>Location:</strong> ${issue.location_address || 'Location not specified'}</p>
                    <p><strong>Category:</strong> ${config.categories[issue.category]?.name || issue.category}</p>
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">Description</h4>
                <p class="text-gray-700 mb-4">${issue.description}</p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                        <select id="statusUpdate" class="w-full border border-gray-300 rounded-md px-3 py-2">
                            <option value="reported" ${issue.status === 'reported' ? 'selected' : ''}>Reported</option>
                            <option value="in_progress" ${issue.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                            <option value="resolved" ${issue.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                            <option value="spam" ${issue.status === 'spam' ? 'selected' : ''}>Spam</option>
                            <option value="invalid" ${issue.status === 'invalid' ? 'selected' : ''}>Invalid</option>
                        </select>
                    </div>
                    <button onclick="saveStatusUpdate('${issue.id}')" class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Update Status
                    </button>
                </div>
            </div>
        </div>
    `;
    
    showModal();
}

async function saveStatusUpdate(issueId) {
    try {
        const newStatus = document.getElementById('statusUpdate').value;
        
        const { error } = await supabaseClient
            .from('issues')
            .update({ status: newStatus })
            .eq('id', issueId);
        
        if (error) throw error;
        
        showNotification('Status updated successfully', 'success');
        hideModal();
        
        // Reload current tab
        const activeTab = document.querySelector('[class*="bg-blue-50"]').id.replace('Tab', '');
        showTab(activeTab);
        
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Failed to update status', 'error');
    }
}

async function deleteIssue(issueId) {
    if (!confirm('Are you sure you want to delete this issue?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('issues')
            .delete()
            .eq('id', issueId);
        
        if (error) throw error;
        
        showNotification('Issue deleted successfully', 'success');
        
        // Reload current tab
        const activeTab = document.querySelector('[class*="bg-blue-50"]').id.replace('Tab', '');
        showTab(activeTab);
        
    } catch (error) {
        console.error('Error deleting issue:', error);
        showNotification('Failed to delete issue', 'error');
    }
}

// Spam management functions
async function approveIssue(issueId) {
    try {
        const { error } = await supabaseClient
            .from('issues')
            .update({ status: 'reported' })
            .eq('id', issueId);
        
        if (error) throw error;
        
        showNotification('Issue approved successfully', 'success');
        loadSpamIssues();
        
    } catch (error) {
        console.error('Error approving issue:', error);
        showNotification('Failed to approve issue', 'error');
    }
}

function toggleSelectAllSpam() {
    const selectAll = document.getElementById('selectAllSpam');
    const checkboxes = document.querySelectorAll('.spam-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

async function approveAllSpam() {
    const selectedCheckboxes = document.querySelectorAll('.spam-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showNotification('Please select issues to approve', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('issues')
            .update({ status: 'reported' })
            .in('id', selectedIds);
        
        if (error) throw error;
        
        showNotification(`${selectedIds.length} issues approved successfully`, 'success');
        loadSpamIssues();
        
    } catch (error) {
        console.error('Error approving issues:', error);
        showNotification('Failed to approve issues', 'error');
    }
}

async function deleteAllSpam() {
    const selectedCheckboxes = document.querySelectorAll('.spam-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showNotification('Please select issues to delete', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} issues?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('issues')
            .delete()
            .in('id', selectedIds);
        
        if (error) throw error;
        
        showNotification(`${selectedIds.length} issues deleted successfully`, 'success');
        loadSpamIssues();
        
    } catch (error) {
        console.error('Error deleting issues:', error);
        showNotification('Failed to delete issues', 'error');
    }
}

// User management functions
async function banUser(userId) {
    if (!confirm('Are you sure you want to ban this user?')) return;
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_banned: true })
            .eq('id', userId);
        
        if (error) throw error;
        
        showNotification('User banned successfully', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Error banning user:', error);
        showNotification('Failed to ban user', 'error');
    }
}

async function unbanUser(userId) {
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_banned: false })
            .eq('id', userId);
        
        if (error) throw error;
        
        showNotification('User unbanned successfully', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Error unbanning user:', error);
        showNotification('Failed to unban user', 'error');
    }
}

function toggleSelectAllUsers() {
    const selectAll = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

async function banSelectedUsers() {
    const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showNotification('Please select users to ban', 'warning');
        return;
    }
    
    if (!confirm(`Are you sure you want to ban ${selectedIds.length} users?`)) return;
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_banned: true })
            .in('id', selectedIds);
        
        if (error) throw error;
        
        showNotification(`${selectedIds.length} users banned successfully`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Error banning users:', error);
        showNotification('Failed to ban users', 'error');
    }
}

async function unbanSelectedUsers() {
    const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
    const selectedIds = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedIds.length === 0) {
        showNotification('Please select users to unban', 'warning');
        return;
    }
    
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_banned: false })
            .in('id', selectedIds);
        
        if (error) throw error;
        
        showNotification(`${selectedIds.length} users unbanned successfully`, 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Error unbanning users:', error);
        showNotification('Failed to unban users', 'error');
    }
}

// Utility functions
function getStatusClass(status) {
    switch (status) {
        case 'reported': return 'status-reported';
        case 'in_progress': return 'status-progress';
        case 'resolved': return 'status-resolved';
        case 'spam': return 'status-spam';
        case 'invalid': return 'status-invalid';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function showModal() {
    document.getElementById('issueDetailModal').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('issueDetailModal').classList.add('hidden');
}

function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notificationMessage');
    
    messageEl.textContent = message;
    
    // Set background color based on type
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg ${
        type === 'success' ? 'bg-green-500' :
        type === 'error' ? 'bg-red-500' :
        type === 'warning' ? 'bg-yellow-500' :
        'bg-blue-500'
    }`;
    
    notification.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        hideNotification();
    }, 5000);
}

function hideNotification() {
    document.getElementById('notification').classList.add('hidden');
}

async function logout() {
    try {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeAdminPanel); 