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
- Model is `OPENAI_IMAGE_MODEL` — `gpt-image-1-mini` (~1¢/image) for now;
  switch to `gpt-image-2` for launch. Same endpoint and params.
- Rate-limited to 5 requests / 15 min per IP; 10 MB max upload; PNG/JPEG/WebP.
- Local dev: run `npm run dev` and `npm run dev:api` in two terminals (Vite
  proxies `/api` to the Express server on :8080).
- Prod: the key is a Firebase App Hosting secret
  (`firebase apphosting:secrets:set OPENAI_API_KEY`), wired in
  [apphosting.yaml](apphosting.yaml).

Not built yet: saving generations to Storage/Firestore, and per-user quotas
beyond the IP rate limit.

## Roadmap (not built yet)
- **Payment**: Stripe checkout once generation is real.
- **Physical mail fulfillment**: an actual print-and-mail API (e.g. Lob,
  PostGrid, Click2Mail) to print the finished design and mail it — this is
  what turns a generated image into something that shows up in someone's
  mailbox. Needs to be picked and integrated.
- **Auth**: not needed yet (waitlist is just an email address); will be
  needed once there's a real order flow.

## Stack

Same pattern as notaryhost: Vite + React frontend, Express server serving
the built app, Firebase (Firestore) for data. Deployed via Firebase App
Hosting (`minInstances: 0` — pre-launch traffic doesn't justify an
always-on instance yet).
