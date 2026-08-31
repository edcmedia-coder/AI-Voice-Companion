import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Use custom Firestore Database ID if present in the config
const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId || "(default)");

export { app, auth, db };
