import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

const getServiceAccountConfig = () => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials are missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.');
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
};

export const getFirebaseAdminApp = (): admin.app.App => {
  if (!firebaseApp) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(getServiceAccountConfig())
    });
  }

  return firebaseApp;
};

export const getFirestore = () => getFirebaseAdminApp().firestore();
export const getAuth = () => getFirebaseAdminApp().auth();

