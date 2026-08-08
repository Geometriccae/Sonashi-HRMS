# Database seed – initial admin user

If the database has **no users**, you cannot log in. Run the seed once to create an initial admin.

## Run the seed

From the **server** folder:

```bash
npm run seed
```

Or:

```bash
node scripts/seed.js
```

Ensure `.env` has `MONGO_URI` set (same as when you start the server).

## Initial login credentials (after running seed)

| Field    | Value        |
|----------|--------------|
| **Username** | `admin`    |
| **Password** | `Admin@123` |

- The script creates this user **only if** no admin user exists.
- If an admin already exists, the script does nothing (no duplicate).
- **Change this password** after first login (e.g. via Profile or User Management).
