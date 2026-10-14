import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey,
  }),
});
const db = getFirestore(app);

const doc = await db.collection('events').doc('winter_wonderland_test').get();
console.log('event doc exists:', doc.exists);
console.log('event doc data:', JSON.stringify(doc.data(), (k, v) => v?.toDate ? v.toDate().toISOString() : v, 2));

console.log('\nnow (UTC):', new Date().toISOString());
const p = (n) => String(n).padStart(2, '0');
const now = new Date();
const todayKey = `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}`;
console.log('todayKey (UTC, matches app):', todayKey);

const wordsSnap = await db.collection('events').doc('winter_wonderland_test')
  .collection('daily_challenges').doc(todayKey).collection('words').get();
console.log(`words for ${todayKey}:`, wordsSnap.size);

process.exit(0);
