import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// In a production environment, you would use GOOGLE_APPLICATION_CREDENTIALS
// For this environment, we assume the credentials are implicitly configured.
const app = initializeApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
