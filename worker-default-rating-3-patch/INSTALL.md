# Worker Default Rating 3 Patch

## Behavior

- Every new worker gets `baseRating = 3.0`.
- Existing workers without customer reviews also receive `baseRating = 3.0`
  when Prisma updates the database.
- Before real reviews:
  - Admin shows `★ 3.0 / 5`
  - Label shows `New worker • 0 reviews`
  - Customer search treats the worker as rating 3
- Once real customer reviews exist, the real average replaces base rating.

No fake row is inserted into the `rating` table.

## Updated files

- prisma/schema.prisma
- src/controllers/workerController.js
- src/controllers/adminBookingController.js
- src/controllers/userController.js
- views/admin/workers/index.ejs
- views/admin/bookings/online-workers.ejs

## Install

Extract into:

/home/trivexait.online/eman

Allow overwrite.

## Commands

cd /home/trivexait.online/eman

npx prisma format
npx prisma db push
npx prisma generate

node --check src/controllers/workerController.js
node --check src/controllers/adminBookingController.js
node --check src/controllers/userController.js

pm2 restart 5

## Expected search behavior

- Minimum rating 0, 1, 2 or 3: new worker is visible.
- Minimum rating 4 or 5: new worker is hidden.
- After real reviews: actual calculated average is used.
