// Admin Panel JavaScript
const supabase = supabase.createClient(config.supabase.url, config.supabase.anonKey);

let currentUser = null;
let categoryChart = null;
let statusChart = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    checkAdminStatus();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Tab navigation
    document.getElementById('issuesTab').addEventListener('click', () => switchTab('issues'));
    document.getElementById('usersTab').addEventListener('click', () => switchTab('users'));
    document.getElementById('spamTab').addEventListener('click', () => switchTab('spam'));
    
    // Filters
    document.getElementById('issueStatusFilter').addEventListener('change', loadIssues);
    document.getElementById('issueCategoryFilter').addEventListener('change', loadIssues);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    // Modal
    document.getElementById('closeModal').addEventListener('click', () => hideModal());
}

// Check if user is admin
async function checkAdminStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            showAdminCheck();
            return;
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;

        if (profile.role !== 'admin' && profile.role !== 'moderator') {
            showAdminCheck();
            return;
        }

        currentUser = user;
        document.getElementById('adminInfo').textContent = `Welcome, ${profile.username} (${profile.role})`;
        document.getElementById('dashboard').classList.remove('hidden');
        loadDashboard();
    } catch (error) {
        console.error('Error checking admin status:', error);
        showAdminCheck();
    }
}

function showAdminCheck() {
    document.getElementById('adminCheck').classList.remove('hidden');
}

// Load dashboard data
async function loadDashboard() {
    await Promise.all([
        loadStats(),
        loadCharts(),
        loadIssues()
    ]);
}

// Load statistics
async function loadStats() {
    try {
        // Total issues
        const { count: totalIssues } = await supabase
            .from('issues')
            .select('*', { count: 'exact', head: true });

        // Active users (users who reported issues in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { count: activeUsers } = await supabase
            .from('issues')
            .select('reporter_id', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString())
            .not('reporter_id', 'is', null);

        // Resolved issues
        const { count: resolvedIssues } = await supabase
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'resolved');

        // Spam reports
        const { count: spamReports } = await supabase
            .from('spam_reports')
            .select('*', { count: 'exact', head: true });

        // Update UI
        document.getElementById('totalIssues').textContent = totalIssues || 0;
        document.getElementById('activeUsers').textContent = activeUsers || 0;
        document.getElementById('resolvedIssues').textContent = resolvedIssues || 0;
        document.getElementById('spamReports').textContent = spamReports || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load charts
async function loadCharts() {
    try {
        // Issues by category
        const { data: categoryData } = await supabase
            .from('issues')
            .select('category')
            .eq('is_hidden', false);

        const categoryCounts = {};
        categoryData.forEach(issue => {
            categoryCounts[issue.category] = (categoryCounts[issue.category] || 0) + 1;
        });

        // Issues by status
        const { data: statusData } = await supabase
            .from('issues')
            .select('status')
            .eq('is_hidden', false);

        const statusCounts = {};
        statusData.forEach(issue => {
            statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1;
        });

        createCategoryChart(categoryCounts);
        createStatusChart(statusCounts);
    } catch (error) {
        console.error('Error loading charts:', error);
    }
}

function createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data).map(key => config.categories[key]?.name || key),
            datasets: [{
                data: Object.values(data),
                backgroundColor: [
                    '#3B82F6',
                    '#10B981',
                    '#F59E0B',
                    '#EF4444',
                    '#8B5CF6',
                    '#06B6D4'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function createStatusChart(data) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    
    if (statusChart) {
        statusChart.destroy();
    }

    statusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data).map(key => config.statuses[key]?.name || key),
            datasets: [{
                label: 'Issues',
                data: Object.values(data),
                backgroundColor: [
                    '#F59E0B',
                    '#3B82F6',
                    '#10B981'
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

// Load issues for management
async function loadIssues() {
    try {
        const statusFilter = document.getElementById('issueStatusFilter').value;
        const categoryFilter = document.getElementById('issueCategoryFilter').value;

        let query = supabase
            .from('issues')
            .select(`
                *,
                profiles:reporter_id(username, email)
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

        displayIssues(issues || []);
    } catch (error) {
        console.error('Error loading issues:', error);
    }
}

function displayIssues(issues) {
    const tbody = document.getElementById('issuesTableBody');
    tbody.innerHTML = '';

    issues.forEach(issue => {
        const row = document.createElement('tr');
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
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(issue.status)}">
                    ${config.statuses[issue.status]?.name || issue.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${issue.is_anonymous ? 'Anonymous' : (issue.profiles ? issue.profiles.username : 'Unknown')}
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

// Load users
async function loadUsers() {
    try {
        const { data: users, error } = await supabase
            .from('profiles')
            .select(`
                *,
                issues:issues(count)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displayUsers(users || []);
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${user.username}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${user.email}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleClass(user.role)}">
                    ${user.role}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${user.issues?.[0]?.count || 0}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_banned ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                    ${user.is_banned ? 'Banned' : 'Active'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="toggleUserBan('${user.id}', ${user.is_banned})" class="text-${user.is_banned ? 'green' : 'red'}-600 hover:text-${user.is_banned ? 'green' : 'red'}-900">
                    ${user.is_banned ? 'Unban' : 'Ban'}
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load spam reports
async function loadSpamReports() {
    try {
        const { data: spamReports, error } = await supabase
            .from('spam_reports')
            .select(`
                *,
                issues(title, spam_reports),
                profiles:reporter_id(username)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        displaySpamReports(spamReports || []);
    } catch (error) {
        console.error('Error loading spam reports:', error);
    }
}

function displaySpamReports(reports) {
    const tbody = document.getElementById('spamTableBody');
    tbody.innerHTML = '';

    reports.forEach(report => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${report.issues?.title || 'Unknown Issue'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${report.issues?.spam_reports || 0}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${report.profiles?.username || 'Unknown'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(report.created_at).toLocaleDateString()}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewIssue('${report.issue_id}')" class="text-blue-600 hover:text-blue-900 mr-2">View Issue</button>
                <button onclick="dismissSpamReport('${report.id}')" class="text-green-600 hover:text-green-900">Dismiss</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Tab switching
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('[id$="Tab"]').forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    document.getElementById(`${tab}Tab`).classList.add('border-blue-500', 'text-blue-600');
    document.getElementById(`${tab}Tab`).classList.remove('border-transparent', 'text-gray-500');

    // Update content
    document.querySelectorAll('[id$="Content"]').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tab}Content`).classList.remove('hidden');

    // Load data based on tab
    switch (tab) {
        case 'issues':
            loadIssues();
            break;
        case 'users':
            loadUsers();
            break;
        case 'spam':
            loadSpamReports();
            break;
    }
}

// Issue management functions
async function viewIssue(issueId) {
    try {
        const { data: issue, error } = await supabase
            .from('issues')
            .select(`
                *,
                profiles:reporter_id(username, email),
                issue_photos(photo_url),
                issue_activities(*)
            `)
            .eq('id', issueId)
            .single();

        if (error) throw error;

        showIssueModal(issue);
    } catch (error) {
        console.error('Error loading issue:', error);
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
                    <p><strong>Status:</strong> <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${config.statuses[issue.status]?.name || issue.status}</span></p>
                    <p><strong>Reporter:</strong> ${issue.is_anonymous ? 'Anonymous' : (issue.profiles ? issue.profiles.username : 'Unknown')}</p>
                    <p><strong>Location:</strong> ${issue.location_address || 'Location not specified'}</p>
                    <p><strong>Category:</strong> ${config.categories[issue.category]?.name || issue.category}</p>
                </div>
            </div>
            <div>
                <h4 class="font-semibold mb-2">Description</h4>
                <p class="text-gray-700 mb-4">${issue.description}</p>
                
                <h4 class="font-semibold mb-2">Activity Log</h4>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                    ${issue.issue_activities ? issue.issue_activities.map(activity => `
                        <div class="p-2 bg-gray-50 rounded">
                            <p class="text-sm text-gray-600">${new Date(activity.created_at).toLocaleString()}</p>
                            <p class="text-sm">${activity.description}</p>
                        </div>
                    `).join('') : '<p class="text-gray-500">No activity yet</p>'}
                </div>
            </div>
        </div>
    `;

    showModal();
}

async function updateIssueStatus(issueId) {
    const newStatus = prompt('Enter new status (reported, in_progress, resolved):');
    if (!newStatus || !['reported', 'in_progress', 'resolved'].includes(newStatus)) {
        alert('Invalid status');
        return;
    }

    try {
        const { error } = await supabase
            .from('issues')
            .update({ status: newStatus })
            .eq('id', issueId);

        if (error) throw error;

        // Add activity log
        await supabase
            .from('issue_activities')
            .insert([
                {
                    issue_id: issueId,
                    action: 'status_updated',
                    description: `Status updated to ${newStatus} by admin`,
                    user_id: currentUser.id
                }
            ]);

        alert('Status updated successfully');
        loadIssues();
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Error updating status');
    }
}

async function deleteIssue(issueId) {
    if (!confirm('Are you sure you want to delete this issue?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('issues')
            .delete()
            .eq('id', issueId);

        if (error) throw error;

        alert('Issue deleted successfully');
        loadIssues();
    } catch (error) {
        console.error('Error deleting issue:', error);
        alert('Error deleting issue');
    }
}

// User management functions
async function toggleUserBan(userId, isCurrentlyBanned) {
    const action = isCurrentlyBanned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .update({ is_banned: !isCurrentlyBanned })
            .eq('id', userId);

        if (error) throw error;

        alert(`User ${action}ned successfully`);
        loadUsers();
    } catch (error) {
        console.error(`Error ${action}ning user:`, error);
        alert(`Error ${action}ning user`);
    }
}

// Spam management functions
async function dismissSpamReport(reportId) {
    if (!confirm('Are you sure you want to dismiss this spam report?')) {
        return;
    }

    try {
        const { error } = await supabase
            .from('spam_reports')
            .delete()
            .eq('id', reportId);

        if (error) throw error;

        alert('Spam report dismissed');
        loadSpamReports();
    } catch (error) {
        console.error('Error dismissing spam report:', error);
        alert('Error dismissing spam report');
    }
}

// Utility functions
function getStatusClass(status) {
    switch (status) {
        case 'reported': return 'bg-yellow-100 text-yellow-800';
        case 'in_progress': return 'bg-blue-100 text-blue-800';
        case 'resolved': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getRoleClass(role) {
    switch (role) {
        case 'admin': return 'bg-red-100 text-red-800';
        case 'moderator': return 'bg-orange-100 text-orange-800';
        case 'user': return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function showModal() {
    document.getElementById('issueDetailModal').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('issueDetailModal').classList.add('hidden');
}

async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
} 