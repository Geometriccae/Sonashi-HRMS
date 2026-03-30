# Interakt WhatsApp – Why messages might not be delivered

If events are created but **WhatsApp messages are not received**, follow the steps below.

---

## Format checklist (what can go wrong)

| Check | What to verify |
|-------|----------------|
| **1. Template name** | In Interakt dashboard your template is **"Notification"**. In `.env` use exactly: `INTERAKT_TEMPLATE_NAME=notification` (or `Notification` if API is case-sensitive). No spaces. |
| **2. Language** | Dashboard shows "English (en)". Use `INTERAKT_TEMPLATE_LANGUAGE=en` in `.env`. If your template was created as "en_US", try `INTERAKT_TEMPLATE_LANGUAGE=en_US`. |
| **3. Body variables** | Your template has **7** placeholders: {{1}}…{{7}}. The code sends 7 values in this order: name, event name, date, time, assigned by, notes, link. If your "Notification" template has a different number of variables, the API will fail – fix `getTemplateBodyValues()` in `interaktWhatsAppService.js` to match. |
| **4. Phone number** | Stored in Employee as `mobile`. Sent as digits with country code, e.g. `919876543210` (no + or spaces). Indian 10-digit numbers get `91` prefixed automatically. |
| **5. Auth** | Code uses `Authorization: Basic <API_KEY>`. If you get 401, the key may be wrong or copied with extra spaces; re-copy from Interakt → Settings → Developer Setting → Secret Key. |
| **6. Wallet** | You have balance – not the issue. |

---

## Current issue and what to do (step by step)

1. **Restart your Node server** (so it loads the latest code and `.env`).

2. **Create one event** in the app and assign **one** team member who has a **mobile number** in the database.

3. **Watch the server console** (terminal where `node server` runs). You should see lines like:
   - `[Interakt] Track user response: <status> <body>`
   - `[Interakt] Sending template to ... | template: ... | language: ...`
   - `[Interakt] Message response: <status> <body>`

4. **Interpret the responses:**
   - **Track user response 401/403** → Wrong API key or auth type. Try switching to `Authorization: Basic` in the code if your Interakt dashboard says “Basic”.
   - **Track user response 200** → User created/updated. Move to message response.
   - **Message response 401/403** → Same as above; check API key and Bearer vs Basic.
   - **Message response 400** → Usually **template name** or **language code** mismatch. Copy the response body; it often says which field is invalid. Set `INTERAKT_TEMPLATE_NAME` and `INTERAKT_TEMPLATE_LANGUAGE` in `.env` to match the template in Interakt **exactly** (case-sensitive, e.g. `en` vs `en_US`).
   - **Message response 200** but no WhatsApp received → Message accepted by Interakt; delivery can still fail (wrong number, user blocked, etc.). Check Interakt dashboard for delivery status / webhooks.

5. **Template name and language** must match Interakt exactly:
   - In Interakt: open your template and copy the **Name** and **Language** (e.g. `en` or `en_US`).
   - In `.env`: set `INTERAKT_TEMPLATE_NAME=...` and `INTERAKT_TEMPLATE_LANGUAGE=...` to those exact values, then restart the server.

6. If your Interakt dashboard or docs say to use **Basic** auth instead of Bearer, the code uses `Authorization: Bearer ${INTERAKT_API_KEY}`. Change it to `Authorization: Basic ${INTERAKT_API_KEY}` in both places in `interaktWhatsAppService.js` (track user and send message).

---

## 1. Interakt dashboard configuration

- **WhatsApp Business account**  
  Your WhatsApp Business number must be linked in Interakt (Settings / WhatsApp).

- **Template created and approved**  
  - Create a message template in Interakt (e.g. with variables for event name, date, time).  
  - Wait until its status is **Approved**.  
  - Note the **exact template name** and **language code** (e.g. `en`, `en_US`).

- **API key**  
  - Go to **Settings → Developer Setting → Secret Key**.  
  - Copy the key and set it in your backend `.env` as `INTERAKT_API_KEY=...`.

## 2. Backend `.env` (server)

```env
INTERAKT_API_KEY=your_secret_key_here
INTERAKT_TEMPLATE_NAME=your_exact_template_name
INTERAKT_TEMPLATE_LANGUAGE=en
```

- `INTERAKT_TEMPLATE_NAME` and `INTERAKT_TEMPLATE_LANGUAGE` must match the approved template in Interakt exactly (case-sensitive).

## 3. Template variables (body)

The code sends **7 body variables** to match this template:

- **{{1}}** – Recipient name  
- **{{2}}** – Event/meeting name  
- **{{3}}** – Date (DD/MM/YYYY, e.g. 02/03/2026)  
- **{{4}}** – Time (e.g. 09:00 AM)  
- **{{5}}** – Assigned by (username)  
- **{{6}}** – Notes (or "-" if empty)  
- **{{7}}** – Event link (or "-" if empty)

If your approved template has a different order or count, update `getTemplateBodyValues()` in `server/services/interaktWhatsAppService.js` to match.

## 4. Assigned members must have a mobile number

- In your app, each **assigned team member** must have a valid **mobile** in the database (Employee model).  
- Numbers are normalized to Indian format (e.g. `91XXXXXXXXXX`) if you store 10 digits.  
- If a member has no mobile, the server logs: `[WhatsApp] Skipped – no mobile for ...` and that person will not get a message.

## 5. Debugging (server logs)

- Restart the Node server after changing `.env`.  
- Create an event and assign at least one member who has a mobile number.  
- Watch the **server console** for:
  - `[WhatsApp] Event template sent to ...` → send succeeded.  
  - `[Interakt] Template send failed. Status: ... Response: ...` → use status and response to fix template name, language, or variables.  
  - `[WhatsApp] Skipped – no mobile for ...` → add/update mobile for that employee.

Optional: set in `.env`:

```env
INTERAKT_DEBUG=true
```

Then the server will log more detail for each Track User and template send (e.g. template name, language, masked number).

## 6. Interakt plan / API access

- Sending templates via API may require a specific plan (e.g. Growth or above).  
- If the API returns 403 or “not allowed”, check your Interakt plan and API access in the dashboard.

## Summary checklist

- [ ] WhatsApp Business number linked in Interakt  
- [ ] Template created and **Approved** in Interakt  
- [ ] `INTERAKT_API_KEY`, `INTERAKT_TEMPLATE_NAME`, `INTERAKT_TEMPLATE_LANGUAGE` set in server `.env` and server restarted  
- [ ] Template body variable count and order match `getTemplateBodyValues()`  
- [ ] Assigned employees have a valid `mobile` in the database  
- [ ] Check server logs after creating an event for `[WhatsApp]` and `[Interakt]` lines  
