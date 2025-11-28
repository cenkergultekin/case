'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const validateConfig = () => {
  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Firebase client config: ${missing.join(', ')}`);
  }
};

let firebaseApp: ReturnType<typeof initializeApp> | null = null;

export const getFirebaseApp = () => {
  if (!firebaseApp) {
    validateConfig();
    firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  }
  return firebaseApp;
};

export const getFirebaseAuth = () => getAuth(getFirebaseApp());

