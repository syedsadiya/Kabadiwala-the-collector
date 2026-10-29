# Kabadiwala Connect

A full-stack rebuild of the Kabadiwala Connect prototype — connecting households, informal waste collectors ("kabadiwalas"), and recyclers, with QR-coded traceability from pickup to recycling.

**Stack**
- **Frontend:** React 18 + Vite + React Router + Recharts (charts) + qrcode.react
- **Backend:** Node.js + Express (REST API), JWT auth, bcrypt password hashing
- **Database:** Supabase PostgreSQL (SQLite was used only as the migration source)

```
kabadiwala-connect/
├── backend/          Express API + PostgreSQL models, schema, and migration script
├── frontend/          React app (Vite)
├── render.yaml        Render deployment blueprint for the backend
└── README.md
```


## What's new in this version

**Smart Collector Matching** (`backend/services/matching.js`, `GET /api/pickups/:id/matches`)
1. *Eligibility filter* — only collectors who are **available** and **accept the requested waste category**.
2. *Transparent ranking, score out of 100* — 60% proximity (distance to the pickup, 0 beyond 50 km) + 25% rating + 15% experience (completed pickups, capped at 50). Ties go to the closer collector.
3. The customer sees each collector's score breakdown and reasons, and can route the request to one (`PATCH /api/pickups/:id/request-collector`). The collector still has to accept. If nobody qualifies, the request stays open to everyone and the UI says so.

**Pickup lifecycle:** `REQUESTED → ACCEPTED → COLLECTED` (then `VERIFIED → SENT_TO_RECYCLER → RECYCLED` by admin) plus `CANCELLED`.
- Accepting and completing are atomic in the database, so two collectors can't take the same request and a pickup can't be recorded twice.
- Customers can cancel only while the request is still open; admins can cancel open or accepted requests.
- Collection amount is calculated on the server from the recorded weight, not trusted from the browser.

**Impact dashboard** (`GET /api/stats/admin`): completed pickups, kg collected, pending/accepted, waste by category, monthly trend (last 6 months), pickup-status chart. All values come from database records. CO₂e is an **estimate** (flat 1.8 kg CO₂e per kg recorded) and labelled as such.

**Other changes:** server-side validation on register / pickup / collection; public sign-up can no longer create admin accounts; emails are stored lower-case (mixed-case sign-ups could not log in before); `/api/users` is admin-only; collector phone/customer phone are shared only after a pickup is accepted; availability toggle and editable categories for collectors; `populate()` now really joins customer/collector names (they were blank in the dashboards); logout returns to `/login`; friendlier "cannot reach server" error.

**Existing databases:** The idempotent `npm run migrate:sqlite` importer was run against the original SQLite database. It preserved IDs and password hashes, reported matching source/destination counts, and the SQLite file was then backed up outside the repository and removed from the project.

**Not included:** AI photo classification. No tested model/API is wired in, so it is not claimed anywhere in the app.

## Tests
With the API running: see `backend/test/api.test.js` (`npm test` from `backend/`, needs the server on `API_URL`, default `http://localhost:5000/api`, seeded with `npm run seed`).

## 1. Run the backend locally

```bash
cd backend
cp .env.example .env
npm install
npm run migrate:sqlite  # only after DATABASE_URL points to the target database
npm run dev             # starts the API on http://localhost:5000
```

Demo accounts created by the seed script (password `demo1234` for all):
- Customer phone: `9000000001` (Anita Sharma)
- Collector phone: `9000000002` (Ramesh Yadav)
- Admin email: `admin@kabadiwalaconnect.demo`
- Admin compatibility phone: `9000000003`

The login screen uses the admin email for the Admin role and a phone number for
Customer or Kabadiwala. The API also accepts the legacy email field for
backward-compatible clients.

## 2. Run the frontend locally

```bash
cd frontend
cp .env.example .env   # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev             # starts the app on http://localhost:5173
```

Open http://localhost:5173 — you should see the landing page, with live stats pulled from your database.

## 3. Push to GitHub

```bash
cd kabadiwala-connect
git init
git add .
git commit -m "Kabadiwala Connect — full-stack app"
git branch -M main
git remote add origin https://github.com/<your-username>/kabadiwala-connect.git
git push -u origin main
```

## 4. Deploy

### Backend → Render
1. Sign in at https://render.com and connect your GitHub account.
2. **New > Blueprint**, select this repo — Render will read `render.yaml` and create the `kabadiwala-connect-api` web service (root dir `backend`).
3. Set `DATABASE_URL` to the Supabase **direct/transaction-pooler PostgreSQL connection string** in the Render backend environment. Do not put it in frontend variables or Git.
4. When prompted, set `JWT_SECRET` to any long random string.
   - `CLIENT_ORIGIN` — your deployed frontend URL (set this after step 2 below; you can update it any time in Render's dashboard)
5. Deploy. Note the resulting API URL, e.g. `https://kabadiwala-connect-api.onrender.com`.
6. Before switching traffic, run the migration locally with the same `DATABASE_URL`, then deploy and confirm `GET /api/health`.

*(Any Node host works the same way. The important env vars are `JWT_SECRET` and `CLIENT_ORIGIN`.)*

### Frontend → Vercel (or Netlify)
1. Sign in at https://vercel.com, **Add New > Project**, import this repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable `VITE_API_URL` = your Render API URL + `/api`, e.g. `https://kabadiwala-connect-api.onrender.com/api`.
4. Deploy. Vercel gives you a URL like `https://kabadiwala-connect.vercel.app`.
5. Go back to Render and set `CLIENT_ORIGIN` to that Vercel URL, so the API's CORS allows it.

*(Netlify works the same way: root directory `frontend`, build command `npm run build`, publish directory `dist`, same env var.)*

Required production variables:

- Vercel: `VITE_API_URL=https://<your-render-service>.onrender.com/api`
- Render: `DATABASE_URL` (Supabase PostgreSQL connection string), `JWT_SECRET` (a long random secret), `CLIENT_ORIGIN` (the exact Vercel
  origin), `GROQ_API_KEY`, and optionally `GROQ_MODEL`.

Never put `JWT_SECRET` or `GROQ_API_KEY` in frontend files or commit them to Git.

### SQLite backup and migration

1. Stop writes to the old backend or use a maintenance window.
2. Copy `backend/kabadiwala.sqlite` to a separate backup location. Do not delete the original.
3. In `backend/.env`, set `DATABASE_URL` to the Supabase connection string and optionally set `SQLITE_SOURCE` to the backup path.
4. Run `npm run migrate:sqlite`. The command creates the schema, imports parent tables before child tables, uses `ON CONFLICT DO NOTHING`, resets identity sequences, and verifies counts.
5. Review every source/destination count and relationship error before deploying. If it fails, PostgreSQL rolls back and the SQLite file remains unchanged.
6. Configure the same `DATABASE_URL` in Render and redeploy. Keep the external SQLite backup until authentication, pickups, collections, rewards, statistics, and chatbot checks pass in production.

## What's implemented

- **Landing page** — live platform stats pulled from the API.
- **Auth** — register/login for 3 roles (customer, collector, admin), JWT-based, bcrypt-hashed passwords.
- **Customer** — request a pickup (category, quantity, map pin, time slot), track live status, view collection history with traceability.
- **Collector** — see open requests near their area on a map, accept, weigh & confirm a collection (generates a QR-coded Collection ID), view earnings.
- **Admin** — dashboard with charts (waste by category, collections by status, top collectors), collector/recycler/center directories, environmental impact summary.
- **Traceability** — every completed collection gets a unique Collection ID + QR code, with a status timeline from household → kabadiwala → collection center → recycler → recycled.

## Notes

- The map is a lightweight dependency-free mock (click to drop a pin) so the project runs with zero paid API keys. Swap `frontend/src/components/MockMap.jsx` for `@react-google-maps/api` or Leaflet if you want a real map — just make sure to add your own API key as an env var, never commit it.
- This project intentionally uses one `User` collection for all three roles for simplicity; split into separate collections if the schema grows.
