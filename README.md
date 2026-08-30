# mailinglove

AI-designed postcards, calendars, and keepsakes — printed and mailed to the
people you love. Categories: love, family, birthday, Christmas.

Right now this is the marketing/waitlist site only (v1): browse categories,
see how it'll work, join the waitlist. No image generation, payment, or
physical mail fulfillment yet.

## Roadmap (not built yet)

- **Image generation**: user uploads a photo, we call the OpenAI images API
  to redesign it (new background/style) per category. Needs an OpenAI API
  key (not created yet).
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
