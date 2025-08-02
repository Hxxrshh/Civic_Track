// DIAGNOSTIC CHECK - Run this in browser console to check for issues
// Copy and paste this into browser console (F12)

console.log('🔍 Starting CivicTrack Diagnostic Check...');

// Check 1: Supabase Configuration
console.log('\n1️⃣ Checking Supabase Configuration...');
try {
    console.log('Supabase URL:', config.supabase.url);
    console.log('Supabase Key:', config.supabase.anonKey ? '✅ Present' : '❌ Missing');
    console.log('App Config:', config.app);
} catch (error) {
    console.error('❌ Config error:', error);
}

// Check 2: Supabase Connection
console.log('\n2️⃣ Testing Supabase Connection...');
supabaseClient.from('issues').select('count').then(result => {
    if (result.error) {
        console.error('❌ Database connection failed:', result.error);
    } else {
        console.log('✅ Database connection successful');
    }
}).catch(error => {
    console.error('❌ Database connection error:', error);
});

// Check 3: Storage Bucket
console.log('\n3️⃣ Checking Storage Bucket...');
supabaseClient.storage.listBuckets().then(result => {
    if (result.error) {
        console.error('❌ Storage error:', result.error);
    } else {
        const photosBucket = result.data.find(b => b.name === 'photos');
        if (photosBucket) {
            console.log('✅ Photos bucket found');
            // Check files in bucket
            supabaseClient.storage.from('photos').list().then(files => {
                console.log('📁 Files in bucket:', files.data?.length || 0);
            });
        } else {
            console.error('❌ Photos bucket not found');
        }
    }
}).catch(error => {
    console.error('❌ Storage check error:', error);
});

// Check 4: Database Tables
console.log('\n4️⃣ Checking Database Tables...');
Promise.all([
    supabaseClient.from('issues').select('count'),
    supabaseClient.from('profiles').select('count'),
    supabaseClient.from('issue_photos').select('count'),
    supabaseClient.from('issue_activities').select('count')
]).then(results => {
    console.log('✅ Issues table:', results[0].count || 0, 'records');
    console.log('✅ Profiles table:', results[1].count || 0, 'records');
    console.log('✅ Issue photos table:', results[2].count || 0, 'records');
    console.log('✅ Issue activities table:', results[3].count || 0, 'records');
}).catch(error => {
    console.error('❌ Table check error:', error);
});

// Check 5: Current Application State
console.log('\n5️⃣ Checking Application State...');
console.log('Current user:', currentUser ? '✅ Logged in' : '❌ Not logged in');
console.log('Current pincode:', currentPincode || '❌ Not set');
console.log('All issues count:', allIssues.length);
console.log('Filtered issues count:', filteredIssues.length);

// Check 6: Map Status
console.log('\n6️⃣ Checking Map Status...');
if (map) {
    console.log('✅ Main map initialized');
    console.log('Map center:', map.getCenter());
    console.log('Map zoom:', map.getZoom());
} else {
    console.log('❌ Main map not initialized');
}

if (locationMap) {
    console.log('✅ Location map initialized');
} else {
    console.log('❌ Location map not initialized');
}

// Check 7: DOM Elements
console.log('\n7️⃣ Checking DOM Elements...');
const elements = [
    'issuesGrid',
    'mapView',
    'reportModal',
    'authModal',
    'map'
];

elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ ${id} element found`);
    } else {
        console.log(`❌ ${id} element missing`);
    }
});

// Check 8: Libraries
console.log('\n8️⃣ Checking External Libraries...');
if (typeof L !== 'undefined') {
    console.log('✅ Leaflet library loaded');
} else {
    console.log('❌ Leaflet library not loaded');
}

if (typeof supabase !== 'undefined') {
    console.log('✅ Supabase library loaded');
} else {
    console.log('❌ Supabase library not loaded');
}

// Final Summary
setTimeout(() => {
    console.log('\n🎯 DIAGNOSTIC SUMMARY');
    console.log('If you see mostly ✅ marks, your application is working correctly!');
    console.log('If you see ❌ marks, follow the troubleshooting guide to fix those issues.');
    console.log('\n📋 Next Steps:');
    console.log('1. Check the console for any error messages');
    console.log('2. Try uploading a new issue with photos');
    console.log('3. Test the map view functionality');
    console.log('4. Verify user registration/login works');
}, 2000); 