// READ-ONLY diagnostic. Lists every property with the flags that decide
// whether a tenant can actually book an inspection on it, so a failing listing
// can be fixed by name instead of by guesswork.
//
// Mirrors the app's gate: a verified landlord, isAvailable, readyForInspections,
// an effective ownershipDocStatus of 'verified' (resolved through the building
// for grouped units), a free tenant slot, and at least one inspection day/slot.
import { readFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    }),
)

initializeApp({
  credential: cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})
const db = getFirestore()

const [props, users] = await Promise.all([
  db.collection('properties').get(),
  db.collection('users').get(),
])

const userById = new Map(users.docs.map((d) => [d.id, d.data()]))

// Grouped units carry 'inherited'; the reviewed document lives on the building.
async function effectiveDocStatus(p) {
  const raw = p.ownershipDocStatus ?? 'none'
  if (raw !== 'inherited' || !p.buildingId) return raw
  const b = await db.collection('buildings').doc(p.buildingId).get()
  return b.exists ? (b.data().ownershipDocStatus ?? 'none') : 'none'
}

console.log(`\n${props.size} properties total\n${'='.repeat(70)}`)

for (const doc of props.docs) {
  const p = doc.data()
  const landlord = userById.get(p.landlordId) ?? {}
  const docStatus = await effectiveDocStatus(p)
  const slots = (p.currentTenantsCount ?? 0) < (p.maxTenants ?? 1)
  const days = (p.inspectionDays ?? []).length
  const times = (p.inspectionTimeSlots ?? []).length

  const checks = [
    ['landlord verified', landlord.verificationStatus === 'verified'],
    ['isAvailable', p.isAvailable === true],
    ['readyForInspections', p.readyForInspections === true],
    [`ownershipDoc=${docStatus}`, docStatus === 'verified'],
    [`slots ${p.currentTenantsCount ?? 0}/${p.maxTenants ?? 1}`, slots],
    [`inspectionDays=${days}`, days > 0],
    [`timeSlots=${times}`, times > 0],
  ]
  const bookable = checks.every(([, ok]) => ok)

  console.log(
    `\n${bookable ? 'BOOKABLE  ' : 'BLOCKED   '} ${p.title ?? '(untitled)'}  [${doc.id}]`,
  )
  console.log(`  ${p.city ?? ''} ${p.state ?? ''} · rent ${p.rent ?? 0}`)
  for (const [label, ok] of checks) {
    if (!ok) console.log(`   ✗ ${label}`)
  }
}

// Which properties this tenant already inspected — fix 5 deliberately blocks a
// second paid inspection on those, so a re-test needs an untouched one.
const phone = process.argv[2]
if (phone) {
  const who = users.docs.find((d) => d.data().phone === phone)
  if (!who) {
    console.log(`\nNo user with phone ${phone}`)
  } else {
    const reqs = await db
      .collection('inspection_requests')
      .where('tenantId', '==', who.id)
      .get()
    console.log(`\n${'='.repeat(70)}\nInspections for ${phone} (${who.id}):`)
    for (const r of reqs.docs) {
      const d = r.data()
      console.log(`  ${d.status.padEnd(22)} ${d.propertyTitle} [${d.propertyId}]`)
    }
  }
}

process.exit(0)
