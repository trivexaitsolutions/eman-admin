E-MAN Mitra Worker Edit Module
================================

Replace these files in the project with the files from this ZIP:

1. src/controllers/workerController.js
2. src/routes/mitraPortalRoutes.js
3. views/mitra/add-worker.ejs
4. views/mitra/workers.ejs

Then restart backend:
npm run dev

What is included:
- My Workers cards have an Edit Worker button
- GET /mitra/workers/edit/:id
- Same add-worker.ejs used for both create and edit
- Existing worker details, skills and Nakas prefilled
- Password optional in edit mode
- Existing consent video remains valid; new recording optional
- Aadhaar/PAN/ID/phone/email duplicate checks exclude current worker
- A Mitra can only edit their own worker
- Worker update success toast on My Workers list

No Prisma schema/database migration is required.
