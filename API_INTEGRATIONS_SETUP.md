# E-MAN — API Integrations deployment

## Current patch base
Apply after `Eman_Pending_Changes_Backend_Modified_Only.zip` and `Eman_Booking_Payment_Safe_Fix_Backend_Modified_Only.zip` (and matching React patches). **Only files modified by this patch are in the ZIP.**

## 1. Configure encryption once
Generate a random, persistent 32-byte key using PowerShell in your backend folder:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

In existing backend `.env` add `API_SETTINGS_ENCRYPTION_KEY="<64-character-hex-value>"`.

**Keep the key outside Git, backups of public source and screenshots.** Back it up securely: without the same key saved encrypted credentials cannot be recovered after a server migration. Never change an existing key without re-encrypting the settings. Also secure access to `.env` and database backups.

## 2. Apply one additive migration

```powershell
cd D:\laragon\www\eman-admin
npx prisma migrate deploy
npx prisma generate
node emanserver.js
```

No data reset. Migration adds only `api_integration_setting`. Existing `mitra`, `customer`, `booking`, and other business data untouched.

## 3. Admin settings page
Open `http://localhost:4000/admin/api-integrations` as Admin/Superadmin. Settings -> API Integrations.

- **MAIL OTP**: Gmail sender email + Google App Password. This is the default; `.env` MAIL_USER and MAIL_APP_PASSWORD are initial fallback if nothing has been saved via Admin.
- **MSG91 SMS**: Auth Key + approved MSG91 OTP Template ID (with `##OTP##`). Confirm sender/India DLT requirements in MSG91 console.
- **MSG91 WhatsApp**: Approved WhatsApp Business sender number + approved template name + language. Template's first body text variable must be the OTP. Optionally reuse SMS Auth Key; otherwise enter separate WhatsApp Auth Key.
- **Razorpay**: Payment Gateway Key ID and Key Secret. Checkout now uses the backend-returned public key, not a hardcoded test key.
- **RazorpayX**: RazorpayX Key ID, Secret and Source Account Number for UPI validation (account permissions required).

Blank secret input keeps existing secret; tick Clear to erase. Secrets never render back to the browser and the singleton settings row is AES-256-GCM encrypted at rest.

Changing Razorpay merchant keys is refused if any PENDING booking remains. First reconcile the pending payments using the previously delivered safe payment recovery script. Avoid switching between test and live accounts while transactions are in-flight.

## OTP flow
- Changing the provider takes effect for **new OTP requests** immediately, with no Node restart.
- Already sent OTPs continue being verified through their stored code and expiry, regardless of later provider changes.
- OTP delivery is attempted **before** new registration account creation, so provider rejection does not create a duplicate incomplete account.
- MSG91 SMS `sendotp` sends a server-generated 6-digit code (`otp` parameter); E-MAN verifies it against its existing time-limited record.
- MSG91 WhatsApp uses a pre-approved template; acceptance by MSG91 does not guarantee the phone has received the message. Verify real deliveries in MSG91 console.

## Safety and testing
- Test every provider with a real **test** recipient after credentials are saved. SMS and WhatsApp may incur charges.
- Verify both successful payment and checkout cancellation in Razorpay **Test Mode** before switching to live keys.
- Keep encryption key and secrets on the server only, never in mobile application JS or a publicly served `public/` file.
- No live external MSG91/Razorpay calls were made while building this patch.

## Abuse protection
New OTP requests have a per-target cooldown (60 seconds), rolling per-target limit (5/hour), and a basic per-IP cap (100/hour) while the Node process stays running. For public deployments with multiple Node processes/instances, replace the in-memory guard with a shared Redis or DB-backed limiter.
