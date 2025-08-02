// CivicTrack Configuration
// IMPORTANT: Replace the placeholder values below with your actual Supabase credentials

const config = {
    // Supabase Configuration
    supabase: {
        // Replace 'YOUR_SUPABASE_URL' with your actual Supabase project URL
        // Example: 'https://abcdefghijklmnop.supabase.co'
        url: 'https://sgxoyoiemnikgwyqhvmw.supabase.co',
        
        // Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase anon key
        // Example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneG95b2llbW5pa2d3eXFodm13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMDY0NDIsImV4cCI6MjA2OTY4MjQ0Mn0.dbz8doLYQRuJJFzWu4U8QLXT61o_DdF2N3U-UvHgQpo'
    },
    
    // Application Settings
    app: {
        name: 'CivicTrack',
        version: '1.0.0',
        defaultLocation: {
            lat: 20.5937, // Default to India center
            lng: 78.9629
        },
        maxPhotosPerIssue: 5,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/webp'],
        issuesPerPage: 9,
        defaultRadius: 5, // km
        spamThreshold: 5 // Number of spam reports before auto-hide
    },
    
    // Map Configuration
    map: {
        defaultZoom: 13,
        maxZoom: 18,
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors'
    },
    
    // API Endpoints
    api: {
        nominatim: 'https://nominatim.openstreetmap.org/reverse'
    },
    
    // Categories
    categories: {
        roads: {
            name: 'Roads',
            icon: '🛣️',
            description: 'Potholes, obstructions, road damage'
        },
        lighting: {
            name: 'Lighting',
            icon: '💡',
            description: 'Broken or flickering street lights'
        },
        water: {
            name: 'Water Supply',
            icon: '💧',
            description: 'Leaks, low pressure, water issues'
        },
        cleanliness: {
            name: 'Cleanliness',
            icon: '🧹',
            description: 'Overflowing bins, garbage, waste'
        },
        safety: {
            name: 'Public Safety',
            icon: '⚠️',
            description: 'Open manholes, exposed wiring, hazards'
        },
        obstructions: {
            name: 'Obstructions',
            icon: '🌳',
            description: 'Fallen trees, debris, blockages'
        }
    },
    
    // Status Options
    statuses: {
        reported: {
            name: 'Reported',
            color: 'yellow',
            description: 'Issue has been reported and is pending review'
        },
        in_progress: {
            name: 'In Progress',
            color: 'blue',
            description: 'Issue is being worked on'
        },
        resolved: {
            name: 'Resolved',
            color: 'green',
            description: 'Issue has been resolved'
        }
    },
    
    // Distance Options
    distances: [
        { value: 1, label: '1 km' },
        { value: 3, label: '3 km' },
        { value: 5, label: '5 km' }
    ]
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
} 