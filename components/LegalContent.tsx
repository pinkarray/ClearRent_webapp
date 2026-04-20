'use client'

const h = (text: string) => (
  <h3 style={{
    fontFamily: 'Outfit',
    fontWeight: 700,
    fontSize: 16,
    color: 'var(--text-primary)',
    margin: '28px 0 10px',
  }}>
    {text}
  </h3>
)

const p = (text: string) => (
  <p style={{
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    margin: '0 0 12px',
  }}>
    {text}
  </p>
)

const ul = (items: string[]) => (
  <ul style={{ margin: '0 0 16px', paddingLeft: 20 }}>
    {items.map((item, i) => (
      <li key={i} style={{
        fontSize: 14,
        color: 'var(--text-secondary)',
        lineHeight: 1.8,
        marginBottom: 6,
      }}>
        {item}
      </li>
    ))}
  </ul>
)

const intro = (text: string) => (
  <div style={{
    background: 'rgba(10,123,108,0.06)',
    border: '1px solid rgba(10,123,108,0.15)',
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 24,
  }}>
    <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
      {text}
    </p>
  </div>
)

export function PrivacyPolicyContent() {
  return (
    <div>
      {intro('This Privacy Policy explains how Verealty Technologies Ltd. ("we", "our", "ClearRent") collects, uses, and protects your personal information when you use our platform and services.')}

      {h('1. Who We Are')}
      {p('ClearRent is a product of Verealty Technologies Ltd., a company registered in Nigeria. We operate a verification-first rental platform connecting landlords, tenants, and agents in Lagos, Nigeria.')}
      {p('Contact: info@verealtytech.com')}

      {h('2. Information We Collect')}
      {p('We collect the following categories of information:')}
      {ul([
        'Identity information: Full name, date of birth, National Identification Number (NIN)',
        'Contact information: Phone number, email address',
        'Account information: Account type (landlord, tenant, or agent), profile details',
        'Tenant-specific: Occupation, employer, workplace area, monthly income range, rent budget range, preferred areas, work mode, marital status',
        'Landlord-specific: Property documents, ownership verification documents, utility bills',
        'Agent-specific: Guarantor details, proof of address, experience documentation',
        'Property information: Photos, descriptions, location, pricing',
        'Transaction information: Inspection fee records, payment proof uploads, verification fee records',
        'Usage data: How you interact with the platform, device information, IP address',
        'Communications: Messages sent through our in-app chat system',
      ])}

      {h('3. How We Use Your Information')}
      {p('We use your information to:')}
      {ul([
        'Verify your identity and confirm eligibility to use the platform',
        'Connect landlords, tenants, and agents appropriately',
        'Process verification and listing fee payments',
        'Facilitate property inspections and bookings',
        'Display verified listings to tenants',
        'Enable in-app messaging between platform participants',
        'Review and approve ownership documents submitted by landlords',
        'Send platform-related notifications and announcements',
        'Improve and maintain our platform',
        'Comply with legal obligations under Nigerian law',
      ])}

      {h('4. How We Store Your Data')}
      {p('Your data is stored securely using Google Firebase (Firestore and Firebase Storage), hosted on Google Cloud infrastructure. Media files including property images and verification documents are stored on Cloudinary. Both services employ industry-standard encryption at rest and in transit.')}
      {p('We do not store your NIN or BVN in plain text. Sensitive documents uploaded for verification are accessible only to ClearRent administrators for review purposes.')}

      {h('5. Who We Share Your Data With')}
      {p('We do not sell your personal data. We may share limited information with:')}
      {ul([
        'Other verified platform users — only what is necessary for a transaction (e.g. a tenant\'s name and verified status visible to a landlord)',
        'Google Firebase and Cloudinary — as infrastructure providers under strict data processing agreements',
        'Regulatory authorities — if required by Nigerian law or court order',
      ])}

      {h('6. Your Rights')}
      {p('As a user of ClearRent, you have the right to:')}
      {ul([
        'Access the personal information we hold about you',
        'Request correction of inaccurate information',
        'Request deletion of your account and associated data',
        'Withdraw consent for optional data uses',
        'Lodge a complaint with the Nigeria Data Protection Commission (NDPC)',
      ])}
      {p('To exercise any of these rights, contact us at info@verealtytech.com.')}

      {h('7. Data Retention')}
      {p('We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law (e.g. transaction records).')}

      {h('8. Children\'s Privacy')}
      {p('ClearRent is not intended for use by persons under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has registered on our platform, please contact us immediately.')}

      {h('9. Changes to This Policy')}
      {p('We may update this Privacy Policy from time to time. We will notify registered users of significant changes through in-app announcements. Continued use of the platform after changes constitutes acceptance of the updated policy.')}

      {h('10. Contact Us')}
      {p('For any privacy-related questions or requests, please contact: info@verealtytech.com')}
    </div>
  )
}

export function TermsContent() {
  return (
    <div>
      {intro('These Terms and Conditions govern your use of the ClearRent platform operated by Verealty Technologies Ltd. By creating an account or using ClearRent, you agree to be bound by these terms.')}

      {h('1. About ClearRent')}
      {p('ClearRent is a verification-first rental platform that connects verified landlords, tenants, and agents in Lagos, Nigeria. The platform is operated by Verealty Technologies Ltd., a company incorporated in Nigeria.')}

      {h('2. Eligibility')}
      {p('To use ClearRent you must:')}
      {ul([
        'Be at least 18 years of age',
        'Be a Nigerian resident or citizen with a valid NIN',
        'Provide accurate and truthful information during registration and verification',
        'Not have been previously suspended or banned from the platform',
      ])}

      {h('3. Account Types and Verification')}
      {p('ClearRent has three account types: Landlord, Tenant, and Agent. Each account type requires identity verification before full platform access is granted. Verification involves submission of your NIN and relevant supporting documents specific to your account type.')}
      {p('Verification fees are non-refundable once your documents have been reviewed, regardless of the outcome.')}

      {h('4. Landlord Obligations')}
      {p('As a landlord on ClearRent, you agree to:')}
      {ul([
        'Only list properties for which you are the verified legal owner or authorised representative',
        'Provide accurate property descriptions, photos, and pricing information',
        'Keep your listing information up to date',
        'Not list properties that are already occupied or unavailable',
        'Honour agreed inspection bookings',
        'Not engage in discriminatory practices in selecting tenants',
      ])}

      {h('5. Tenant Obligations')}
      {p('As a tenant on ClearRent, you agree to:')}
      {ul([
        'Provide truthful information in your profile including income and employment details',
        'Only book inspections for properties you are genuinely interested in renting',
        'Pay inspection fees as agreed before inspections are conducted',
        'Not share your account access with third parties',
      ])}

      {h('6. Agent Obligations')}
      {p('As an agent on ClearRent, you agree to:')}
      {ul([
        'Only represent properties to which you have been formally assigned by the landlord on the platform',
        'Act honestly in your dealings with both landlords and tenants',
        'Conduct inspections professionally and at agreed times',
        'Not collect any fees from tenants or landlords outside of the platform',
        'Not misrepresent property details to prospective tenants',
      ])}

      {h('7. Fees and Payments')}
      {p('The following fees apply on ClearRent:')}
      {ul([
        'Tenant verification: ₦5,000 (one-time)',
        'Landlord verification: ₦15,000 (one-time)',
        'Agent verification: ₦10,000 (one-time)',
        'Property listing fees: as displayed at time of listing',
        'Inspection fees: as agreed per property and displayed to tenants before booking',
      ])}
      {p('All fees are processed securely via Paystack. All fees are subject to change with notice to registered users.')}

      {h('8. Prohibited Conduct')}
      {p('You must not use ClearRent to:')}
      {ul([
        'Post fraudulent, misleading, or inaccurate property listings',
        'Impersonate another person or misrepresent your identity',
        'Collect fees from users outside the platform',
        'Harass, threaten, or abuse other users',
        'Attempt to circumvent the verification system',
        'Use the platform for any unlawful purpose',
        'Scrape, copy, or reproduce platform content without permission',
      ])}

      {h('9. Platform Role')}
      {p('ClearRent is a marketplace platform. We facilitate connections between landlords, tenants, and agents but are not a party to any tenancy agreement entered into between users. We do not guarantee the quality, safety, or legality of any listed property, and we are not responsible for the conduct of any user.')}

      {h('10. Suspension and Termination')}
      {p('We reserve the right to suspend or permanently ban any account that violates these Terms, engages in fraudulent activity, or harms other users. Verification fees paid prior to suspension are non-refundable.')}

      {h('11. Limitation of Liability')}
      {p('To the fullest extent permitted by Nigerian law, Verealty Technologies Ltd. shall not be liable for any indirect, incidental, or consequential damages arising from your use of the ClearRent platform, including but not limited to losses arising from fraudulent third-party conduct, property disputes, or failed tenancy agreements.')}

      {h('12. Governing Law')}
      {p('These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.')}

      {h('13. Changes to These Terms')}
      {p('We may update these Terms from time to time. Registered users will be notified of material changes through in-app announcements. Continued use of the platform after the effective date of changes constitutes your acceptance.')}

      {h('14. Contact')}
      {p('For questions about these Terms, contact: info@verealtytech.com')}
    </div>
  )
}

export function CookiePolicyContent() {
  return (
    <div>
      {intro('This Cookie Policy explains how ClearRent (operated by Verealty Technologies Ltd.) uses cookies and similar technologies on our website at verealtytech.com.')}

      {h('1. What Are Cookies')}
      {p('Cookies are small text files placed on your device when you visit a website. They help the website remember your preferences and how you interact with it. Some cookies are essential for the site to work; others are optional and help us improve your experience.')}

      {h('2. Cookies We Use')}

      {h('Essential Cookies')}
      {p('These cookies are necessary for the website to function and cannot be disabled.')}
      {ul([
        'Theme preference — remembers whether you selected light, dark, or system theme so it persists between visits. Stored in localStorage as "clearrent-theme".',
        'Session cookies — used by Next.js for routing and rendering. These expire when you close your browser.',
      ])}

      {h('Analytics Cookies')}
      {p('We do not currently use any third-party analytics cookies (e.g. Google Analytics). If this changes, we will update this policy and obtain your consent before setting any analytics cookies.')}

      {h('Marketing Cookies')}
      {p('We do not use any advertising or marketing cookies. ClearRent does not display advertisements and does not share your browsing data with advertisers.')}

      {h('3. Third-Party Services')}
      {p('Our website uses the following third-party services that may set their own cookies or use local storage:')}
      {ul([
        'Google Fonts — used to load the Outfit and Lora typefaces. Google may collect limited data on font requests. See Google\'s Privacy Policy for details.',
        'Vercel — our hosting provider may set performance and analytics cookies as part of their infrastructure. See Vercel\'s Privacy Policy for details.',
      ])}

      {h('4. Local Storage')}
      {p('In addition to cookies, we use your browser\'s localStorage to save your theme preference (light/dark/system). This data stays on your device and is never transmitted to our servers.')}

      {h('5. Managing Cookies')}
      {p('You can control cookies through your browser settings. Most browsers allow you to:')}
      {ul([
        'View what cookies are stored on your device',
        'Delete all or specific cookies',
        'Block cookies from specific websites',
        'Block all third-party cookies',
      ])}
      {p('Note that disabling essential cookies may affect how the website functions. Your theme preference will reset if you clear localStorage.')}

      {h('6. Your Consent')}
      {p('By continuing to use verealtytech.com, you consent to our use of essential cookies as described in this policy. Since we do not use analytics or marketing cookies, no additional consent banner is required at this time. If we introduce optional cookies in the future, we will implement a proper consent mechanism.')}

      {h('7. Changes to This Policy')}
      {p('We may update this Cookie Policy if we introduce new technologies or third-party services. Any changes will be reflected on this page with an updated date.')}

      {h('8. Contact')}
      {p('For any questions about our use of cookies, contact: info@verealtytech.com')}
    </div>
  )
}