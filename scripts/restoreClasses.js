// Script to wipe and restore the 'classes' collection from db/classes.json
// Usage: node scripts/restoreClasses.js   (or: npm run restore:classes)
// Requires serviceAccountKey.json at project root.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const projectRoot = path.resolve(__dirname, '..');
const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');
const classesFile = path.join(projectRoot, 'db', 'classes.json');
const COLLECTION = 'classes';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('ERROR: serviceAccountKey.json not found at', serviceAccountPath);
  console.error('Download it from Firebase Console > Project Settings > Service Accounts.');
  process.exit(1);
}

if (!fs.existsSync(classesFile)) {
  console.error('ERROR: classes.json not found at', classesFile);
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
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d)) obj[key] = admin.firestore.Timestamp.fromDate(d);
      }
    } else if (val && typeof val === 'object') {
      convertIsoStringsToTimestamps(val);
    }
  }
}

function normalizeClass(doc) {
  const out = { ...doc };
  // legacy mapping
  if (out.studentId && !out.studentUid) {
    out.studentUid = out.studentId;
    delete out.studentId;
  }
  if (!out.classDate && out.start) out.classDate = out.start;
  if (!out.utcDate && out.classDate) out.utcDate = out.classDate;
  if (!out.timeSlot && out.start && out.end) {
    const toDate = v => v && typeof v.toDate === 'function' ? v.toDate() : (v instanceof Date ? v : new Date(v));
    const s = toDate(out.start);
    const e = toDate(out.end);
    if (!isNaN(s) && !isNaN(e)) {
      const fmt = d => d.toISOString().substring(11,16);
      out.timeSlot = `${fmt(s)} - ${fmt(e)}`;
    }
  }
  if (!out.timezone) out.timezone = 'UTC';
  return out;
}

async function deleteAllClasses() {
  console.log('Deleting existing documents from collection:', COLLECTION);
  let totalDeleted = 0;
  while (true) {
    const snap = await firestore.collection(COLLECTION).limit(450).get();
    if (snap.empty) break;
    let batch = firestore.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalDeleted += snap.size;
    console.log('Deleted', totalDeleted, 'documents so far...');
    if (snap.size < 450) break; // last page
  }
  console.log('Finished deleting. Total removed:', totalDeleted);
}

async function loadClasses() {
  console.log('Loading classes from', classesFile);
  const raw = fs.readFileSync(classesFile, 'utf8');
  let docs = JSON.parse(raw);
  if (!Array.isArray(docs)) throw new Error('classes.json must contain an array');
  console.log('Preparing to upload', docs.length, 'documents');
  let batch = firestore.batch();
  let op = 0;
  let uploaded = 0;
  for (const d of docs) {
    const copy = normalizeClass(d);
    convertIsoStringsToTimestamps(copy);
    const id = copy.id || firestore.collection(COLLECTION).doc().id;
    delete copy.id; // Firestore doc id is separate
    const ref = firestore.collection(COLLECTION).doc(id);
    batch.set(ref, copy);
    op++; uploaded++;
    if (op === 450) {
      await batch.commit();
      console.log('Committed batch. Uploaded so far:', uploaded);
      batch = firestore.batch();
      op = 0;
    }
  }
  if (op) await batch.commit();
  console.log('Upload complete. Total uploaded:', uploaded);
}

(async function run() {
  console.log('=== Restoring classes collection ===');
  await deleteAllClasses();
  await loadClasses();
  console.log('=== Restore finished successfully ===');
  process.exit(0);
})().catch(err => {
  console.error('Restore failed', err);
  process.exit(1);
});
