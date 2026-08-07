Hostinger full project zips (supported structure)
================================================
Upload these in Deployments → Upload new files:

1) hostinger-frontend.zip  (for hrms.sonashi.in)
   - package.json is at ZIP ROOT (Create React App)
   - Build command: npm run build
   - Output directory: build
   - Framework: React / Create React App (auto-detect)

2) hostinger-backend.zip   (for backend.sonashi.in)
   - package.json + server.js at ZIP ROOT (Express/Node)
   - Entry file: server.js
   - Framework: Other or Express
   - Start: npm start  (node server.js)
   - Do NOT upload .env — keep Hostinger Environment Variables

Excluded: node_modules, .env, build, uploads
