# E-MAN Admin Control Center
## Visual User Guide — Login to Daily Operations and App Simulator

Version 2.0 · Screenshots captured 12 October 2026 · Desktop view (1440 × 1000)

**Admin URL:** http://localhost:4000/admin/dashboard  
**Login URL:** http://localhost:4000/admin/login  
**Username:** admin@eman.com  
**Password:** 12345678

This visual guide follows the software's practical operating flow. Every screenshot is from the running E-MAN admin site. Screens show the current demo/test data, so names and counts can change as records change. The screenshots show the first desktop screen of each page; scroll within the admin content area to see the rest of long forms and lists.

## How the Admin Site Is Organized

The shared left menu is grouped into Dashboard, Operations, Workforce, Masters, and Settings. Use the menu to move between tasks. The active page appears highlighted. The current screenshot examples use a superadmin login; employee logins see a smaller menu.

**Role visibility:** superadmin and admin can use all pages in this guide. Employees can use Dashboard, Bookings, Conflicts, Clients, Workers, and My Leaves. Employees cannot manage employee accounts, Mitras, master data, Booking Settings, or App Simulator.

## Part 1 — Sign In and Get Oriented

### 1. Admin Login

![Admin login page — enter the authorized admin email and password.](screenshots/01-login.png)

Open the login URL or visit the dashboard URL. Enter the admin email and password, then select **Secure Login**. Successful sign-in opens the Dashboard. If sign-in fails, the login screen shows an error above the form. Protected pages return to login when the browser session is not authenticated. Use **Logout** in the top-right corner when finished.

### 2. Dashboard — Start Here Each Day

![Dashboard — daily operating summary, quick actions and attention queues.](screenshots/02-dashboard.png)

The Dashboard is the daily control panel. Its cards summarize active workers and availability, active jobs, open conflicts, and leave activity. Select a card to open the related working list. Admins also see quick links to create a Worker, Mitra, or Naka and review leaves. The Naka Verification and Pending Leaves panels highlight queues requiring follow-up. Use **Refresh** to reload the current snapshot.

## Part 2 — Configure the Service Area and Catalogue

Set up the geographical and service masters before assigning workers or taking bookings. The recommended sequence is States → Cities → Skills → Nakas.

### 3. States and Union Territories (Read Only)

![States page — seeded geographical records, codes, city totals and PIN totals.](screenshots/03-states.png)

States are pre-seeded and cannot be edited here. Use this page to check state/UT codes and confirm how many cities and mapped PIN codes are associated with each. Choose **Add City** to create a missing city.

### 4. Cities — List

![Cities list — city, state, attached Naka count, and row actions.](screenshots/04-cities.png)

The Cities master links every city to one State/UT and shows the number of Nakas already using it. Select **Add City** to create a record, or use **Edit** on a row to change it. PIN codes are entered on Naka records, not maintained in the City master.

### 5. Cities — Create and Edit

![Create City form — select a State/UT and enter the City name.](screenshots/05-city-create.png)

![Edit City form — the same fields with the existing City loaded.](screenshots/05-city-edit.png)

Choose the State/UT and enter the City Name, then select **Create City** or **Update City**. City names must be 2–120 characters. A city that already has Nakas cannot be moved to another State/UT. Create the city before adding Nakas in that location.

### 6. Skills — List and Pricing Catalogue

![Skills list — active state and configured pricing-tier range.](screenshots/06-skills.png)

Skills are service/labour categories used by worker profiles and bookings. The list shows active status and the range of configured rates. Use **Add Skill** to add a category, or **Edit** to maintain one. Inactive skills are visually muted and should not be treated as available for new service flows.

### 7. Skills — Create and Edit

![Create Skill form — category details, image, activation and rating-based rates.](screenshots/07-skill-create.png)

![Edit Skill form — existing description and rate tiers loaded for changes.](screenshots/07-skill-edit.png)

Enter the skill name and description, optionally upload an icon/image, and set whether the skill is active. Configure one or more **Stars** and **Rate (₹)** pairs. Use **Add Tier** to add a pair and the remove control to delete a tier. Rates can use half-star increments. Select **Save Skill & Rates** when finished.

### 8. Nakas — List and Verification Queue

![Nakas list — verification filters, operational state, survey information and actions.](screenshots/08-nakas.png)

A Naka is a labour gathering point used for service-area matching. Filter the list to **Verified**, **Non-verified**, or **All Nakas**. Only currently verified Nakas are operational. Verification expires after six months; expired records appear as needing re-verification. Each row shows location, source, survey/verification dates, assigned worker count, and actions to verify, edit, or delete.

### 9. Nakas — Create and Edit

![Create Naka form — location, map, survey evidence and admin verification fields.](screenshots/09-naka-create.png)

![Edit Naka form — saved location and Naka details ready for correction or re-verification.](screenshots/09-naka-edit.png)

Select the State/UT first, then a City from that State. Enter the Naka name and exact six-digit PIN code. Select the exact point on the map, drag the marker to refine it, or use **Use Current Location**; latitude and longitude are filled from the selected point. Add survey confidence, survey date, peak-hour headcount, landmark, photo, and notes.

**Verify Later** saves the Naka without making it operational. **Save & Verify** also requires a survey date, a non-negative whole-number headcount, a verification photo, a verification method, and a note of at least five characters. The verification modal on the list page displays current evidence/history and allows a new verification entry; a new entry restarts the six-month review period.

## Part 3 — Set Booking Rules and Staff Access

### 10. Booking Settings

![Booking Settings — worker assignment choice, pool timetable, price reductions and map options.](screenshots/10-booking-settings.png)

This page affects live booking and worker availability behavior. Choose **Automatic Worker Assignment** or **Customer Selects Worker**. Set the daily pool start/end, then add pool start times as needed. Configure the rate reduction for each later pool as either a fixed rupee value or a percentage. Set whether customers see a map or nearby-Naka list, the search radius in metres, and the map API key. Save using **Save Booking Settings**.

Pool timing uses Asia/Kolkata. Pool 1 begins at the pool-day start. A worker joining later enters the latest active pool, while the daily pool-end time remains unchanged. Map matching is performed by the backend using the configured radius. A native Android map SDK key may also require an APK rebuild when changed.

### 11. Employees — Staff Access List

![Employees list — staff email, system role and account actions.](screenshots/11-employees.png)

Use this page to grant Control Center access. The list displays each employee's email and role, with **Edit** and **Delete** actions. You cannot delete your own currently logged-in account from this list.

### 12. Employees — Create and Edit

![Create Employee form — name, email, access role and required initial password.](screenshots/12-employee-create.png)

![Edit Employee form — update staff identity or role and optionally replace the password.](screenshots/12-employee-edit.png)

Enter name, email, system role, and password. **superadmin** has full access; **admin** has manager-level access; **employee** has restricted operational access. Password is required when creating a user. When editing, leave it blank to retain the current password. Select **Create Employee** or **Update Employee** to save.

### 13. Mitras — Field-Agent List

![Mitras list — contact information, assigned Nakas and active state.](screenshots/13-mitras.png)

Mitras handle field operations for their assigned Nakas. Confirm each Mitra has the right area assignment and is active. The list shows phone/email, assigned Nakas, and status. Choose **Add New Mitra** or use a row's **Edit** action.

### 14. Mitras — Create and Edit

![Create Mitra form — sign-in details, Naka assignments and account activation.](screenshots/14-mitra-create.png)

![Edit Mitra form — existing contact details, areas and account status.](screenshots/14-mitra-edit.png)

Enter the Mitra name and 10-digit phone number; email is optional. A password is required on creation but can be left blank on edit to keep the current one. Select the Nakas this Mitra is responsible for and keep **Account Active** checked for a Mitra who should be able to log in. Save using **Register Mitra** or **Update Mitra**.

### 15. Workers — Workforce List

![Workers list — search and status filters, operational state, Mitra, skills and rating.](screenshots/15-workers.png)

Search by worker name, phone, email, or Mitra. Filter by **All**, **Online**, **Offline**, or **In Booking**. Online means available in the current pool; In Booking means assigned to active work. Use **Refresh Status** before making an operational decision. Demo workers are marked with a Demo badge and may be used in the simulator. Select **Register Worker** or **Edit** to maintain a profile.

### 16. Workers — Create and Edit

![Create Worker form — identity, app login, ID verification, location, skills and payout details.](screenshots/16-worker-create.png)

![Edit Worker form — saved worker profile, Naka/skill assignments and status.](screenshots/16-worker-edit.png)

Complete Personal Information (name, 10-digit phone/login, optional email, password, date of birth and calculated age), Verification & ID, address/PIN, skills, payment details, and active status. Use a pincode to load matching verified Nakas; assign no more than three. A consent recording can be uploaded as audio or video. Password is required on creation; leave it blank on edit to preserve it. Worker location, active status, skills, and Nakas affect booking eligibility and matching.

## Part 4 — Monitor Customers and Run Booking Operations

### 17. Clients

![Clients list — search and operational status alongside contact and assigned Mitra.](screenshots/17-clients.png)

This is a read-only customer overview. Search by name, phone, email, or assigned Mitra, and filter by **All**, **Online**, **Offline**, or **In Booking**. The page shows client contacts, operational status, and the Mitra responsible for follow-up. Online status is based on recent app activity; refresh to see the latest data.

### 18. Bookings — Operations List

![Bookings page — summary counts, booking filters and records.](screenshots/18-bookings.png)

Use this page to monitor payment and work from the booking queue through completion. Summary cards link to running jobs, online workers, pending payments, and completed-today bookings. Search by booking/customer/worker/phone, or filter by status, primary Naka, skill, and date range. Each record shows assigned/required worker count, amount, state, and a **View** link.

Status labels include Payment Pending (PENDING), Workers Assigned (ASSIGNED), In Progress, Completed, and Cancelled. Use **Clear** to remove filters and **Refresh** to reload current operations.

### 19. Online Workers

![Online Workers page — who is available, who is busy, and their pool time window.](screenshots/19-online-workers.png)

This read-only live workforce view separates total online workers from those available now and those busy/locked. Search by worker, phone, Naka, or skill. Filter to **Available** or **Busy / Locked**. Check online-since, availability-until, last-active time, ratings, and linked booking. Refresh the page for current timestamps.

### 20. Booking Detail

![Booking detail — customer, job, payment, work address, workers, ratings and conflicts.](screenshots/20-booking-detail.png)

Open a booking from the records table or Online Workers. Review the booking status and amount, customer identity, skill and required worker count, selected Nakas, payment order/payment IDs, and work address. Assigned worker cards show duty state and skills. The bottom sections show ratings and linked conflicts. Use **Back to Bookings** to return to the list.

## Part 5 — Resolve Issues and Manage Leave

### 21. Conflict Management

![Conflict list — date/status/raised-by filters and reported booking issues.](screenshots/21-conflicts.png)

Use the filters to review disputes by date, status (Pending, In Progress, Solved, Unresolved), or raised-by party (Client or Worker). Records show the related booking, reason, parties, suggested financial impact, and a **Review** action. Prioritize open conflicts requiring admin assignment.

### 22. Conflict Detail and Resolution

The live system had no conflict records when screenshots were captured, so there was no real detail record to open without creating test data. In normal use, select **Review** on a conflict row to open `/admin/conflicts/:id`.

![Parent Conflict Management page from which an available conflict's Review action opens the detail screen.](screenshots/21-conflicts.png)

On the detail page, review client/worker information, issue description, requested action, continue-work answer, booking and per-worker amounts, suggested refund, and penalty. Choose a new status and enter a mandatory admin note before selecting **Save Resolution Update**. For Pending/In Progress issues, the Assigned Mitra panel can assign an active, available Mitra for that Naka. The Timeline records every status change and note. Only available Mitras assigned to the relevant Naka are offered.

### 23. Leave Management — Admin View

![Leave Management — request counts, manual leave entry, filters and decision actions.](screenshots/23-leave-management.png)

Admins manage Mitra and employee leave here. Summary tiles filter pending, on-leave, open-ended, and upcoming records. **Add Leave Manually** supports Staff Type, staff selector, leave type, full/half day, From/To dates, reason, and (for Mitras) existing-conflict handling and an optional handover Mitra. Search and filter by staff, type, status, and dates.

For pending requests, open **Review Request**, adjust dates if needed, enter a decision note, and choose **Approve** or **Reject**. For approved leave, available actions can include **Mark Returned**, **Reassign Existing Conflicts**, **Update Leave**, and **Cancel Leave**. Consider the conflict handover before approving Mitra leave.

### 24. My Leaves — Personal View

![My Leaves — submit a personal request and review/cancel eligible leave history.](screenshots/24-my-leaves.png)

Employees apply for and track their own leave here. Select the leave type and day type, From date, optional To date, and enter a reason. Submit with **Submit Request**. Pending or upcoming personal requests can be cancelled when the page offers **Cancel Leave**. Admin users can switch between personal **My Leaves** and **Manage Leaves**.

## Part 6 — App Simulator (Demo/Test Only)

### 25. Simulator Campaigns — Create and Choose a Test

![App Simulator campaign list — create a test campaign and review campaign history.](screenshots/25-simulator.png)

The simulator is an admin-only test tool for running multiple demo worker app sessions from browser profiles/PCs. It uses active demo worker records and real worker-pool, booking, arrival, completion, and rating logic. Actions can change demo worker availability and ratings; keep tests on demo/staging data.

Create a campaign:

1. Enter a Campaign Name (up to 80 characters).
2. Choose **Manual** or **Automatic** mode.
3. Set Max Workers Across PCs (1–200).
4. Set Refresh Interval (10–120 seconds).
5. Select **Create & Start Campaign**.

The campaign starts in RUNNING state. **Available Demo Workers** counts active demo workers, not free workers; the campaign history shows allocated count and status. Select a history row to open its console.

Access is controlled by `SIMULATOR_ENABLED=true` and a `JWT_SECRET` at least 24 characters long. In production, `SIMULATOR_ALLOW_PRODUCTION=true` is also required.

### 26. Simulator Campaign Console — Run Worker Apps

![Simulator campaign console — campaign controls, three demo worker cards and per-worker actions.](screenshots/26-simulator-campaign.png)

The screenshot shows three temporary app claims to make the worker cards visible; those claims were released after capture. In normal use, enter **1–20** in Worker Apps on This PC and choose **Open Apps**. One browser profile counts as one PC. Different profiles or browsers count separately. A campaign supports up to 200 workers from the admin UI.

Campaign controls:

- **Pause** blocks new claims/actions and automatic ticks. **Resume** restarts a paused campaign.
- **Stop** ends the campaign and cannot be reversed. Existing bookings are not cancelled.
- **Release All PCs** removes all campaign browser claims only. It does not cancel bookings or set workers offline.
- **Release This PC's Apps** removes only this browser profile's claims.

Each worker card shows slot, Demo label, name, ID, phone, current state, skills, Nakas, Mitra, and duty information. Select **Full Day**, **2 Hours Work**, **3 Hours Work**, or **4 Hours Work**, then **Join Pool**. The 2/3/4 hour choice is a job-duration preference; pool expiry is controlled by Booking Settings. **Offline** is unavailable while the worker has active assigned work. Select All and **Bring Selected Online** apply to this PC's selection; already-online and in-booking workers are skipped.

Booking and arrival behavior:

- Before assignment, the card says it is waiting for a customer.
- Once assigned, the card shows booking/client details, an arrival QR code, and a six-digit manual arrival code. The code rotates every 10 minutes, with a short grace period for the previous code.
- After arrival verification, the card shows an on-duty timer. Short-duration work counts down and shows overdue time when exceeded.
- After completion, **Rate Customer** is available if a rating remains. The simulator UI submits five stars.
- Customer arrival verification and job completion still happen through the normal customer app flow; Automatic mode does not scan QR, enter codes, take payment, complete work, or cancel jobs.

Manual mode gives the admin per-worker Join Pool/Offline and duration controls. Automatic mode joins eligible claimed demo workers to the pool on refresh and can auto-rate a completed booking. Automatic mode does not perform customer-side actions.

Important status differences:

- RUNNING: claims, actions, and auto-ticks are allowed.
- PAUSED: new claims/actions/auto-ticks are blocked.
- STOPPED: cannot resume; active bookings remain untouched.
- Allocated means claimed by the simulator, not online. Releasing a claim does not make the worker offline.

Safe test workflow:

1. Check that the worker pool is open in Booking Settings.
2. Create a campaign and open it from Campaign History.
3. Allocate 1–20 worker apps on each required browser/PC.
4. Bring workers online manually or use Automatic mode.
5. Observe Bookings and Online Workers alongside the simulator.
6. Complete customer-side arrival/work steps through the normal app flow.
7. Set eligible workers offline if needed, then release this PC's apps.
8. Stop the campaign when no more simulator activity should occur.

If fewer workers are available than requested, another active/paused campaign or PC may already hold claims. If a worker cannot join, check campaign state, current booking state, and whether the pool is open. Browser local storage identifies a simulator PC; clearing it may leave claims to be cleared with **Release All PCs**.

## Recommended End-to-End Operating Order

1. Sign in and review Dashboard queues.
2. Confirm State/City masters, active Skills, and verified Nakas.
3. Confirm Booking Settings (assignment mode, pool window, pricing, radius).
4. Maintain staff access, assign Mitras to Nakas, and register workers with accurate skills/Nakas.
5. Monitor Clients, Bookings, and Online Workers during service.
6. Open individual Booking Detail pages for assignment/payment/work questions.
7. Review and document conflicts; manage leave and Mitra handover as needed.
8. Use App Simulator only for demo/test campaigns, then release claims and stop the campaign when done.

## Screenshots and Updating This Guide

Screenshots are stored in `docs/screenshots/`. They were taken from the running admin application using an authorized admin login. No conflict detail was available in the live test data at capture time. To refresh screenshots after UI changes, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optionally `ADMIN_BASE_URL`, then run:

`node scripts/captureAdminDocumentationScreenshots.js`

To rebuild this illustrated PDF from the Markdown and screenshots, run:

`node scripts/generateAdminUserDocumentationPdf.js`
