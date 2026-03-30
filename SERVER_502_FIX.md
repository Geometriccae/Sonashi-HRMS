# Fix 502 Bad Gateway on Production (auxincrm.cloud)

A 502 means **nginx** received the request but couldn't get a valid response from your **Node.js backend**. Fix it on the server:

## 1. Ensure Node.js Backend is Running

```bash
# Check if Node process is running
ps aux | grep node

# Or if using pm2:
pm2 list
pm2 logs
```

**Start the backend** (if not running):
```bash
cd /path/to/auxin_mern_app/server
npm install
# Use pm2 for production:
pm2 start server.js --name auxin-api
pm2 save
pm2 startup
```

## 2. Verify Nginx Proxy Configuration

Edit `/etc/nginx/sites-available/default` (or your site config). The `/api` path must proxy to Node:

```nginx
server {
    listen 80;
    server_name auxincrm.cloud;
    root /var/www/auxincrm.cloud/frontend/build;
    index index.html;

    # API proxy - MUST point to your Node.js port (e.g. 5000)
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # React SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then reload nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 3. Production Environment Variables

Ensure `server/.env` on production has:
```
MONGO_URI=mongodb://...   # Your MongoDB connection (Atlas or local)
JWT_SECRET=your_secret    # Required for auth
PORT=5000                 # Must match nginx proxy_pass
```

## 4. Rebuild and Deploy Frontend

The frontend must use the updated code with `getAuthApiUrl` so production uses relative URLs:

```bash
cd frontend
npm run build
# Copy build folder to your server's web root
```

## 5. Test Backend Directly

On the server, test if Node responds:
```bash
curl http://127.0.0.1:5000/api/auth/login -X POST -H "Content-Type: application/json" -d '{"username":"test","password":"test"}'
```

If this returns JSON (even 401), the backend is running. If it fails, check Node logs.
