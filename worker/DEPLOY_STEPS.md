# Fixing rsl-form-handler — deploy steps

## What's confirmed (viewed live in Cloudflare Quick Edit, 2026-08-09)

- The worker has **zero bot protection**: no honeypot check, no CAPTCHA, no
  rate limit, no origin check. Any POST from anywhere is processed.
- It does two things per submission: writes to **Firestore**, then sends an
  email via **Resend** to `chris@sansungroup.com` from `info@rehabsrilanka.com`.
  That Resend send is what's hitting the "100 emails/day" quota.
- Bug found in passing: the worker reads `formData.get('source')`, but every
  page's hidden field is named `_source` (with an underscore). So the
  per-page tagging (`Alcohol Rehab`, `Homepage`, etc.) has silently never
  worked — every enquiry always logs as `'website'`.
- I could not see the rest of the file (the `sendEmail`, `writeToFirestore`,
  `corsResponse` function bodies) — Quick Edit's code editor did not accept
  keyboard input from browser automation, so I couldn't scroll past line ~32
  or type into it. I also don't have wrangler/API-token access in this
  session. So I could not deploy a fix directly.

## Recommended fix: a minimal patch, not a rewrite

Rather than replace the whole file (risking the Firestore write or other
logic I never saw), paste this block into `rsl-form-handler`'s Quick Edit,
**right after the existing `if (request.method !== 'POST') { ... }` check**,
before the `try { const formData = await request.formData(); ...` line:

```js
    const formData = await request.formData(); // (skip this line if the file already declares formData below — just move the block after it)

    // ── Honeypot ─────────────────────────────────────────────────────────
    if ((formData.get('website') || '').toString().trim()) {
      return corsResponse('OK', 200); // pretend success, drop silently
    }

    // ── Turnstile verification ──────────────────────────────────────────
    const turnstileToken = (formData.get('cf-turnstile-response') || '').toString();
    if (!turnstileToken) {
      return corsResponse('Please complete the verification and try again.', 400);
    }
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return corsResponse('Verification failed — please try again.', 400);
    }
```

Adjust the exact response helper name (`corsResponse` / `cors` / whatever the
real file calls it) and variable names to match what's actually there —
I'm inferring the shape from the ~32 lines I could see, not quoting the
real file verbatim beyond what was visible.

Also add the secret:

```bash
wrangler secret put TURNSTILE_SECRET_KEY
# paste: 0x4AAAAAAEK5L0ZDBIBdsx1wLXpzf1ugeQE
```

Optional one-line fix for the source-tracking bug: change
`formData.get('source')` to `formData.get('_source')`.

## The full rewrite in this folder (`contact.js` / `wrangler.toml`)

That's a from-scratch version with the same idea (honeypot + Turnstile +
rate limit + Resend) plus my best guess at the Firestore write, modelled on
Sansun Living's worker. Treat it as a **reference / fallback**, not a
drop-in replacement — I never saw the real Firestore collection name or the
rest of the original logic, so deploying it as-is could silently change
what gets logged where. The minimal patch above is the safer path.

## What's already live and ready

- Turnstile widget "RSL Contact Form" — site key
  `0x4AAAAAAEK5L6YVEZOQavQD`, already wired into 57 of 58 site pages
  locally (not yet pushed to GitHub / deployed).
- `guide.html` (the Free Guide download form) was deliberately skipped —
  it submits via JS `fetch()`, not a native form POST, and its inputs use
  `id="name"` etc. instead of `name="name"`, so `FormData(form)` never
  actually captured name/phone/email/situation in the first place. That's
  a separate, real bug (lost leads on that page) unrelated to spam — flag
  if you want it fixed too.
