# Deploying CrewBooks to Vercel

Total time: ~20 minutes.  
No prior deployment experience needed.

---

## Prerequisites — accounts you'll need

| Service | Free tier? | Sign up at |
|---------|-----------|------------|
| GitHub | Yes | github.com |
| Supabase | Yes | supabase.com |
| Vercel | Yes | vercel.com |
| Stripe | Yes (test mode) | stripe.com |
| Twilio | Yes (trial) | twilio.com — **optional**, only needed for SMS |

---

## Step 1 — Push code to GitHub

If you haven't already:

```bash
# In your project folder
git init
git add .
git commit -m "Initial commit"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/crewbooks.git
git push -u origin main
```

---

## Step 2 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → **New project**
   - Choose a name (e.g. `crewbooks-prod`)
   - Choose a strong database password — **save it somewhere**
   - Region: pick the one closest to you
   - Click **Create new project** (takes ~2 minutes)

2. **Run the database migrations**
   - Go to **SQL Editor** (left sidebar)
   - Click **New query**
   - Open `supabase/migrations/001_initial_schema.sql` from your project folder
   - Paste the entire contents → click **Run**
   - Repeat for `002_reminder_settings.sql` and `003_business_logos.sql`

3. **Get your API keys**
   - Go to **Settings → API** (left sidebar)
   - Copy **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role** key → this is `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ Keep the service_role key secret — never put it in client-side code

4. **Enable Email Auth**
   - Go to **Authentication → Providers**
   - Make sure **Email** is enabled
   - Optional: disable "Confirm email" during development so sign-ups work instantly

---

## Step 3 — Stripe Setup

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you're in **Test mode** (toggle in top-right)
3. Go to **Developers → API keys**
   - Copy **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copy **Secret key** → `STRIPE_SECRET_KEY`

4. **Set up a webhook** (do this after Step 5 once you have a Vercel URL):
   - Go to **Developers → Webhooks → Add endpoint**
   - Endpoint URL: `https://your-app.vercel.app/api/webhooks/stripe`
   - Select events:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
   - Click **Add endpoint** → copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET`

---

## Step 4 — Twilio Setup (Optional)

Skip this section if you don't need SMS reminders yet. The app works fine without it.

1. Go to [console.twilio.com](https://console.twilio.com) → create a free account
2. From the dashboard, copy:
   - **Account SID** → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
3. Go to **Phone Numbers → Manage → Buy a number**
   - Pick any US number with SMS capability (~$1/month)
   - Copy the number in E.164 format (e.g. `+15125550100`) → `TWILIO_PHONE_NUMBER`

---

## Step 5 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Click **Import** next to your GitHub repo
3. Vercel auto-detects Next.js — leave framework settings as-is
4. Click **Environment Variables** and add each of the following:

```
NEXT_PUBLIC_SUPABASE_URL         = (from Step 2)
NEXT_PUBLIC_SUPABASE_ANON_KEY    = (from Step 2)
SUPABASE_SERVICE_ROLE_KEY        = (from Step 2)
STRIPE_SECRET_KEY                = (from Step 3)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = (from Step 3)
STRIPE_WEBHOOK_SECRET            = whsec_... (from Step 3 — add after deploy)
TWILIO_ACCOUNT_SID               = (from Step 4, or leave as "your-sid")
TWILIO_AUTH_TOKEN                = (from Step 4, or leave as "your-token")
TWILIO_PHONE_NUMBER              = (from Step 4, or leave as "+1xxxxxxxxxx")
NEXT_PUBLIC_APP_URL              = https://your-app.vercel.app  ← set after first deploy
CRON_SECRET                      = (any random string, e.g. run: openssl rand -hex 32)
```

5. Click **Deploy** — takes about 2 minutes

---

## Step 6 — Post-Deploy Checklist

Once Vercel gives you a URL (e.g. `https://crewbooks-abc123.vercel.app`):

- [ ] **Update `NEXT_PUBLIC_APP_URL`** in Vercel → Settings → Environment Variables
  - Set it to your actual Vercel URL
  - Click **Redeploy** (without rebuilding) to pick up the change

- [ ] **Update the Stripe webhook URL** (Step 3 above) with your real domain

- [ ] **Verify the health check** works:
  ```
  curl https://your-app.vercel.app/api/health
  ```
  Should return `{"status":"ok",...}`

- [ ] **Sign up as the first user** at `https://your-app.vercel.app/signup`

- [ ] **Set a custom domain** (optional):
  - Vercel → your project → Settings → Domains → Add

---

## Environment Variables Reference

All variables in one place:

| Variable | Required | Where to find it |
|----------|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase → Settings → API |
| `STRIPE_SECRET_KEY` | ✅ | Stripe → Developers → API keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Stripe → Developers → Webhooks |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your Vercel URL |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio dashboard |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio dashboard |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio dashboard |
| `CRON_SECRET` | Optional | Any random string |

---

## SMS Cron Job

The `vercel.json` file schedules `/api/sms/remind` to run every 15 minutes automatically on Vercel. No additional setup needed — it's wired up when you deploy.

The endpoint is protected by the `CRON_SECRET` header. Vercel sets this automatically from your environment variable.

To test it manually:
```bash
curl -X POST https://your-app.vercel.app/api/sms/remind \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

---

## Troubleshooting

**"Invalid API key" error on sign-up**
→ Double-check `NEXT_PUBLIC_SUPABASE_ANON_KEY` — it should start with `eyJ`

**Stripe webhook returning 400**
→ The `STRIPE_WEBHOOK_SECRET` must match the signing secret from the Stripe dashboard, not the API key

**SMS not sending**
→ Check `/api/health` — if Twilio shows `not-configured`, verify the env vars in Vercel
→ Twilio trial accounts can only send to verified numbers. Verify your test phone at console.twilio.com → Verified Caller IDs

**Build failing on Vercel**
→ Run `npm run build` locally first and fix any errors before pushing

**Storage uploads failing**
→ Make sure you ran all three migration files in Supabase SQL Editor
→ The `job-photos` and `business-logos` buckets are created by the migrations
