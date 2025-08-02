// BUCKET DIAGNOSTIC - Run this in browser console to identify the exact issue
// Copy and paste this into browser console (F12)

console.log('🔍 Storage Bucket Diagnostic Starting...');

// Check 1: Supabase Connection
console.log('\n1️⃣ Testing Supabase Connection...');
try {
    console.log('Supabase URL:', config.supabase.url);
    console.log('Supabase Key:', config.supabase.anonKey ? '✅ Present' : '❌ Missing');
} catch (error) {
    console.error('❌ Config error:', error);
    return;
}

// Check 2: Storage API Access
console.log('\n2️⃣ Testing Storage API Access...');
supabaseClient.storage.listBuckets().then(result => {
    if (result.error) {
        console.error('❌ Storage API Error:', result.error);
        console.log('💡 This might be a permissions issue');
        return;
    }
    
    console.log('✅ Storage API working');
    console.log('📦 Available buckets:', result.data.map(b => b.name));
    
    // Check 3: Look for photos bucket
    console.log('\n3️⃣ Checking for Photos Bucket...');
    const photosBucket = result.data.find(b => b.name === 'photos');
    
    if (photosBucket) {
        console.log('✅ Photos bucket found:', photosBucket);
        console.log('Public:', photosBucket.public ? '✅ Yes' : '❌ No');
        
        // Check 4: Test bucket access
        console.log('\n4️⃣ Testing Photos Bucket Access...');
        supabaseClient.storage.from('photos').list().then(files => {
            if (files.error) {
                console.error('❌ Bucket access error:', files.error);
            } else {
                console.log('✅ Bucket access successful');
                console.log('📁 Files in bucket:', files.data?.length || 0);
            }
        });
        
    } else {
        console.error('❌ Photos bucket NOT found!');
        console.log('💡 You need to create the photos bucket');
        console.log('📋 Available buckets:', result.data.map(b => b.name));
        
        // Check 5: Try to create bucket (this might fail due to permissions)
        console.log('\n5️⃣ Attempting to Create Photos Bucket...');
        console.log('⚠️ This might fail if you don\'t have admin permissions');
        
        // Note: We can't create buckets via client-side code
        console.log('💡 You need to create the bucket manually in Supabase dashboard');
        console.log('📋 Steps:');
        console.log('1. Go to Supabase Dashboard');
        console.log('2. Click "Storage" in sidebar');
        console.log('3. Click "Create a new bucket"');
        console.log('4. Name it "photos"');
        console.log('5. Check "Public bucket"');
        console.log('6. Click "Create bucket"');
    }
    
}).catch(error => {
    console.error('❌ Storage check failed:', error);
    console.log('💡 This might be a network or configuration issue');
});

// Check 6: Test upload (this will fail if bucket doesn't exist)
console.log('\n6️⃣ Testing Upload (will fail if bucket missing)...');
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
supabaseClient.storage.from('photos').upload('test-' + Date.now() + '.txt', testFile).then(result => {
    if (result.error) {
        console.error('❌ Upload test failed:', result.error);
        if (result.error.message.includes('bucket')) {
            console.log('💡 This confirms the bucket is missing');
        }
    } else {
        console.log('✅ Upload test successful!');
        // Clean up
        supabaseClient.storage.from('photos').remove([result.data.path]);
    }
}).catch(error => {
    console.error('❌ Upload test error:', error);
});

// Final summary
setTimeout(() => {
    console.log('\n🎯 DIAGNOSTIC SUMMARY');
    console.log('If you see "Photos bucket NOT found", you need to create it manually.');
    console.log('If you see "Photos bucket found", the issue might be permissions.');
    console.log('\n📋 Next Steps:');
    console.log('1. Create photos bucket in Supabase dashboard');
    console.log('2. Make sure it\'s set to "Public"');
    console.log('3. Refresh your application');
    console.log('4. Try uploading a photo again');
}, 3000); 