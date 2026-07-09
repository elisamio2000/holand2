/**
 * MongoDB Collection Inspector
 * Checks if photo_tagger.files collection exists and has data
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://10.9.0.6:27017';
const MONGODB_DB = 'photo_tagger';

async function inspectDatabase() {
  console.log('='.repeat(60));
  console.log('MongoDB Collection Inspector');
  console.log('='.repeat(60));
  console.log(`\nConnecting to: ${MONGODB_URI}`);
  console.log(`Database: ${MONGODB_DB}\n`);
  
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully\n');
    
    const db = client.db(MONGODB_DB);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`📂 Collections in ${MONGODB_DB}:`);
    
    if (collections.length === 0) {
      console.log('   ⚠️  No collections found!');
      console.log('\n❗ Database is empty — need to run data migration/import first');
      console.log('\n💡 Expected collection: "files" (media files with GPS metadata)');
      console.log('   Structure: { _id, path, size, mime_type, gps_latitude, gps_longitude, ... }');
    } else {
      for (const col of collections) {
        console.log(`\n   📁 ${col.name}`);
        const collection = db.collection(col.name);
        const count = await collection.countDocuments();
        console.log(`      Documents: ${count.toLocaleString()}`);
        
        if (count > 0) {
          // Show a sample document
          const sample = await collection.findOne({});
          const keys = Object.keys(sample);
          console.log(`      Fields (${keys.length}): ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`);
          
          // Check for GPS fields
          const gpsCount = await collection.countDocuments({
            gps_latitude: { $exists: true, $ne: null },
            gps_longitude: { $exists: true, $ne: null },
          });
          console.log(`      With GPS: ${gpsCount.toLocaleString()} (${(gpsCount / count * 100).toFixed(1)}%)`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    await client.close();
  }
}

inspectDatabase().catch(console.error);
