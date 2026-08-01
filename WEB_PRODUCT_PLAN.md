# ClearRent Web — Product Plan

Written 2026-07-30. Extends the existing marketing site (`clearrent_web`, Next.js 16 /
React 19 / Tailwind 3, deployed on Vercel, branch `develop`).

---

## Decisions locked

| Decision | Choice |
|---|---|
| Scope | **Public browse + tenant entry + landlord listing creation.** Agent operations stay mobile-only. |
| Location | **Extend `clearrent_web`** — one domain, shared brand and legal pages. |
| Rendering (public) | **Server-rendered via `firebase-admin`.** Not client Firestore reads. |
| Writes (landlord) | **Client Firebase Web SDK as the signed-in landlord.** Not admin writes. |
| Firestore rules | **Unchanged.** No loosening for the web. |

> **Scope revised twice on 2026-07-30.** First to add landlord listing, then to
> the current target: **full feature parity — every app screen gets a web
> version.** 48 screens across landlord (15), tenant (11), auth (6), agent (6),
> property (2), notifications (1) and chat (1). This is a rebuild in React, not
> a port; no Flutter code transfers.

### Build order (agreed)

1. **Auth + onboarding** — phone OTP → account type → profile → role dashboard. *Built.*
2. **Landlord surface** — listings, edit, readiness, inspections.
3. **Tenant surface** minus payments.
4. **App Check + Paystack** — unlocks payments, NIN, inspection booking.
5. **Agent, chat, notifications.**

### Native dependencies — none are blockers

| Flutter package | Web answer |
|---|---|
| `image_picker` | file input (already used for property photos) |
| `firebase_messaging` | web push |
| `flutter_local_notifications` | Notifications API |
| `local_auth` (biometrics) | drop, or WebAuthn |

---

## Why server-rendered, not client Firestore

Verified in `clearrent/firestore.rules:177`:

```
match /properties/{propertyId} {
  allow read: if request.auth != null;
```

Listings are **not publicly readable**, so an anonymous visitor cannot read them from the
client. Three reasons the server-side fix is the right answer rather than a workaround:

1. **Rules stay locked.** No public exposure of the `properties` collection.
2. **Field projection.** Firestore rules cannot filter *fields* — a public client read
   would leak the entire document (`landlordId`, payout data, ownership doc status, exact
   coordinates). Server-side we emit only what is safe.
3. **SEO.** Property pages must be real HTML for crawlers. This is the whole commercial
   point of the web surface.

---

## Phase 1 — Public browse (no auth, no App Check, no payments)

Independently shippable. Satisfies Paystack's outstanding "go live and be reviewable"
requirement, which is currently blocked by the site being waitlist-only.

### Routes
- `/properties` — list with filters: state, city, LGA, property type, bedrooms, rent band.
- `/properties/[id]` — indexable detail page.
- `/sitemap.xml` — generated from published listings.

### Detail page content
Title, images, video, bedrooms/bathrooms/toilets, amenities, recurring dues, and the full
package: rent + agent fee + **caution deposit including its refundability line**
(`cautionDepositRefundable`, shipped 2026-07-30).

### Publication gate — do not skip
Only publish a property when **all** hold:
- `isAvailable == true`
- `readyForInspections == true`
- effective `ownershipDocStatus == 'verified'` — resolve `'inherited'` through the
  building, never treat the marker as approval

Publishing unvetted listings publicly would undercut the verification promise the platform
is sold on. Mirror the app's allowlist logic exactly.

### Never emit to the client
`address` / exact street address, `latitude` / `longitude`, `landlordId`, payout or
earnings fields, `ownershipDocUrl`, `ownershipDocStatus`, `private/location` subdoc.

Public pages show `approximateAddress` (LGA, city, state) only. The exact address is
released after inspection approval — that gating already exists and ports unchanged.

### CTA
Deep-link to the app (or a "get the app" interstitial) until Phase 2 lands.

---

## Step 1 — Auth + onboarding (built 2026-07-30)

Routes: `/signup` (account type → phone+OTP → profile), `/login` (phone OTP,
with an email/password tab for staff accounts), `/dashboard` (role-based home),
`/list` (landlord add-property, now behind auth).

**Two different reCAPTCHAs — do not conflate them.**

| Need | What it is | Status |
|---|---|---|
| Phone sign-in | `RecaptchaVerifier`, client widget | Works. No console key needed; `localhost` and `verealtytech.com` are already authorized domains. CSP had to allow `www.google.com` + `www.gstatic.com`. |
| Gated callables | App Check reCAPTCHA v3/Enterprise provider | **Registered 2026-07-31.** Verified 2026-08-01 against the App Check API. |

**App Check is wired (verified 2026-08-01).** Both `recaptchaEnterpriseConfig` and
`recaptchaV3Config` now exist on app `1:513996752248:web:937fd2f2525b35b4dd348d`. The
Enterprise site key `6LcmHG8t…Bb5k` ("ClearRent Web App Check", created 2026-07-31) matches
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in `.env.local`, and `next.config.ts` already admits
`https://*.googleapis.com` (covers `firebaseappcheck` + `content-firebaseappcheck`) and
`https://www.google.com` on `connect-src`. `lib/firebase-client.ts:73` attaches the provider.

Two things that will still bite:
- The key's `allowedDomains` are `verealtytech.com` and `localhost` only. **Vercel preview
  deployments (`*.vercel.app`) are not allowed**, so every gated callable fails on a preview
  URL while working in production. That is not a bug to chase.
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` must be set in Vercel too, alongside the three `FIREBASE_*`
  vars below. It is inlined at build time, so a deploy without it ships an app with no App
  Check at all.

**Testing without SMS.** The project has test phone numbers configured, e.g.
`+2349060883232` → `123456` (that is `mide@verealtytech.com`).

**`phoneToE164` is ported verbatim** into `lib/phone.ts`. If web and app
normalise differently, the same person gets two different `phone` values and
every phone-keyed lookup silently misses.

**Onboarding does not set `verificationStatus`.** That is NIN verification's
job, via `submitNin` — which enforces App Check. So a landlord who onboards on
web cannot list until they verify in the app. This is the first hard dependency
on step 4, and it is why the dashboard says so explicitly rather than failing
with an opaque `permission-denied`.

---

## Phase 1b — Landlord listing creation (`/list`)

Added to scope 2026-07-30. Sign in with the Firebase Web SDK, then write the
property from the **client, as the signed-in landlord** — not server-side.

**Why the client and not an admin route.** `firestore.rules` enforces the create
guards: self-assigned `landlordId`, a user doc with
`verificationStatus == 'verified'`, `isVerified` pinned false at birth, and an
allowlist on `ownershipDocStatus`. The Admin SDK bypasses rules entirely, so a
server-side write would mean re-implementing every one of those guards as a
second source of truth — the exact failure mode the rules comments document
(a denylist that let `'inherited'` and `'not_uploaded'` walk through). Writing
as the user means web and app are enforced by the same rules file.

`lib/create-listing.ts` mirrors `PropertyService.createProperty` field for
field, including the two-step write: parent doc first, then
`properties/{id}/private/location`. They cannot be batched — the subdoc's write
rule reads the parent's `landlordId` via `get()`, which is not visible for a doc
created in the same batch.

**One deliberate improvement over the app:** the Flutter service writes
`'lga': ''` with a `// Can be added later` comment, so `approximateAddress` on
app-created listings degrades to "city, state". The web form collects LGA
properly. Schema-compatible in both directions.

**Listing fee.** The free first listing (`totalListingsCreated == 0`) needs no
payment, which is why this flow touches none of the App-Check-gated callables.
Charging for subsequent listings on the web needs the Paystack web path and
therefore App Check first — not built.

---

## Phase 2 — Tenant entry

Sign-up / sign-in with the Firebase Web SDK, then request an inspection.

**Do App Check first, not last.** Web cannot use Play Integrity — it needs reCAPTCHA v3 or
Enterprise, registered separately in the Firebase console.

Measured 2026-07-30 via the App Check API — enforcement per service on
`clearrent-app`:

| Service | Enforcement |
|---|---|
| `firestore.googleapis.com` | `UNENFORCED` |
| `firebasestorage.googleapis.com` | `UNENFORCED` |
| `identitytoolkit.googleapis.com` | `UNENFORCED` |

So **direct Firestore reads/writes and Auth from the web are not App Check
gated today** — which is what lets Phase 1b ship without it. The gate is
per-function in code, and only bites on these callables, which are
`enforceAppCheck: true` and will fail with `unauthenticated` until the web
provider works:

```
createRentalInterest, recordRentPayment, confirmInspectionPayment,
initializePayment, verifyPayment, refundPayment, resolveAccount,
submitNin, deleteMyAccount, getSignedAgreementUrl, agentUnassignFromProperty
```

A day was lost on 2026-07-29/30 to exactly this failure mode on Android, where App Check
rejection surfaces as `unauthenticated` and the client mislabels it "session expired".
Expect the same confusion on web and wire it deliberately.

Also required: tenant verification + NIN before booking, and a web path for Paystack
(current flow assumes the mobile SDK).

---

## Cross-cutting

- **Service account.** Done 2026-07-30: `clearrent-web-ssr@clearrent-app.iam.gserviceaccount.com`,
  `roles/datastore.user`, in `.env.local`. **Still to do: set the same three
  `FIREBASE_*` vars in Vercel** — the key previously in `.env.local` had been
  revoked, so whatever Vercel is holding is suspect and the waitlist route may be
  failing in production. Firestore IAM has no per-collection scoping, so
  `datastore.user` (read + write, Firestore only) is the narrowest role that also
  covers the waitlist write; it is still far narrower than the Firebase Admin SDK
  default account, which carries Auth and Storage admin too.
- **Caching.** Listing pages should use ISR/revalidation — Firestore reads on every request
  will be slow and costly.
- **Brand assets.** `clearrent_lockup_*.svg` handoff for headers/footers is still open.

---

## State of the world (2026-07-30)

- Production data was wiped to a clean slate: only the two admin accounts remain
  (`oredugbamide@gmail.com` superAdmin, `mide@verealtytech.com` admin), verified and intact.
  Backup at `gs://clearrent-app-firestore-backups/2026-07-30-pre-wipe`.
- **There are currently zero properties**, so Phase 1 has nothing to render until listings
  are recreated during the end-to-end test.
- ~473 orphaned documents (activities, notifications, payments, conversations) referencing
  the kept admins survived the wipe and are **not yet cleaned up** — decision outstanding.

---

## Open questions

1. Domain/route shape — `verealtytech.com/properties`, or a `clearrent.` subdomain?
   Built at `/properties` for now; nothing links to it from the homepage yet.
2. Does the waitlist landing page stay as the homepage, or does browse become the homepage?
   **Still open** — the homepage was deliberately left untouched.
3. Search — Firestore queries only, or an index (Algolia/Typesense) for text search?
   Firestore alone cannot do full-text; area/type/price filters are fine.
4. The publication gate is currently applied **in memory** over the newest 200
   listings, because a grouped unit's effective doc status lives on its building
   and cannot be expressed as a Firestore query. Needs a composite index and
   pagination before the catalogue gets large.
