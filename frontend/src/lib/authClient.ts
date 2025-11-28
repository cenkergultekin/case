'use client';

import { getFirebaseAuth } from './firebaseClient';

export const fetchIdToken = async () => {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User is not authenticated. Please log in.');
  }

  return user.getIdToken();
};

