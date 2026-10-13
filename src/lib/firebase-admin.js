import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Hosting dashboards (e.g. Vercel) often keep the surrounding quotes or stray whitespace that a
// .env file uses, which makes the values unparseable — strip them before use.
const cleanEnv = (value) => value?.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();

const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID);
const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = cleanEnv(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n');

let adminApp = null;
// Set when credentials exist but can't be used, so API routes can report it instead of crashing.
export let adminInitError = null;

if (projectId && clientEmail && privateKey) {
  try {
    adminApp = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } catch (error) {
    adminInitError = `Firebase Admin credentials are invalid: ${error.message}`;
    console.error(adminInitError);
  }
}

export const adminAuth = adminApp ? getAuth(adminApp) : null;
export const adminDb = adminApp ? getFirestore(adminApp) : null;
