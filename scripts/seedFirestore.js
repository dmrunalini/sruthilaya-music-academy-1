const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
const dbDir = path.join(projectRoot, 'db');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('serviceAccountKey.json not found in project root. Download from Firebase Console and place it at:', serviceAccountPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const firestore = admin.firestore();

function convertIsoStringsToTimestamps(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // ISO datetime detection (basic)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d)) obj[key] = admin.firestore.Timestamp.fromDate(d);
      }
    } else if (typeof val === 'object') {
      convertIsoStringsToTimestamps(val);
    }
  }
}

async function seedFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let docs;
  try {
    docs = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON:', filePath, err.message);
    return;
  }
  if (!Array.isArray(docs)) {
    console.warn('Skipping non-array JSON file:', filePath);
    return;
  }

  const collectionName = path.basename(filePath, '.json');
  console.log(`Seeding collection: ${collectionName} from ${path.basename(filePath)} (${docs.length} docs)`);

  let batch = firestore.batch();
  let opCount = 0;
  for (const doc of docs) {
    const docCopy = Object.assign({}, doc);
    const id = docCopy.id || firestore.collection(collectionName).doc().id;
    delete docCopy.id;
    convertIsoStringsToTimestamps(docCopy);
    const docRef = firestore.collection(collectionName).doc(id);
    batch.set(docRef, docCopy);
    opCount++;
    if (opCount === 500) {
      await batch.commit();
      batch = firestore.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();
  console.log(`Finished seeding collection: ${collectionName}`);
}

async function run() {
  if (!fs.existsSync(dbDir)) {
    console.error('db directory not found at:', dbDir);
    process.exit(1);
  }

  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('No JSON files found in db directory:', dbDir);
    process.exit(1);
  }

  for (const file of files) {
    try {
      await seedFile(path.join(dbDir, file));
    } catch (err) {
      console.error('Error seeding file', file, err);
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
}

run().catch(err => {
  console.error('Seeder failed:', err);
  process.exit(1);
});