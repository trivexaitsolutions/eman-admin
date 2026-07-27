E-MAN Mitra Client Edit Module

Replace these files in your project with the files in this ZIP:

1. src/controllers/mitraPortalController.js
2. src/routes/mitraPortalRoutes.js
3. views/mitra/add-client.ejs
4. views/mitra/clients.ejs

Then restart the backend:

npm run dev

What is included:
- Edit Client button in My Clients list
- GET /mitra/clients/edit/:id
- POST /mitra/clients/update/:id
- Same Add Client page reused for edit mode
- Existing client/business details prefilled
- Existing Primary Work Site address and saved current-location map point loaded
- Refresh button can replace current location only when Mitra is at the actual work site
- OTP skipped during edit; review screen is shown instead
- Phone/email duplicate validation ignores the same client but blocks another client
- Only the Mitra who owns the client can open or update it
- Update success toast on My Clients page

No Prisma migration is required.
