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

/** Send a notification email to info@verealtytech.com via Resend */
async function sendNotificationEmail({
  name,
  email,
  phone,
  userType,
}: {
  name: string
  email: string
  phone: string
  userType: string
}) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn('⚠️ RESEND_API_KEY not set — skipping email notification')
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'ClearRent Waitlist <waitlist@verealtytech.com>',
        to: ['info@verealtytech.com', 'oredugbamide@gmail.com'],
        subject: `🚀 New Waitlist Signup: ${name} (${userType})`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px;">
            <h2 style="color: #0B3D2E; margin-bottom: 20px;">New Waitlist Signup</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #666; width: 120px;">Name</td>
                <td style="padding: 10px 0; font-weight: 600;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Email</td>
                <td style="padding: 10px 0; font-weight: 600;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Phone</td>
                <td style="padding: 10px 0; font-weight: 600;">${phone || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666;">Type</td>
                <td style="padding: 10px 0;">
                  <span style="
                    background: ${userType === 'landlord' ? '#0D9488' : userType === 'tenant' ? '#6366F1' : '#F59E0B'};
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                    text-transform: capitalize;
                  ">${userType}</span>
                </td>
              </tr>
            </table>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p style="color: #999; font-size: 13px;">
              This person just joined the ClearRent waitlist from the website.
            </p>
          </div>
        `,
      }),
    })

    const resData = await res.json()
    if (!res.ok) {
      console.error('❌ Resend API error:', res.status, resData)
    } else {
      console.log('✅ Email sent successfully:', resData.id)
    }
  } catch (err) {
    console.error('❌ Failed to send notification email:', err)
    // Don't throw — email failure shouldn't block the waitlist signup
  }
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

    // Send email notification — must await on Vercel (serverless kills after response)
    await sendNotificationEmail({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || '',
      userType,
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}