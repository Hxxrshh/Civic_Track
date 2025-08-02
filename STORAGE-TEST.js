// STORAGE TEST - Run this in browser console after fixing storage
// Copy and paste this into browser console (F12)

console.log('🧪 Testing Storage Functionality...');

// Test 1: Check if photos bucket exists
console.log('\n1️⃣ Checking Photos Bucket...');
supabaseClient.storage.listBuckets().then(result => {
    if (result.error) {
        console.error('❌ Storage error:', result.error);
        return;
    }
    
    const photosBucket = result.data.find(b => b.name === 'photos');
    if (photosBucket) {
        console.log('✅ Photos bucket found:', photosBucket);
        
        // Test 2: List files in bucket
        console.log('\n2️⃣ Listing Files in Bucket...');
        return supabaseClient.storage.from('photos').list();
    } else {
        console.error('❌ Photos bucket not found!');
        console.log('Available buckets:', result.data.map(b => b.name));
        console.log('💡 Run the IMMEDIATE-STORAGE-FIX.sql script in Supabase!');
    }
}).then(filesResult => {
    if (filesResult && !filesResult.error) {
        console.log('✅ Files in bucket:', filesResult.data?.length || 0);
        if (filesResult.data && filesResult.data.length > 0) {
            console.log('📁 File list:', filesResult.data.map(f => f.name));
        }
    } else if (filesResult && filesResult.error) {
        console.error('❌ Error listing files:', filesResult.error);
    }
}).catch(error => {
    console.error('❌ Storage test failed:', error);
});

// Test 3: Test upload permissions
console.log('\n3️⃣ Testing Upload Permissions...');
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
supabaseClient.storage.from('photos').upload('test-' + Date.now() + '.txt', testFile).then(result => {
    if (result.error) {
        console.error('❌ Upload test failed:', result.error);
    } else {
        console.log('✅ Upload test successful:', result.data);
        
        // Clean up test file
        supabaseClient.storage.from('photos').remove([result.data.path]).then(() => {
            console.log('🧹 Test file cleaned up');
        });
    }
}).catch(error => {
    console.error('❌ Upload test error:', error);
});

// Test 4: Check existing issue photos
console.log('\n4️⃣ Checking Existing Issue Photos...');
supabaseClient.from('issue_photos').select('*').then(result => {
    if (result.error) {
        console.error('❌ Error fetching issue photos:', result.error);
    } else {
        console.log('✅ Issue photos found:', result.data?.length || 0);
        if (result.data && result.data.length > 0) {
            console.log('📸 Photo URLs:', result.data.map(p => p.photo_url));
            
            // Test 5: Check if photo URLs are accessible
            console.log('\n5️⃣ Testing Photo URL Accessibility...');
            result.data.slice(0, 3).forEach((photo, index) => {
                fetch(photo.photo_url, { method: 'HEAD' }).then(response => {
                    if (response.ok) {
                        console.log(`✅ Photo ${index + 1} accessible:`, photo.photo_url);
                    } else {
                        console.error(`❌ Photo ${index + 1} not accessible:`, photo.photo_url);
                    }
                }).catch(error => {
                    console.error(`❌ Photo ${index + 1} error:`, error);
                });
            });
        }
    }
});

// Final summary
setTimeout(() => {
    console.log('\n🎯 STORAGE TEST SUMMARY');
    console.log('If you see mostly ✅ marks, storage is working correctly!');
    console.log('If you see ❌ marks, the storage bucket needs to be created.');
    console.log('\n📋 Next Steps:');
    console.log('1. If bucket not found: Run IMMEDIATE-STORAGE-FIX.sql');
    console.log('2. If upload fails: Check storage policies');
    console.log('3. If URLs not accessible: Check bucket is public');
    console.log('4. Try uploading a new photo to test');
}, 3000); 