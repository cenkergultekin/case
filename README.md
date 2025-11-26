# Imageflow Case v1.0

Modular repo for experimenting with image workflows. The project splits UI and server concerns into dedicated packages to keep responsibilities clear and extensible.

## Structure

- `frontend/` – Next.js (TypeScript, App Router) client with upload UI and API route proxy.
- `backend/` – Node.js + Express service that will host fal.ai integration logic.

## Environment

Both packages rely on an API credential for fal.ai. Create a root `.env` (or copy from `.env.example`) with:

```
FAL_SUBSCRIBER_KEY=your_fal_ai_key
BACKEND_PORT=4000
FRONTEND_PORT=3000
```

Each package will load the variables it needs via its own tooling. Keep secrets out of version control.

## Getting Started

1. Install dependencies once the package scaffolds exist:
   - `cd frontend && npm install`
   - `cd backend && npm install`
2. Run backend server first so the frontend proxy can forward requests.
3. Start the frontend dev server to interact with the UI.

More detailed run instructions live inside each package README.

