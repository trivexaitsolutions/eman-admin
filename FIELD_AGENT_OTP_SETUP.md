# E-MAN — Field Agent / Customer App OTP Integration

## Scope
- Admin > API Integrations is the single OTP provider selector: MAIL, MSG91 SMS or MSG91 WhatsApp.
- Existing Customer Mobile App `/api/user/send-otp` and `/api/user/verify-otp` already use the Admin settings and require no mobile changes.
- Field Agent > Add Client Step 3 now sends and verifies a real six-digit OTP through the same provider. Removed the old browser-only `1234` test OTP.
- Worker and Field Agent login currently use passwords, not OTP.

## Deployment
1. Back up your existing project and MySQL database. Extract the modified-only ZIP into the E-MAN backend root, overwriting matching paths.
2. From the root run `npx prisma migrate deploy` then `npx prisma generate`. A new `field_agent_client_otp` challenge table is created; no old customer/worker/mitra tables are renamed or reset.
3. Keep `API_SETTINGS_ENCRYPTION_KEY` in `.env` unchanged from the working Admin API Integrations setup. Never copy example credentials into production.
4. Restart `node emanserver.js` / your process manager.
5. Open Admin > API Integrations. Choose MAIL or MSG91 SMS/WhatsApp, configure credentials, and click **Save API Settings**. Merely selecting the radio button does not save it.
6. In Field Agent > Add Client, complete Step 1 with a real Client email for MAIL, then Step 2, then Save & Next to Step 3. Click **Send OTP**, enter the received six-digit code, **Verify OTP**, then **Save Client**.
7. Test invalid OTP and expired OTP, then a valid OTP. Verify the Client is only saved after successful verification.

## Important notes
- OTP is valid for ten minutes and cannot be replayed for a second Client registration. Limit: five wrong attempts per challenge.
- Existing authenticated customer edits are unchanged. A new registration with a phone/email already present in the Customer table is rejected rather than overwriting that account.
- If SMTP/API delivery fails, no verified Client is created. Verify credentials, provider balance, approved templates, and backend logs.
- Existing Field Agent Client drafts remain usable; return to Step 3 and request a new OTP after deploying.
- Full live SMTP/MSG91 delivery requires your real credentials and was not tested in this sandbox.
