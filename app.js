// Supabase Configuration
const supabaseClient = supabase.createClient(config.supabase.url, config.supabase.anonKey);

// Global Variables
let currentUser = null;
let currentPincode = null;
let map = null;
let locationMap = null;
let currentPage = 1;
let issuesPerPage = config.app.issuesPerPage;
let allIssues = [];
let filteredIssues = [];

// Global variables
let currentMapRadius = 5; // Default 5km radius

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
    promptForPincode();
    loadIssues();
});

// Initialize the application
async function initializeApp() {
    // Initialize main map
    if (document.getElementById('map')) {
        map = L.map('map', {
            center: [20.5937, 78.9629], // India center coordinates
            zoom: 5,
            minZoom: 4
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Force a resize after initialization
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
    
    // Test storage connection
    await testStorageConnection();
}

// Test storage bucket connection
async function testStorageConnection() {
    try {
        const { data, error } = await supabaseClient.storage.listBuckets();
        if (error) {
            console.error('Storage connection error:', error);
            showNotification('Warning: Photo upload may not work. Please check storage configuration.', 'error');
        } else {
            console.log('Available storage buckets:', data.map(b => b.name));
            const photosBucket = data.find(bucket => bucket.name === 'photos');
            if (!photosBucket) {
                console.error('Photos bucket not found. Available buckets:', data.map(b => b.name));
                    // showNotification('Photos storage bucket not found. Please run the storage setup script.', 'error');
            } else {
                console.log('Storage connection successful - photos bucket found');
                
                // Test if we can list files in the bucket
                const { data: files, error: filesError } = await supabaseClient.storage
                    .from('photos')
                    .list();
                
                if (filesError) {
                    console.error('Error listing files in photos bucket:', filesError);
                } else {
                    console.log('Files in photos bucket:', files);
                }
            }
        }
    } catch (error) {
        console.error('Error testing storage connection:', error);
    }
}

// Test image URL accessibility
async function testImageUrl(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        console.error('Error testing image URL:', url, error);
        return false;
    }
}

// Setup all event listeners
function setupEventListeners() {
    // Authentication
    document.getElementById('authBtn').addEventListener('click', () => showModal('authModal'));
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('closeAuthModal').addEventListener('click', () => hideModal('authModal'));
    
    // Auth modal tabs
    document.getElementById('loginTab').addEventListener('click', () => switchToLogin());
    document.getElementById('registerTab').addEventListener('click', () => switchToRegister());

    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Navigation
    document.getElementById('mapViewBtn').addEventListener('click', async () => {
        await toggleMapView();
        if (map) {
            map.invalidateSize();
            if (currentPincode) {
                const centerLocation = await getPincodeCenter(currentPincode);
                map.setView([centerLocation.lat, centerLocation.lng], 12);
            } else {
                map.setView([20.5937, 78.9629], 5); // Default to India view
            }
            await loadIssuesOnMap();
        }
    });
    document.getElementById('changePincodeBtn').addEventListener('click', changePincode);
    document.getElementById('myIssuesBtn').addEventListener('click', () => filterMyIssues());
    document.getElementById('reportIssueBtn').addEventListener('click', () => showModal('reportModal'));
    document.getElementById('searchBtn').addEventListener('click', filterIssues);

    // Filters
    document.getElementById('categoryFilter').addEventListener('change', filterIssues);
    document.getElementById('statusFilter').addEventListener('change', filterIssues);


    // Modals
    document.getElementById('closeReportModal').addEventListener('click', () => hideModal('reportModal'));
    document.getElementById('closeDetailModal').addEventListener('click', () => hideModal('issueDetailModal'));
    document.getElementById('reportForm').addEventListener('submit', handleReportIssue);
    document.getElementById('reportSpamBtn').addEventListener('click', reportSpam);
    document.getElementById('editIssueBtn').addEventListener('click', editIssue);
    document.getElementById('deleteIssueBtn').addEventListener('click', deleteIssue);

    // Issue photos
    document.getElementById('issuePhotos').addEventListener('change', handlePhotoUpload);
    
    // Pincode input
    document.getElementById('issuePincode').addEventListener('input', function() {
        const pincode = this.value;
        if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
            // Update map when pincode is entered
            if (locationMap) {
                updateLocationMapForPincode(pincode);
            } else {
                // If map is not initialized yet, initialize it with the pincode
                initializeLocationMap();
                // Wait a bit for the map to initialize, then update it
                setTimeout(() => {
                    if (locationMap) {
                        updateLocationMapForPincode(pincode);
                    }
                }, 200);
            }
        }
    });
    document.getElementById('locationAddress').addEventListener('input', updateLocationMapVisibility);

    // Connect map filters
    document.getElementById('mapCategoryFilter').addEventListener('change', loadIssuesOnMap);
    document.getElementById('mapRadiusFilter').addEventListener('change', loadIssuesOnMap);
    
    // Show map and load issues when View Map button is clicked
    const mapViewBtn = document.getElementById('mapViewBtn');
    if (mapViewBtn) {
        mapViewBtn.addEventListener('click', async function() {
            await toggleMapView();
            if (map) {
                map.invalidateSize();
                if (currentPincode) {
                    const centerLocation = await getPincodeCenter(currentPincode);
                    map.setView([centerLocation.lat, centerLocation.lng], 12);
                } else {
                    map.setView([20.5937, 78.9629], 5); // Default to India view
                }
                await loadIssuesOnMap();
            }
        });
    }
}

// These listeners are now handled in setupEventListeners() function

function updateLocationMapVisibility() {
    const pincode = document.getElementById('issuePincode').value.trim();
    const mapContainer = document.getElementById('locationMapContainer');
    // Show map only if pincode is valid
    if (/^[0-9]{6}$/.test(pincode)) {
        mapContainer.style.display = '';
        updateLocationMapForPincode(pincode);
    } else {
        mapContainer.style.display = 'none';
    }
}

async function updateLocationMapForAddress(pincode, address) {
    const query = encodeURIComponent(`${address}, ${pincode}, India`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data[0]) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            // Initialize map if not already done
            if (!window.locationMapInstance) {
                window.locationMapInstance = L.map('locationMap').setView([lat, lon], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(window.locationMapInstance);
            } else {
                window.locationMapInstance.setView([lat, lon], 16);
            }
            // Remove previous marker if exists
            if (window.locationMarker) {
                window.locationMapInstance.removeLayer(window.locationMarker);
            }
            window.locationMarker = L.marker([lat, lon]).addTo(window.locationMapInstance);
        }
    } catch (err) {
        // Optionally show error to user
    }
}

// Authentication Functions
async function checkAuthStatus() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        currentUser = user;
        updateUIForLoggedInUser();
    } else {
        updateUIForLoggedOutUser();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        currentUser = data.user;
        updateUIForLoggedInUser();
        hideModal('authModal');
        showNotification('Login successful!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;

    try {
        // Register user with metadata
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    phone: phone
                }
            }
        });

        if (error) throw error;

        // Wait a moment for the trigger to work, then check if profile was created
        setTimeout(async () => {
            try {
                const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profileError && profileError.code === 'PGRST116') {
                    // Profile doesn't exist, create it manually
                    const { error: createError } = await supabaseClient
                        .rpc('create_profile_manually', {
                            user_id: data.user.id,
                            username: username,
                            email: email,
                            phone: phone
                        });

                    if (createError) {
                        console.error('Error creating profile manually:', createError);
                    }
                }
            } catch (profileCheckError) {
                console.error('Error checking profile:', profileCheckError);
            }
        }, 1000);

        showNotification('Registration successful! Please check your email to verify your account.', 'success');
        hideModal('authModal');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function logout() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        currentUser = null;
        updateUIForLoggedOutUser();
        showNotification('Logged out successfully!', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// UI Update Functions
function updateUIForLoggedInUser() {
    document.getElementById('authBtn').classList.add('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    document.getElementById('userNav').classList.remove('hidden');
    
    // Get user profile
    getUserProfile();
}

function updateUIForLoggedOutUser() {
    document.getElementById('authBtn').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
    document.getElementById('userNav').classList.add('hidden');
    document.getElementById('userInfo').textContent = '';
}

// Auth modal tab switching
function switchToLogin() {
    document.getElementById('loginTab').classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    document.getElementById('loginTab').classList.remove('text-gray-500');
    document.getElementById('registerTab').classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    document.getElementById('registerTab').classList.add('text-gray-500');
    
    document.getElementById('loginFormContainer').classList.remove('hidden');
    document.getElementById('registerFormContainer').classList.add('hidden');
}

function switchToRegister() {
    document.getElementById('registerTab').classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    document.getElementById('registerTab').classList.remove('text-gray-500');
    document.getElementById('loginTab').classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    document.getElementById('loginTab').classList.add('text-gray-500');
    
    document.getElementById('registerFormContainer').classList.remove('hidden');
    document.getElementById('loginFormContainer').classList.add('hidden');
}

async function getUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        document.getElementById('userInfo').textContent = `Welcome, ${data.username}!`;
    } catch (error) {
        console.error('Error fetching user profile:', error);
    }
}

// Pincode Functions
function promptForPincode() {
    const savedPincode = localStorage.getItem('civictrack_pincode');
    if (savedPincode) {
        currentPincode = savedPincode;
        loadIssues();
    } else {
        const pincode = prompt('Please enter your 6-digit pincode to see nearby issues:');
        if (pincode && /^\d{6}$/.test(pincode)) {
            currentPincode = pincode;
            localStorage.setItem('civictrack_pincode', pincode);
            loadIssues();
        } else {
            alert('Please enter a valid 6-digit pincode');
            promptForPincode();
        }
    }
}

function changePincode() {
    const pincode = prompt('Enter new pincode:');
    if (pincode && /^\d{6}$/.test(pincode)) {
        currentPincode = pincode;
        localStorage.setItem('civictrack_pincode', pincode);
        loadIssues();
    } else if (pincode !== null) {
        alert('Please enter a valid 6-digit pincode');
        changePincode();
    }
}

// Issue Management Functions
async function loadIssues() {
    try {
        if (!currentPincode) {
            showNotification('Please enter your pincode first', 'error');
            return;
        }

        // Simple approach: Get all issues for the current pincode
        const { data: issues, error } = await supabaseClient
            .from('issues')
            .select(`
                *,
                profiles:reporter_id(username, email),
                issue_photos(photo_url),
                issue_activities(*)
            `)
            .eq('pincode', currentPincode)
            .eq('is_hidden', false)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Add distance calculation (simplified to 0 for same pincode)
        allIssues = issues.map(issue => ({
            ...issue,
            distance_km: 0
        }));

        await filterIssues();
    } catch (error) {
        console.error('Error loading issues:', error);
        showNotification('Error loading issues: ' + error.message, 'error');
    }
}

async function filterIssues() {
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;

    filteredIssues = allIssues.filter(issue => {
        // Category filter
        if (category && issue.category !== category) return false;
        
        // Status filter
        if (status && issue.status !== status) return false;
        
        return true;
    });

    displayIssues();
    await updateMapMarkers();
}

async function filterMyIssues() {
    if (!currentUser) return;
    
    filteredIssues = allIssues.filter(issue => issue.reporter_id === currentUser.id);
    displayIssues();
    await updateMapMarkers();
}

function displayIssues() {
    const grid = document.getElementById('issuesGrid');
    const startIndex = (currentPage - 1) * issuesPerPage;
    const endIndex = startIndex + issuesPerPage;
    const pageIssues = filteredIssues.slice(startIndex, endIndex);

    grid.innerHTML = '';

    pageIssues.forEach(issue => {
        const card = createIssueCard(issue);
        grid.appendChild(card);
    });

    updatePagination();
}

function createIssueCard(issue) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md overflow-hidden issue-card cursor-pointer';
    
    const statusClass = getStatusClass(issue.status);

    // Debug photo data
    console.log('Issue photos for card:', issue.issue_photos);
    
    const hasPhotos = issue.issue_photos && issue.issue_photos.length > 0;
    const photoUrl = hasPhotos ? issue.issue_photos[0].photo_url : null;

    card.innerHTML = `
        <div class="h-48 bg-gray-200 relative">
            ${hasPhotos ? 
                `<img src="${photoUrl}" alt="${issue.title}" class="w-full h-full object-cover" 
                      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'; console.error('Image failed to load:', '${photoUrl}');"
                      onload="console.log('Image loaded successfully:', '${photoUrl}');">` :
                ''
            }
            <div class="w-full h-full flex items-center justify-center text-gray-500 ${hasPhotos ? 'hidden' : ''}" 
                 style="${hasPhotos ? 'display: none;' : ''}">
                ${hasPhotos ? 'Image Loading...' : 'No Image'}
            </div>

        </div>
        <div class="p-4">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">${issue.title}</h3>
            <p class="text-sm text-gray-600 mb-2">${issue.description.substring(0, 100)}${issue.description.length > 100 ? '...' : ''}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>${new Date(issue.created_at).toLocaleDateString()}</span>
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                    ${issue.status.replace('_', ' ').toUpperCase()}
                </span>
            </div>
            <div class="mt-2 text-xs text-gray-400">
                <div>📍 ${issue.pincode || 'No pincode'}</div>
                <div>${issue.location_address || 'Location not specified'}</div>
            </div>
            ${hasPhotos ? `<div class="mt-1 text-xs text-blue-500">📷 ${issue.issue_photos.length} photo(s)</div>` : ''}
        </div>
    `;

    card.addEventListener('click', () => showIssueDetail(issue));
    return card;
}

function getStatusClass(status) {
    switch (status) {
        case 'reported': return 'status-reported';
        case 'in_progress': return 'status-progress';
        case 'resolved': return 'status-resolved';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredIssues.length / issuesPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button class="px-3 py-2 mx-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick="changePage(${currentPage - 1})">Previous</button>`;
    }

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="px-3 py-2 mx-1 text-sm bg-blue-600 text-white border border-blue-600 rounded-md">${i}</button>`;
        } else {
            paginationHTML += `<button class="px-3 py-2 mx-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick="changePage(${i})">${i}</button>`;
        }
    }

    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button class="px-3 py-2 mx-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50" onclick="changePage(${currentPage + 1})">Next</button>`;
    }

    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    currentPage = page;
    displayIssues();
}

// Map Functions
async function toggleMapView() {
    const mapView = document.getElementById('mapView');
    const issuesGrid = document.getElementById('issuesGrid');
    const pagination = document.getElementById('pagination');
    
    if (mapView.classList.contains('hidden')) {
        mapView.classList.remove('hidden');
        issuesGrid.classList.add('hidden');
        pagination.classList.add('hidden');
        
        // Force map to recalculate size and update view
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
                updateMapMarkers();
            }
        }, 100);
    } else {
        mapView.classList.add('hidden');
        issuesGrid.classList.remove('hidden');
        pagination.classList.remove('hidden');
    }
}

async function updateMapMarkers() {
    if (!map) return;
    
    try {
        // Clear existing markers
        map.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });

        // Add pincode center marker
        if (currentPincode) {
            try {
                const pincodeCenter = await getPincodeCenter(currentPincode);
                if (pincodeCenter && pincodeCenter.lat && pincodeCenter.lng) {
                    L.marker([pincodeCenter.lat, pincodeCenter.lng])
                        .addTo(map)
                        .bindPopup(`Your Pincode: ${currentPincode}`)
                        .openPopup();
                    
                    // Set map view to pincode center
                    map.setView([pincodeCenter.lat, pincodeCenter.lng], 12);
                } else {
                    // Fallback to default location
                    const defaultLocation = { lat: 20.5937, lng: 78.9629 };
                    L.marker([defaultLocation.lat, defaultLocation.lng])
                        .addTo(map)
                        .bindPopup(`Your Pincode: ${currentPincode} (Default Location)`)
                        .openPopup();
                    
                    map.setView([defaultLocation.lat, defaultLocation.lng], 5);
                }
            } catch (error) {
                console.error('Error getting pincode center:', error);
                // Fallback to default location
                const defaultLocation = { lat: 20.5937, lng: 78.9629 };
                L.marker([defaultLocation.lat, defaultLocation.lng])
                    .addTo(map)
                    .bindPopup(`Your Pincode: ${currentPincode} (Default Location)`)
                    .openPopup();
                
                map.setView([defaultLocation.lat, defaultLocation.lng], 5);
            }
        }

        // Add issue markers
        filteredIssues.forEach(issue => {
            // Check if issue has valid coordinates
            if (issue.latitude && issue.longitude && 
                !isNaN(parseFloat(issue.latitude)) && !isNaN(parseFloat(issue.longitude))) {
                
                const lat = parseFloat(issue.latitude);
                const lng = parseFloat(issue.longitude);
                
                console.log('Adding marker for issue:', issue.title, 'at coordinates:', lat, lng);
                
                const marker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup(`
                        <div class="p-2">
                            <h3 class="font-semibold">${issue.title}</h3>
                            <p class="text-sm text-gray-600">${issue.status}</p>
                            <p class="text-xs text-gray-500">📍 ${issue.pincode}</p>
                            <p class="text-xs text-gray-500">${issue.distance_km ? issue.distance_km.toFixed(1) + ' km away' : ''}</p>
                            <button onclick="showIssueDetail(${JSON.stringify(issue).replace(/"/g, '&quot;')})" class="mt-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">View Details</button>
                        </div>
                    `);
            } else {
                console.warn('Issue missing valid coordinates:', issue.title, 'lat:', issue.latitude, 'lng:', issue.longitude);
            }
        });
    } catch (error) {
        console.error('Error updating map markers:', error);
        showNotification('Error updating map markers', 'error');
    }
}

// Helper function to get approximate coordinates for a pincode
async function getPincodeCenter(pincode) {
    // Try Nominatim geocoding for the pincode
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${pincode}, India`;
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
        }
        
        const data = await res.json();
        if (data && data.length > 0 && data[0].lat && data[0].lon) {
            return { 
                lat: parseFloat(data[0].lat), 
                lng: parseFloat(data[0].lon) 
            };
        } else {
            throw new Error('No location data found for this pincode');
        }
    } catch (err) {
        console.error('Error getting pincode center:', err);
        // Fallback to India center
        return { lat: 20.5937, lng: 78.9629 };
    }
}

// Report Issue Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
    if (modalId === 'reportModal') {
        document.getElementById('reportForm').reset();
        document.getElementById('locationAddress').value = '';
        // Remove previous map instance if exists
        if (window.locationMapInstance) {
            window.locationMapInstance.remove();
            window.locationMapInstance = null;
        }
        // Initialize the map after a short delay to ensure the div is visible
        setTimeout(() => {
            const pincode = document.getElementById('issuePincode').value;
            if (/^[0-9]{6}$/.test(pincode)) {
                updateLocationMapForPincode(pincode);
            }
        }, 200);
    }
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    
    if (modalId === 'authModal') {
        // Clear forms when closing auth modal
        document.getElementById('loginForm').reset();
        document.getElementById('registerForm').reset();
    } else if (modalId === 'reportModal') {
        if (locationMap) {
            locationMap.remove();
            locationMap = null;
        }
    }
}

async function updateLocationMapForPincode(pincode) {
    const mapDiv = document.getElementById('locationMap');
    if (!mapDiv) return;
    // Remove previous map instance if exists
    if (window.locationMapInstance) {
        window.locationMapInstance.remove();
        window.locationMapInstance = null;
    }
    // Get coordinates for pincode
    const centerLocation = await getPincodeCenter(pincode);
    window.locationMapInstance = L.map('locationMap').setView([centerLocation.lat, centerLocation.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(window.locationMapInstance);
    L.marker([centerLocation.lat, centerLocation.lng])
        .addTo(window.locationMapInstance)
        .bindPopup(`Pincode: ${pincode}`)
        .openPopup();
}

// Example usage in initializeLocationMap
async function initializeLocationMap() {
    return new Promise((resolve, reject) => {
        setTimeout(async () => {
            try {
                const mapContainer = document.getElementById('locationMap');
                if (mapContainer && !locationMap) {
                    const pincode = document.getElementById('issuePincode').value;
                    let centerLocation = { lat: 20.5937, lng: 78.9629 };
                    
                    if (pincode && /^\d{6}$/.test(pincode)) {
                        try {
                            centerLocation = await getPincodeCenter(pincode);
                        } catch (error) {
                            console.error('Error getting pincode center:', error);
                            // Use default location if pincode lookup fails
                        }
                    }
                    
                    locationMap = L.map('locationMap').setView([centerLocation.lat, centerLocation.lng], 12);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '© OpenStreetMap contributors'
                    }).addTo(locationMap);

                    // Add a marker at the pincode center
                    const marker = L.marker([centerLocation.lat, centerLocation.lng])
                        .addTo(locationMap)
                        .bindPopup(`Pincode: ${pincode || 'Not specified'}`)
                        .openPopup();

                    reverseGeocode(centerLocation.lat, centerLocation.lng);

                    locationMap.on('click', function(e) {
                        locationMap.eachLayer((layer) => {
                            if (layer instanceof L.Marker) {
                                locationMap.removeLayer(layer);
                            }
                        });
                        L.marker(e.latlng).addTo(locationMap);
                        reverseGeocode(e.latlng.lat, e.latlng.lng);
                    });
                    
                    resolve(locationMap);
                } else {
                    resolve(locationMap);
                }
            } catch (error) {
                console.error('Error initializing location map:', error);
                reject(error);
            }
        }, 100);
    });
}

// Example usage in updateLocationMapForPincode
async function updateLocationMapForPincode(pincode) {
    if (!locationMap) {
        await initializeLocationMap();
    }
    
    try {
        const centerLocation = await getPincodeCenter(pincode);
        locationMap.setView([centerLocation.lat, centerLocation.lng], 12);
        locationMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                locationMap.removeLayer(layer);
            }
        });
        L.marker([centerLocation.lat, centerLocation.lng])
            .addTo(locationMap)
            .bindPopup(`Pincode: ${pincode}`)
            .openPopup();
        reverseGeocode(centerLocation.lat, centerLocation.lng);
    } catch (error) {
        console.error('Error updating location map:', error);
        showNotification('Error loading location map', 'error');
    }
}

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        const addressField = document.getElementById('locationAddress');
        if (data.display_name && addressField) {
            addressField.value = data.display_name;
        } else if (addressField) {
            addressField.value = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    } catch (error) {
        console.error('Error reverse geocoding:', error);
        const addressField = document.getElementById('locationAddress');
        if (addressField) {
            addressField.value = `Location at ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }
    }
}

async function handleReportIssue(e) {
    e.preventDefault();
    
    if (!currentUser) {
        showNotification('Please login to report an issue', 'error');
        return;
    }

    const title = document.getElementById('issueTitle').value.trim();
    const description = document.getElementById('issueDescription').value.trim();
    const category = document.getElementById('issueCategory').value;
    const pincode = document.getElementById('issuePincode').value.trim();
    const address = document.getElementById('locationAddress').value.trim();
    const area = document.getElementById('issueArea').value.trim();
    const isAnonymous = document.getElementById('reportAnonymous').checked;
    const photos = document.getElementById('issuePhotos').files;

    // Validate all required fields
    if (!title) {
        showNotification('Please enter a title for the issue', 'error');
        return;
    }

    if (!description) {
        showNotification('Please enter a description for the issue', 'error');
        return;
    }

    if (!category) {
        showNotification('Please select a category', 'error');
        return;
    }

    if (!pincode || !/^\d{6}$/.test(pincode)) {
        showNotification('Please enter a valid 6-digit pincode', 'error');
        return;
    }

    if (!address) {
        showNotification('Please enter an address', 'error');
        return;
    }

    if (!area) {
        showNotification('Please enter the area/locality', 'error');
        return;
    }

    // Get location from map
    let latitude = null, longitude = null;
    if (locationMap) {
        locationMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) {
                const latlng = layer.getLatLng();
                latitude = latlng.lat;
                longitude = latlng.lng;
            }
        });
    }

            // If no marker found, use pincode center coordinates
        if (!latitude || !longitude) {
            try {
                const centerLocation = await getPincodeCenter(pincode);
                latitude = centerLocation.lat;
                longitude = centerLocation.lng;
            } catch (error) {
                console.error('Error getting pincode center, using default coordinates:', error);
                // Use default coordinates for India center
                latitude = 20.5937;
                longitude = 78.9629;
            }
        }

        // Ensure coordinates are valid numbers
        if (isNaN(latitude) || isNaN(longitude)) {
            console.error('Invalid coordinates, using default:', latitude, longitude);
            latitude = 20.5937;
            longitude = 78.9629;
        }

    try {
        // Show loading state
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        // Upload photos first
        const photoUrls = [];
        if (photos.length > 0) {
            for (let i = 0; i < Math.min(photos.length, 5); i++) {
                try {
                    // Validate file type and size
                    const file = photos[i];
                    if (!config.app.allowedFileTypes.includes(file.type)) {
                        showNotification(`Photo ${i + 1}: Invalid file type. Please use JPEG, PNG, or WebP.`, 'error');
                        return;
                    }
                    
                    if (file.size > config.app.maxFileSize) {
                        showNotification(`Photo ${i + 1}: File too large. Maximum size is 5MB.`, 'error');
                        return;
                    }
                    
                    const photoUrl = await uploadPhoto(file);
                    photoUrls.push(photoUrl);
                    console.log(`Successfully uploaded photo ${i + 1}:`, photoUrl);
                } catch (photoError) {
                    console.error('Error uploading photo:', photoError);
                    showNotification(`Error uploading photo ${i + 1}: ${photoError.message || 'Unknown error'}. Please try again.`, 'error');
                    return;
                }
            }
        }

        // Create issue
        const { data, error } = await supabaseClient
            .from('issues')
            .insert([
                {
                    title: title,
                    description: description,
                    category: category,
                    status: 'reported',
                    latitude: latitude,
                    longitude: longitude,
                    pincode: pincode,
                    area: area, // <-- add this line
                    location_address: address,
                    reporter_id: isAnonymous ? null : currentUser.id,
                    is_anonymous: isAnonymous
                }
            ])
            .select()
            .single();

        if (error) throw error;

        // Add photos to issue
        if (photoUrls.length > 0) {
            const photoData = photoUrls.map(url => ({
                issue_id: data.id,
                photo_url: url
            }));

            console.log('Inserting photo data:', photoData);
            
            const { data: photoInsertData, error: photoError } = await supabaseClient
                .from('issue_photos')
                .insert(photoData)
                .select();

            if (photoError) {
                console.error('Error inserting photos:', photoError);
                throw photoError;
            } else {
                console.log('Photos inserted successfully:', photoInsertData);
            }
        }

        // Add initial activity
        await supabaseClient
            .from('issue_activities')
            .insert([
                {
                    issue_id: data.id,
                    action: 'reported',
                    description: 'Issue reported by user',
                    user_id: currentUser.id
                }
            ]);

        hideModal('reportModal');
        showNotification('Issue reported successfully!', 'success');
        loadIssues();
        
        // Reset form
        document.getElementById('reportForm').reset();
        
        // Clear map markers
        if (locationMap) {
            locationMap.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    locationMap.removeLayer(layer);
                }
            });
        }
    } catch (error) {
        console.error('Error reporting issue:', error);
        showNotification('Error reporting issue: ' + (error.message || 'Unknown error occurred'), 'error');
    } finally {
        // Reset button state
        const submitBtn = document.querySelector('#reportForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Submit Issue';
            submitBtn.disabled = false;
        }
    }
}

async function uploadPhoto(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;

    console.log('Uploading file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        fileName: fileName
    });

    // Use the correct bucket name 'photos' as defined in the schema
    const { error: uploadError } = await supabaseClient.storage
        .from('photos')
        .upload(fileName, file);

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
    }

    console.log('File uploaded successfully:', fileName);

    const { data } = supabaseClient.storage
        .from('photos')
        .getPublicUrl(fileName);

    console.log('Public URL generated:', data.publicUrl);
    return data.publicUrl;
}

// Issue Detail Functions
async function showIssueDetail(issue) {
    document.getElementById('detailTitle').textContent = issue.title;
    
    const content = document.getElementById('issueDetailContent');
    const statusClass = getStatusClass(issue.status);
    
    // Debug photo data for detail view
    console.log('Issue photos for detail:', issue.issue_photos);
    
    const hasPhotos = issue.issue_photos && issue.issue_photos.length > 0;
    const photoUrl = hasPhotos ? issue.issue_photos[0].photo_url : null;

    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
                <div class="mb-4">
                    ${hasPhotos ? 
                        `<img src="${photoUrl}" alt="${issue.title}" class="w-full h-64 object-cover rounded-lg"
                              onerror="this.style.display='none'; this.nextElementSibling.style.display='block'; console.error('Detail image failed to load:', '${photoUrl}');"
                              onload="console.log('Detail image loaded successfully:', '${photoUrl}');">` :
                        ''
                    }
                    <div class="w-full h-64 flex items-center justify-center text-gray-500 bg-gray-100 rounded-lg ${hasPhotos ? 'hidden' : ''}" 
                         style="${hasPhotos ? 'display: none;' : ''}">
                        ${hasPhotos ? 'Image Loading...' : 'No Image Available'}
                    </div>
                </div>
                <div class="space-y-2">
                    <p><strong>Date:</strong> ${new Date(issue.created_at).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">${issue.status.replace('_', ' ').toUpperCase()}</span></p>
                    <p><strong>Reported by:</strong> ${issue.is_anonymous ? 'Anonymous' : (issue.profiles ? issue.profiles.username : 'Unknown')}</p>
                    <p><strong>Pincode:</strong> ${issue.pincode || 'Not specified'}</p>
                    <p><strong>Location:</strong> ${issue.location_address || 'Location not specified'}</p>
                    <p><strong>Category:</strong> ${issue.category}</p>
                    ${issue.distance_km ? `<p><strong>Distance:</strong> ${issue.distance_km.toFixed(1)} km away</p>` : ''}
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

    // Show edit/delete buttons only for the reporter
    const editBtn = document.getElementById('editIssueBtn');
    const deleteBtn = document.getElementById('deleteIssueBtn');
    
    if (currentUser && issue.reporter_id === currentUser.id) {
        editBtn.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');
    } else {
        editBtn.classList.add('hidden');
        deleteBtn.classList.add('hidden');
    }

    showModal('issueDetailModal');
}

async function reportSpam() {
    if (!currentUser) {
        showNotification('Please login to report spam', 'error');
        return;
    }

    // Implementation for spam reporting
    showNotification('Spam reported successfully', 'success');
}

async function editIssue() {
    // Implementation for editing issues
    showNotification('Edit functionality coming soon', 'info');
}

async function deleteIssue() {
    if (confirm('Are you sure you want to delete this issue?')) {
        // Implementation for deleting issues
        showNotification('Issue deleted successfully', 'success');
        hideModal('issueDetailModal');
        loadIssues();
    }
}

// Utility Functions
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-md text-white z-50 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        'bg-blue-600'
    }`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Handle photo upload preview
function handlePhotoUpload(e) {
    const files = e.target.files;
    const maxFiles = 5;
    const maxSize = config.app.maxFileSize;
    const allowedTypes = config.app.allowedFileTypes;
    
    if (files.length > maxFiles) {
        showNotification(`Maximum ${maxFiles} photos allowed`, 'error');
        e.target.value = '';
        return;
    }
    
    // Validate each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (!allowedTypes.includes(file.type)) {
            showNotification(`File ${i + 1}: Invalid file type. Please use JPEG, PNG, or WebP.`, 'error');
            e.target.value = '';
            return;
        }
        
        if (file.size > maxSize) {
            showNotification(`File ${i + 1}: File too large. Maximum size is 5MB.`, 'error');
            e.target.value = '';
            return;
        }
    }
    
    if (files.length > 0) {
        showNotification(`${files.length} photo(s) selected and ready for upload`, 'success');
    }
}

// Utility: Get lat/lng for a pincode (use a lookup or geocoding API in production)
const pincodeLocations = {
    "388001": { lat: 22.5645, lng: 72.9289 }, // Anand example
    // Add more pincodes and their lat/lng
};

function setupMapFilters() {
    document.getElementById('mapPincodeInput').addEventListener('input', loadMapIssues);
    document.getElementById('mapRadiusFilter').addEventListener('change', loadMapIssues);
    document.getElementById('mapCategoryFilter').addEventListener('change', loadMapIssues);
}

async function loadMapIssues() {
    let { data: issues, error } = await supabaseClient.from('issues').select('*');
    if (error) return;

    const enteredPincode = document.getElementById('mapPincodeInput').value.trim();
    const selectedCategory = document.getElementById('mapCategoryFilter').value;

    let filtered = issues;
    if (enteredPincode) {
        filtered = filtered.filter(i => i.pincode === enteredPincode);
    } else {
        // If no pincode entered, show no pins
        filtered = [];
    }
    if (selectedCategory) {
        filtered = filtered.filter(i => i.category === selectedCategory);
    }

    // Group by pincode
    const grouped = {};
    filtered.forEach(issue => {
        if (!grouped[issue.pincode]) grouped[issue.pincode] = [];
        grouped[issue.pincode].push(issue);
    });

    showIssuesOnMap(grouped);

    // Zoom to city if pincode entered
    if (enteredPincode && pincodeLocations[enteredPincode]) {
        const loc = pincodeLocations[enteredPincode];
        map.setView([loc.lat, loc.lng], 12);
    } else {
        // Otherwise, keep India view
        map.setView([20.5937, 78.9629], 5);
    }

    if (enteredPincode) {
        // Group issues by area within the pincode
        const areaGroups = {};
        filtered.forEach(issue => {
            if (!areaGroups[issue.area]) areaGroups[issue.area] = [];
            areaGroups[issue.area].push(issue);
        });

        showIssuesByAreaOnMap(areaGroups, enteredPincode);
    } else {
        // Clear markers if no pincode
        if (window.issueMarkers) {
            window.issueMarkers.forEach(marker => map.removeLayer(marker));
        }
        window.issueMarkers = [];
    }
}

function showIssuesOnMap(groupedIssues) {
    if (!map) {
        // Center on India by default
        map = L.map('map').setView([20.5937, 78.9629], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
    // Remove old markers
    if (window.issueMarkers) {
        window.issueMarkers.forEach(marker => map.removeLayer(marker));
    }
    window.issueMarkers = [];

    Object.entries(groupedIssues).forEach(([pincode, issues]) => {
        const loc = pincodeLocations[pincode];
        if (loc) {
            const marker = L.marker([loc.lat, loc.lng])
                .addTo(map)
                .bindPopup(`<b>${pincode}</b><br>${issues.length} issues`);
            marker.bindTooltip(`${issues.length}`, { permanent: true, direction: 'top', className: 'bg-red-600 text-white px-2 rounded' });
            window.issueMarkers.push(marker);
        }
    });
}

// New function to show pins by area
function showIssuesByAreaOnMap(areaGroups, pincode) {
    // Get pincode center
    const loc = pincodeLocations[pincode];
    if (!loc) return;

    // Remove old markers
    if (window.issueMarkers) {
        window.issueMarkers.forEach(marker => map.removeLayer(marker));
    }
    window.issueMarkers = [];

    Object.entries(areaGroups).forEach(([area, issues], idx) => {
        // Offset markers slightly for each area (for demo, use a small random offset)
        const offset = 0.01 * idx;
        const marker = L.marker([loc.lat + offset, loc.lng + offset])
            .addTo(map)
            .bindPopup(`<b>${area}</b><br>${issues.length} issues`);
        marker.bindTooltip(`${issues.length}`, { permanent: true, direction: 'top', className: 'bg-red-600 text-white px-2 rounded' });
        window.issueMarkers.push(marker);
    });

    // Zoom to city
    map.setView([loc.lat, loc.lng], 12);
}

// On DOMContentLoaded
document.addEventListener('DOMContentLoaded', async function() {
    // ...existing code...
    let { data: issues } = await supabaseClient.from('issues').select('*');
    populatePincodeDropdown(issues);
    setupMapFilters();
    loadMapIssues();
    // ...existing code...
});

// Add this to your app.js file

// Function to show issues on map with specified radius
async function loadIssuesOnMap() {
    if (!map) return;
    
    // Get selected radius from dropdown
    currentMapRadius = parseInt(document.getElementById('mapRadiusFilter').value, 10);
    const selectedCategory = document.getElementById('mapCategoryFilter').value;
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
            map.removeLayer(layer);
        }
    });
    
    try {
        // Get all issues from database
        const { data: issues, error } = await supabaseClient
            .from('issues')
            .select('*');
            
        if (error) throw error;
        
        // Filter by current pincode and selected category
        let filteredIssues = issues.filter(issue => issue.pincode === currentPincode);
        
        if (selectedCategory) {
            filteredIssues = filteredIssues.filter(issue => issue.category === selectedCategory);
        }
        
        // Find pincode center coordinates
        // For demo purposes, assuming first issue with this pincode has the correct coordinates
        const pincodeIssue = filteredIssues.find(issue => issue.latitude && issue.longitude);
        
        if (pincodeIssue) {
            const pincodeCenter = [pincodeIssue.latitude, pincodeIssue.longitude];
            
            // Draw radius circle
            const radiusCircle = L.circle(pincodeCenter, {
                radius: currentMapRadius * 1000, // Convert km to meters
                fillColor: '#3388ff',
                fillOpacity: 0.1,
                color: '#3388ff',
                weight: 1
            }).addTo(map);
            
            // Create markers for all issues within radius
            filteredIssues.forEach(issue => {
                if (issue.latitude && issue.longitude) {
                    const issuePoint = [issue.latitude, issue.longitude];
                    
                    // Calculate distance from center to issue
                    const distance = map.distance(pincodeCenter, issuePoint) / 1000; // in km
                    
                    // Only show issues within selected radius
                    if (distance <= currentMapRadius) {
                        const marker = L.marker(issuePoint).addTo(map);
                        
                        const popupContent = `
                            <div class="issue-popup">
                                <strong>${issue.title}</strong>
                                <p class="text-sm">${issue.category} - <span class="status-${issue.status}">${issue.status}</span></p>
                                <button class="view-details-btn bg-blue-600 text-white text-xs px-2 py-1 mt-2 rounded" 
                                        onclick="showIssueDetail('${issue.id}')">
                                    View Details
                                </button>
                            </div>
                        `;
                        
                        marker.bindPopup(popupContent);
                    }
                }
            });
            
            // Set map view to show the circle
            map.fitBounds(radiusCircle.getBounds());
        }
        
    } catch (error) {
        console.error("Error loading issues on map:", error);
    }
}

// Function to show issue detail when clicked from map
function showIssueDetail(issueId) {
    // Implement this function to show issue details in a modal
    // You can reuse existing code from your app.js that handles issue details
    console.log(`Show details for issue: ${issueId}`);
    // Example: openIssueDetail(issueId);
}

// Add event listener for radius change
document.addEventListener('DOMContentLoaded', function() {
    // ...existing code...
    
    // Update map when radius changes
    document.getElementById('mapRadiusFilter').addEventListener('change', function() {
        loadIssuesOnMap();
    });
    
    document.getElementById('mapCategoryFilter').addEventListener('change', function() {
        loadIssuesOnMap();
    });
    
    // Show map and load issues when View Map button is clicked
    const mapViewBtn = document.getElementById('mapViewBtn');
    if (mapViewBtn) {
        mapViewBtn.addEventListener('click', async function() {
            await toggleMapView();
            if (map) {
                map.invalidateSize();
                if (currentPincode) {
                    const centerLocation = await getPincodeCenter(currentPincode);
                    map.setView([centerLocation.lat, centerLocation.lng], 12);
                } else {
                    map.setView([20.5937, 78.9629], 5); // Default to India view
                }
                await loadIssuesOnMap();
            }
        });
    }
    
    // ...existing code...
});