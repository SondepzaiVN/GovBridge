# GovBridge PostgreSQL

PostgreSQL support is opt-in so the demo can still run with the JSON store.

1. Create a database and user, for example:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres govbridge
```

2. Configure `backend/.env`:

```env
DATA_STORE=postgres
DATABASE_URL=postgresql://postgres:<your-password>@localhost:5432/govbridge
```

3. Apply the schema:

```powershell
npm run db:migrate --prefix backend
```

When `DATA_STORE=postgres`, authentication sessions, users, dashboard applications, and attachment metadata are read from PostgreSQL. Procedure metadata still uses the existing JSON catalog.
