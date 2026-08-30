import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// On Firebase App Hosting the backend service account is picked up
// automatically (Application Default Credentials). Locally you need
// GOOGLE_APPLICATION_CREDENTIALS pointing at a service account JSON.
//
// initializeApp()/getFirestore() don't verify credentials — the first
// real query does. So callers wrap reads/writes in try/catch and treat a
// failure as "admin unavailable": the public site (including
// /api/generate, which falls back to env config) keeps working.
let db = null
try {
  if (!getApps().length) initializeApp()
  db = getFirestore()
} catch (err) {
  console.warn('[firebase-admin] init failed:', err?.message || err)
}

export function getDb() {
  return db
}
