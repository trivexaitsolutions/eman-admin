# Admin Worker Ratings Patch

## Updated pages

1. **Manage Workers**
   - Overall rating badge
   - Total review count
   - `New / No reviews` state for unrated workers
   - Mobile and desktop layouts

2. **Online Workers**
   - Overall rating
   - Total review count
   - Mobile and desktop layouts

## Rating formula

```text
Overall Rating = (Average Mehnat + Average Vyavhaar) / 2
```

This is the same formula used by the customer available-workers API.

## Files

- `src/controllers/workerController.js`
- `views/admin/workers/index.ejs`
- `src/controllers/adminBookingController.js`
- `views/admin/bookings/online-workers.ejs`

## Install

Extract into:

```text
/home/trivexait.online/eman
```

Allow overwrite for the four files.

## Commands

```bash
cd /home/trivexait.online/eman

node --check src/controllers/workerController.js
node --check src/controllers/adminBookingController.js

pm2 restart 5
```

No Prisma migration or `db push` is required.

## Test

Open:

```text
/admin/workers
/admin/bookings/online-workers
```

Expected for Vinit based on current data:

```text
★ 3.9 / 5
5 reviews
```
