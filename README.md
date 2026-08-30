# mailinglove

AI-designed postcards, calendars, and keepsakes — printed and mailed to the
people you love. Categories: love, family, birthday, Christmas.

Right now this is the marketing/waitlist site plus a photo-redesign preview
(v1.1): browse categories, see how it'll work, join the waitlist, and try
the AI redesign on your own photo. No payment or physical mail fulfillment
yet.

## Image redesign (built)

The "Try it now" section posts a photo + category to `POST /api/generate`
([server.js](server.js)), which calls the OpenAI images edit API and returns
the redesigned image as a data URL. Prompts are fixed templates per category
— no free-form user prompt.

- Set `OPENAI_API_KEY` (see `.env.example`). Without it the endpoint returns
  503 and the rest of the site works normally.
- The model, quality, size, `input_fidelity`, the per-IP rate limit, and an
  on/off switch are **runtime config** edited in the admin (Firestore
  `config/app`), with the `OPENAI_IMAGE_*` env vars as the defaults. Env
  default model is `gpt-image-1.5` (keeps faces faithful, supports
  `input_fidelity`); `runEdit()` drops `input_fidelity` and retries if a
  model rejects it.
- Occasion prompts change **only the background** — the people are locked.
  `modernize`/`restore` do touch faces (deblur, reconstruct damage) by design.
- 10 MB max upload; PNG/JPEG/WebP.
- Local dev: run `npm run dev` and `npm run dev:api` in two terminals (Vite
  proxies `/api` to the Express server on :8080).
- Prod: the key is a Firebase App Hosting secret
  (`firebase apphosting:secrets:set OPENAI_API_KEY`), wired in
  [apphosting.yaml](apphosting.yaml).

## Admin (`/admin`)

Same SPA, rendered when `location.pathname` starts with `/admin`
([src/main.jsx](src/main.jsx)). Server routes are under `/api/admin/*` in
[server.js](server.js); logic in [server/](server/).

- **Login is 2FA**: one code by SMS (Twilio) + one code by email (SendGrid),
  both required. On success the server sets an HMAC-signed, `HttpOnly`,
  `SameSite=Strict` session cookie (`ADMIN_SESSION_SECRET`, 8 h). Only
  `ADMIN_EMAIL` / `ADMIN_PHONE` can log in — codes are sent only there.
- **Overview**: visit counts (today / 7 d / 30 d + a 30-day bar list) and
  recent waitlist signups. Visits come from a first-party beacon
  (`POST /api/track`, [src/track.js](src/track.js)) → Firestore `analytics/`.
- **Settings**: the image-generation config above.
- Uses `firebase-admin` (Admin SDK). On App Hosting it auto-authenticates;
  locally set `GOOGLE_APPLICATION_CREDENTIALS`. Without it, the admin and
  analytics are disabled but the public site is unaffected.

Not built yet: orders (waiting on Stripe), saving generations to
Storage/Firestore.

## Roadmap (not built yet)
- **Payment**: Stripe checkout once generation is real.
- **Physical mail fulfillment**: an actual print-and-mail API (e.g. Lob,
  PostGrid, Click2Mail) to print the finished design and mail it — this is
  what turns a generated image into something that shows up in someone's
  mailbox. Needs to be picked and integrated.
- **Auth**: only the admin has a login so far (2FA, above). Customer auth
  will be needed once there's a real order flow.
- **Orders**: the admin has no orders view yet — add it with Stripe.

## Stack

Same pattern as notaryhost: Vite + React frontend, Express server serving
the built app, Firebase (Firestore) for data. Deployed via Firebase App
Hosting (`minInstances: 0` — pre-launch traffic doesn't justify an
always-on instance yet).
