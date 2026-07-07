# E-MAN Interactive Admin Dashboard

## Included

- Live statistics from database: Naka verification queue, operational Nakas, workers, available workers, active Mitras, customers, active jobs, and open conflicts.
- 7/30/90-day dashboard range selector.
- Quick shortcuts with role-based visibility.
- Real verification attention queue (pending + due for re-verification).
- Last 7 days interactive Workers/Bookings chart.
- Recent Naka, worker, Mitra, booking and conflict activity.
- No database migration is required.

## Install

1. Backup the current project.
2. Copy both folders from this ZIP into the project root, preserving paths:

```txt
src/controllers/adminDashboardController.js
views/admin/dashboard.ejs
scripts/installDashboardRoutePatch.js
docs/ROUTE_CHANGE.md
```

3. From the project root, run:

```powershell
node .\scripts\installDashboardRoutePatch.js
```

4. Restart the Node server:

```powershell
node .\emanserver.js
```

5. Open:

```txt
/admin/dashboard
```

## Important

This module expects the latest Naka verification + Mitra Naka submission schema already installed, including `verificationStatus`, `lastVerifiedAt`, `createdByMitra`, `createdByEmployee`, and `City -> State` relation.
