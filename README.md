# Imageflow Case v1.0

Modular repo for experimenting with image workflows. The project splits UI and server concerns into dedicated packages to keep responsibilities clear and extensible.

## Structure

- `frontend/` – Next.js (TypeScript, App Router) client with upload UI and API route proxy.
- `backend/` – Node.js + Express service that will host fal.ai integration logic.

## Environment

Both packages rely on an API credential for fal.ai and now Firebase for Auth + Firestore persistence. Create a root `.env` (or copy from `.env.example`) with:

```
FAL_SUBSCRIBER_KEY=your_fal_ai_key
BACKEND_PORT=4000
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000
```

### Firebase (Backend / Admin SDK)

```
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your_project_id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Note:** Copy the service-account JSON from the Firebase console and map fields to the env vars above. Remember to escape newline characters (`\n`) if you store the key on one line.

### Firebase (Frontend SDK)

Create `frontend/.env.local` (or extend an existing one) with:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_FIREBASE_API_KEY=your_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Each package will load the variables it needs via its own tooling. Keep secrets out of version control. The backend now persists pipeline hierarchies (original uploads + processed versions) inside Firestore, scoped per Firebase Auth user.

## Getting Started

1. Install dependencies once the package scaffolds exist:
   - `cd frontend && npm install`
   - `cd backend && npm install`
2. Run backend server first so the frontend proxy can forward requests.
3. Start the frontend dev server to interact with the UI.

More detailed run instructions live inside each package README.

