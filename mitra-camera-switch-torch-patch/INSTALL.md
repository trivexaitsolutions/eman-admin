# Mitra Camera Switch + Torch Patch

## Updated file

`views/mitra/add-worker.ejs`

## Features

### Handset

- Front camera is the default.
- `Back Camera` button switches to the rear camera.
- `Front Camera` button switches back to the selfie camera.
- Preview is mirrored only for the front camera.
- Torch button appears only when:
  - a rear camera is active, and
  - the handset/browser exposes torch capability.
- Torch can remain on during consent recording.
- Camera switching is disabled while recording.

### Desktop / Laptop

- Existing webcam recording continues normally.
- Camera utility buttons stay hidden when they are not useful/supported.

### Extra safety

- Previous camera tracks are stopped before switching.
- Tracks are released after recording, retake, reload, or page exit.
- Safari/mobile MediaRecorder MIME fallback is included.
- Camera requires HTTPS, which is now available through the secure domain.

## Install

Extract this ZIP into the server project root:

`/home/trivexait.online/eman`

Allow overwrite of:

`views/mitra/add-worker.ejs`

No database migration and no Prisma command are required.

Restart the backend:

```bash
cd /home/trivexait.online/eman
pm2 restart 5
```

## Test

Open the Mitra portal through HTTPS:

`https://emen.trivexait.online/mitra/...`

On a handset:

1. Open Add Worker.
2. Reach Video Consent.
3. Tap Turn On Camera.
4. Switch Front/Back.
5. On the rear camera, check whether Torch appears.
6. Record, stop, retake, and submit.

Note: Torch visibility depends on handset camera hardware and browser support.
