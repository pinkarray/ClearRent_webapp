import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, phone, userType, joinedAt } = body

    if (!name || !email || !userType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const app = getAdminApp()
    const db = getFirestore(app)

    // Check for duplicate email
    const existing = await db.collection('webapp_waitlist')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get()

    if (!existing.empty) {
      return NextResponse.json({ message: 'Already on waitlist' }, { status: 200 })
    }

    await db.collection('webapp_waitlist').add({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      userType,
      joinedAt,
      source: 'webapp',
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}