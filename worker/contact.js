/**
 * Rehab Sri Lanka — Contact Form Worker (rsl-form-handler)
 * Hardened rewrite: honeypot + Turnstile + per-IP rate limit + origin lock,
 * on top of the SAME Firestore + Resend behaviour as the original.
 *
 * Confirmed against the live worker (Cloudflare Quick Edit) and live data
 * (Firebase console, project rsl-database-1, 2026-08-09):
 *   - Firestore collection: "contacts", fields {name, email, phone, message,
 *     source, timestamp} — all strings.
 *   - Resend email: to chris@sansungroup.com, from info@rehabsrilanka.com.
 *   - Bug fixed here: original read formData.get('source') but every page
 *     sends the field as `_source` — so every document's source has always
 *     been the literal string "website". This version reads `_source` first,
 *     falling back to `source` for backwards compatibility.
 *
 * Environment variables (Cloudflare dashboard > Workers > rsl-form-handler > Settings > Variables):
 *   ALLOWED_ORIGIN — "https://www.rehabsrilanka.com"
 *   REDIRECT_URL   — page to send users to after a successful submit (optional)
 *
 * Secrets (already set on the live worker — do not need to be recreated):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, RESEND_API_KEY
 * New secret to add:
 *   TURNSTILE_SECRET_KEY = 0x4AAAAAAEK5L0ZDBIBdsx1wLXpzf1ugeQE
 *
 * Rate limiting binding (declared in wrangler.toml, see [[unsafe.bindings]]):
 *   RATE_LIMITER
 */

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), env);
    }
    if (request.method !== 'POST') {
      return cors(new Response('Method not allowed', { status: 405 }), env);
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return cors(new Response('Invalid form submission', { status: 400 }), env);
    }

    const get = (key) => (formData.get(key) || '').toString().trim();

    // ── Honeypot ─────────────────────────────────────────────────────────
    // Real visitors never see/fill this field. Return a normal-looking
    // success so bots that trip it don't learn to adapt.
    if (get('website')) {
      return cors(redirectOrOk(env), env);
    }

    const data = {
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      message: get('message'),
      source: get('_source') || get('source') || 'website',
      timestamp: new Date().toISOString(),
    };

    if (!data.name || !data.email) {
      return cors(new Response('Please fill in your name and email.', { status: 400 }), env);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return cors(new Response('Please enter a valid email address.', { status: 400 }), env);
    }

    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';

    // ── Per-IP rate limit ────────────────────────────────────────────────
    if (env.RATE_LIMITER) {
      try {
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success) {
          return cors(new Response('Too many requests — please try again in a minute.', { status: 429 }), env);
        }
      } catch (err) {
        console.error('Rate limiter check failed:', err);
      }
    }

    // ── Turnstile verification ──────────────────────────────────────────
    const turnstileToken = get('cf-turnstile-response');
    if (!turnstileToken) {
      return cors(new Response('Please complete the verification and try again.', { status: 400 }), env);
    }
    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
          remoteip: ip,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        console.error('Turnstile failed:', verifyData['error-codes']);
        return cors(new Response('Verification failed — please try again.', { status: 400 }), env);
      }
    } catch (err) {
      console.error('Turnstile check error:', err);
      return cors(new Response('Verification error — please try again.', { status: 502 }), env);
    }

    // ── Write to Firestore + send via Resend (same as original) ─────────
    try {
      await Promise.all([
        writeToFirestore(data, env),
        sendEmail(data, env),
      ]);
    } catch (err) {
      console.error('Worker error:', err);
      return cors(new Response('Something went wrong sending your message. Please WhatsApp or call us instead.', { status: 500 }), env);
    }

    return cors(redirectOrOk(env), env);
  },
};

function redirectOrOk(env) {
  if (env.REDIRECT_URL) {
    return new Response(null, { status: 302, headers: { Location: env.REDIRECT_URL } });
  }
  return new Response('Thanks — we will be in touch shortly.', { status: 200 });
}

// ── Firestore ─────────────────────────────────────────────────────────────
// Collection "contacts", fields {name, email, phone, message, source, timestamp}
// — confirmed directly against live documents in rsl-database-1.

async function writeToFirestore(data, env) {
  const token = await getFirebaseToken(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/contacts`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: data.name },
        email: { stringValue: data.email },
        phone: { stringValue: data.phone },
        message: { stringValue: data.message },
        source: { stringValue: data.source },
        timestamp: { stringValue: data.timestamp },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore write failed: ${res.status} ${text}`);
  }
}

async function getFirebaseToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: env.FIREBASE_CLIENT_EMAIL,
    sub: env.FIREBASE_CLIENT_EMAIL,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore',
  }));

  const signingInput = `${header}.${payload}`;
  const privateKey = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Failed to get Firebase token');
  return tokenData.access_token;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

// ── Email via Resend ─────────────────────────────────────────────────────

async function sendEmail(data, env) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'info@rehabsrilanka.com',
      to: ['chris@sansungroup.com'],
      reply_to: data.email,
      subject: `New RSL Enquiry from ${data.name}`,
      html: `
        <h2>New Enquiry – Rehab Sri Lanka</h2>
        <p><strong>Name:</strong> ${escHtml(data.name)}<br>
        <strong>Phone:</strong> ${escHtml(data.phone || '—')}<br>
        <strong>Email:</strong> <a href="mailto:${escHtml(data.email)}">${escHtml(data.email)}</a><br>
        <strong>Source:</strong> ${escHtml(data.source)}</p>
        <p>${escHtml(data.message || '(no message)')}</p>
        <p style="color:#777;font-size:12px;">Submitted ${data.timestamp}</p>
      `,
      text: [
        `Name: ${data.name}`,
        `Phone: ${data.phone || '—'}`,
        `Email: ${data.email}`,
        `Source: ${data.source}`,
        '',
        data.message || '(no message)',
        '',
        `Submitted: ${data.timestamp}`,
      ].join('\n'),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend failed: ${res.status} ${text}`);
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── CORS ─────────────────────────────────────────────────────────────────

function cors(response, env) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN || 'https://www.rehabsrilanka.com');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}
