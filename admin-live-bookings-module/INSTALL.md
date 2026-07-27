# Admin Live Bookings Module

## What this patch adds

- New sidebar item: **Bookings**
- `/admin/bookings`
  - Current running bookings count
  - Online workers count
  - Pending payment count
  - Completed today count
  - Search and filters
  - Server-side pagination: 20 rows per page
  - Booking detail page
- `/admin/bookings/online-workers`
  - Total online / available / busy workers
  - Online since timestamp
  - Online duration
  - Availability expiry timestamp
  - Last active timestamp
  - Current booking/payment-hold link
  - Search, status filter and pagination

## Files

New:
- `src/controllers/adminBookingController.js`
- `src/routes/adminBookingRoutes.js`
- `views/admin/bookings/index.ejs`
- `views/admin/bookings/show.ejs`
- `views/admin/bookings/online-workers.ejs`

Updated:
- `src/routes/adminRoutes.js`
- `src/middlewares/viewGlobals.js`

## Install

Extract this ZIP into:

```text
/home/trivexait.online/eman
```

Allow overwrite for the updated files.

## Commands

```bash
cd /home/trivexait.online/eman

node --check src/controllers/adminBookingController.js
node --check src/routes/adminBookingRoutes.js
node --check src/routes/adminRoutes.js
node --check src/middlewares/viewGlobals.js

pm2 restart 5
```

No Prisma migration or `db push` is required.

## Test URLs

```text
/admin/bookings
/admin/bookings/online-workers
```

## Online worker definition

A worker is shown as online when:

- `isActive = true`
- `availabilityUntil` is later than the current server time

Status is then shown as:

- **Available**: `isAvailable = true`
- **Payment Hold**: connected to a PENDING booking
- **On Booking**: connected to ASSIGNED or IN_PROGRESS booking
- **Busy / Locked**: not available, but no active booking was found
