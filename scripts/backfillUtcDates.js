// Backfill script to ensure every class document has a canonical utcDate
// Usage: node scripts/backfillUtcDates.js
// Requires serviceAccountKey.json at project root (same as seed script)

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const serviceAccountPath = path.join(projectRoot, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('serviceAccountKey.json not found at', serviceAccountPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath))
});

const firestore = admin.firestore();

function isFirestoreTimestamp(val) {
  return val && typeof val.toDate === 'function';
}

function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (isFirestoreTimestamp(val)) return val.toDate();
  if (typeof val === 'number' || typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

(async function run() {
  console.log('Starting backfill of utcDate for classes...');
  const classesRef = firestore.collection('classes');
  const snapshot = await classesRef.get();
  console.log('Fetched', snapshot.size, 'class docs');

  let updated = 0;
  let skipped = 0;
  let batch = firestore.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // If utcDate already exists, skip
    if (data.utcDate) {
      skipped++;
      continue;
    }

    // Derive base date (classDate preferred)
    const base = toDate(data.classDate || data.date || data.startDate);
    if (!base) {
      console.warn('Skipping doc without usable date:', doc.id);
      continue;
    }

    // If the date appears to already be UTC, we still store canonical UTC copy.
    // We assume stored classDate is local teacher time originally; we treat it as-is and set utcDate to same instant.
    const utcDate = new Date(base.getTime());

    batch.update(doc.ref, { utcDate });
    updated++; batchOps++;
    if (batchOps === 450) { // keep margin under 500
      await batch.commit();
      console.log('Committed batch. Total updated so far:', updated);
      batch = firestore.batch();
      batchOps = 0;
    }
  }

  if (batchOps) {
    await batch.commit();
  }

  console.log('Backfill complete. Updated:', updated, 'Skipped (already had utcDate):', skipped);
  process.exit(0);
})().catch(err => {
  console.error('Backfill failed', err);
  process.exit(1);
});
