# Kabadiwala Connect

A full-stack rebuild of the Kabadiwala Connect prototype — connecting households, informal waste collectors ("kabadiwalas"), and recyclers, with QR-coded traceability from pickup to recycling.

**Stack**
- **Frontend:** React 18 + Vite + React Router + Recharts (charts) + qrcode.react
- **Backend:** Node.js + Express (REST API), JWT auth, bcrypt password hashing
- **Database:** SQLite (local `backend/kabadiwala.sqlite` file)

```
kabadiwala-connect/
├── backend/          Express API + SQLite models + seed script
├── frontend/          React app (Vite)
├── render.yaml        Render deployment blueprint for the backend
└── README.md
```

## 1. Run the backend locally

```bash
cd backend
cp .env.example .env
npm install
npm run seed      # creates the SQLite file and demo data
npm run dev        # starts the API on http://localhost:5050
```

Demo accounts created by the seed script (password `demo1234` for all):
- `customer@kabadiwalaconnect.demo` (Anita Sharma)
- `collector@kabadiwalaconnect.demo` (Ramesh Yadav)
- `admin@kabadiwalaconnect.demo`

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
3. When prompted, set `JWT_SECRET` to any long random string.
   - `CLIENT_ORIGIN` — your deployed frontend URL (set this after step 2 below; you can update it any time in Render's dashboard)
4. Deploy. Note the resulting API URL, e.g. `https://kabadiwala-connect-api.onrender.com`.
5. Run the seed script once in the deployed service environment with `npm run seed`.

*(Any Node host works the same way. The important env vars are `JWT_SECRET` and `CLIENT_ORIGIN`.)*

### Frontend → Vercel (or Netlify)
1. Sign in at https://vercel.com, **Add New > Project**, import this repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable `VITE_API_URL` = your Render API URL + `/api`, e.g. `https://kabadiwala-connect-api.onrender.com/api`.
4. Deploy. Vercel gives you a URL like `https://kabadiwala-connect.vercel.app`.
5. Go back to Render and set `CLIENT_ORIGIN` to that Vercel URL, so the API's CORS allows it.

*(Netlify works the same way: root directory `frontend`, build command `npm run build`, publish directory `dist`, same env var.)*

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
