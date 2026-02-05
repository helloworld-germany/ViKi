# Frontend

Next.js-based specialist portal used to triage incoming consults, review AI summaries, and experiment with conversational control.

## Getting Started

```
cd frontend/portal
npm install
npm run dev
```

Open http://localhost:3000 to view the portal. Ensure the Azure Functions backend is running locally (port 7071 by default) so the portal can fetch real consult data.

## Environment

Set `NEXT_PUBLIC_API_BASE_URL` to point at the backend host when deviating from the default `http://localhost:7071/api`. Create a `.env.local` file inside `frontend/portal` if you need to override the base URL.
