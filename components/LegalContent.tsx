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
      {intro('This Privacy Policy explains how Verealty Technologies Ltd. ("we", "our", "ClearRent") collects, uses, stores, and protects your personal information when you use our platform and services. It is intended to comply with the Nigeria Data Protection Act 2023 (NDPA) and the Nigeria Data Protection Regulation.')}

      {h('1. Who We Are')}
      {p('ClearRent is a product of Verealty Technologies Ltd., a company registered in Nigeria (RC: 9435442). We operate a verification-first rental platform connecting landlords, tenants, and agents in Lagos, Nigeria.')}
      {p('For the purposes of the NDPA, Verealty Technologies Ltd. is the data controller responsible for your personal data.')}
      {p('Data protection contact: info@verealtytech.com')}

      {h('2. Information We Collect')}
      {p('We collect the following categories of information:')}
      {ul([
        'Identity information: Full name, date of birth, National Identification Number (NIN)',
        'Contact information: Phone number, email address',
        'Account information: Account type (landlord, tenant, or agent), profile details',
        'Tenant-specific: Occupation, employer, workplace area, monthly income range, rent budget range, preferred areas, work mode, marital status',
        'Landlord-specific: Property documents, ownership verification documents, utility bills, bank account details (for payouts)',
        'Agent-specific: Guarantor details, proof of address, experience documentation, bank account details (for payouts)',
        'Property information: Photos, videos, descriptions, location, pricing',
        'Transaction information: Inspection fee records, payment proof uploads, verification fee records, deal completion records, payout records',
        'Usage data: How you interact with the platform, device information, IP address',
        'Communications: Messages sent through our in-app chat system',
      ])}
      {p('Some of this information — in particular your NIN, income details, and verification documents — constitutes sensitive personal data under the NDPA, and we apply additional safeguards to it as described in Section 5.')}

      {h('3. Lawful Basis for Processing')}
      {p('Under the NDPA, we process your personal data on one or more of the following lawful bases:')}
      {ul([
        'Consent — for optional processing, such as tenant profile details used for matching. You may withdraw consent at any time (see Section 8).',
        'Performance of a contract — to provide the services you sign up for, including verification, listings, inspections, and payments.',
        'Legal obligation — to comply with Nigerian law, including anti-fraud, tax, and record-keeping requirements.',
        'Legitimate interest — to operate, secure, and improve the platform, and to prevent fraud, provided this does not override your rights and freedoms.',
      ])}
      {p('Where we rely on consent for sensitive personal data (such as your NIN for identity verification), we obtain that consent explicitly at the point of collection.')}

      {h('4. How We Use Your Information')}
      {p('We use your information to:')}
      {ul([
        'Verify your identity and confirm eligibility to use the platform',
        'Connect landlords, tenants, and agents appropriately',
        'Process verification, listing, inspection, and deal-completion fee payments, and disburse payouts',
        'Facilitate property inspections and bookings',
        'Display verified listings to tenants',
        'Enable in-app messaging between platform participants',
        'Review and approve ownership documents submitted by landlords',
        'Send platform-related notifications and announcements',
        'Detect, prevent, and investigate fraud and misuse',
        'Improve and maintain our platform',
        'Comply with legal obligations under Nigerian law',
      ])}

      {h('5. How We Store and Protect Your Data')}
      {p('Your data is stored using Google Firebase (Firestore and Firebase Storage), hosted on Google Cloud infrastructure. Media files including property images, videos, and verification documents are stored on Cloudinary. Payment processing is handled by Paystack. These providers employ industry-standard encryption at rest and in transit.')}
      {p('Sensitive verification documents (including NIN documents, ownership documents, and utility bills) are access-restricted and visible only to authorised ClearRent administrators for verification purposes. We are implementing additional field-level protection for identification numbers; until then, such data is protected by access controls and provider-level encryption.')}
      {p('We restrict internal access to personal data to staff and administrators who need it to perform their roles.')}

      {h('6. International Data Transfers')}
      {p('Some of our infrastructure providers (Google Firebase, Cloudinary, Paystack) process or store data on servers located outside Nigeria. Where your personal data is transferred outside Nigeria, we rely on the transfer mechanisms permitted under the NDPA, including the existence of adequate data protection measures by these providers under their data processing agreements with us. By using ClearRent, you acknowledge that your data may be processed outside Nigeria for these purposes.')}

      {h('7. Who We Share Your Data With')}
      {p('We do not sell your personal data. We may share limited information with:')}
      {ul([
        'Other verified platform users — only what is necessary for a transaction (for example, a tenant\'s name and verified status visible to a landlord, or a handler\'s contact details for a booked inspection)',
        'Infrastructure and payment providers — Google Firebase, Cloudinary, and Paystack, acting as data processors under data processing agreements',
        'Regulatory and law-enforcement authorities — where required by Nigerian law, regulation, or valid court order',
      ])}

      {h('8. Your Rights')}
      {p('As a data subject under the NDPA, you have the right to:')}
      {ul([
        'Access the personal information we hold about you',
        'Rectify inaccurate or incomplete information',
        'Erase your account and associated personal data, subject to legal retention requirements',
        'Restrict or object to certain processing',
        'Data portability — receive your data in a structured, commonly used format',
        'Withdraw consent for any processing based on consent, without affecting prior lawful processing',
        'Lodge a complaint with the Nigeria Data Protection Commission (NDPC)',
      ])}
      {p('To exercise any of these rights, contact us at info@verealtytech.com. We will respond within the timeframe required by the NDPA.')}

      {h('9. Data Retention')}
      {p('We retain your personal data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where retention is required by law — for example, financial and transaction records, which we retain for the period required under applicable Nigerian tax and company law (generally up to six years). Anonymised or aggregated data that no longer identifies you may be retained for analytics.')}

      {h('10. Children\'s Privacy')}
      {p('ClearRent is not intended for use by persons under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has registered on our platform, please contact us immediately and we will remove the account and associated data.')}

      {h('11. Changes to This Policy')}
      {p('We may update this Privacy Policy from time to time. We will notify registered users of significant changes through in-app announcements. The "Last updated" date reflects the most recent revision. Continued use of the platform after changes take effect constitutes acceptance of the updated policy.')}

      {h('12. Contact Us')}
      {p('For any privacy-related questions, requests, or complaints, please contact: info@verealtytech.com. You may also lodge a complaint directly with the Nigeria Data Protection Commission (NDPC).')}
    </div>
  )
}

export function TermsContent() {
  return (
    <div>
      {intro('These Terms and Conditions ("Terms") govern your use of the ClearRent platform operated by Verealty Technologies Ltd. By creating an account or using ClearRent, you agree to be bound by these Terms. If you do not agree, do not use the platform.')}

      {h('1. About ClearRent')}
      {p('ClearRent is a verification-first rental platform that connects verified landlords, tenants, and agents in Lagos, Nigeria. The platform is operated by Verealty Technologies Ltd., a company incorporated in Nigeria (RC: 9435442).')}

      {h('2. Eligibility')}
      {p('To use ClearRent you must:')}
      {ul([
        'Be at least 18 years of age',
        'Be a Nigerian resident or citizen with a valid NIN',
        'Provide accurate and truthful information during registration and verification',
        'Not have been previously suspended or banned from the platform',
      ])}

      {h('3. What Verification Means (and Does Not Mean)')}
      {p('ClearRent verifies the identity of users and reviews documents submitted by landlords and agents. Verification confirms identity and document submission at a point in time. It is not a guarantee of any user\'s ongoing honesty or conduct, the current legal status or condition of any property, or the outcome of any tenancy. You remain responsible for exercising your own judgement and due diligence before entering into any agreement. ClearRent reduces, but cannot wholly eliminate, the risk of fraud or misrepresentation by other users.')}

      {h('4. Account Types and Verification')}
      {p('ClearRent has three account types: Landlord, Tenant, and Agent. Each account type requires identity verification before full platform access is granted. Verification involves submission of your NIN and relevant supporting documents specific to your account type.')}
      {p('You must also verify your email address. Certain actions may require a verified email or completed identity verification.')}

      {h('5. Account Security')}
      {p('You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You must not share your account access with any third party. Notify us immediately at info@verealtytech.com if you suspect unauthorised use of your account.')}

      {h('6. Landlord Obligations')}
      {p('As a landlord on ClearRent, you agree to:')}
      {ul([
        'Only list properties for which you are the verified legal owner or authorised representative',
        'Provide accurate property descriptions, photos, and pricing information',
        'Keep your listing information up to date',
        'Not list properties that are already occupied or unavailable',
        'Honour agreed inspection bookings',
        'Not engage in discriminatory practices prohibited by law in selecting tenants',
      ])}

      {h('7. Tenant Obligations')}
      {p('As a tenant on ClearRent, you agree to:')}
      {ul([
        'Provide truthful information in your profile, including income and employment details',
        'Only book inspections for properties you are genuinely interested in renting',
        'Pay inspection fees as agreed before inspections are conducted',
        'Not share your account access with third parties',
      ])}

      {h('8. Agent Obligations')}
      {p('As an agent on ClearRent, you agree to:')}
      {ul([
        'Only represent properties to which you have been formally assigned by the landlord on the platform',
        'Act honestly in your dealings with both landlords and tenants',
        'Conduct inspections professionally and at agreed times',
        'Not collect any platform fees from tenants or landlords outside of the platform',
        'Not misrepresent property details to prospective tenants',
      ])}

      {h('9. No Off-Platform Circumvention')}
      {p('ClearRent invests in verifying users and facilitating safe connections. To protect this service, all users agree:')}
      {ul([
        'Not to use ClearRent to identify a counterparty and then deliberately complete the same or a substantially similar rental transaction off-platform in order to avoid ClearRent fees',
        'Not to solicit or arrange to take a connection made through ClearRent off-platform before the relevant on-platform fees have been paid',
        'Landlords: not to arrange private commissions with agents in a way that circumvents platform fees',
        'Agents: not to divert a landlord\'s prospective tenants to off-platform deals, and not to collect any platform fee outside the platform',
        'Tenants: not to arrange to rent a property discovered through ClearRent directly with the landlord or agent in order to avoid the deal completion fee',
      ])}
      {p('For the avoidance of doubt, this does not restrict legitimate direct arrangements that fall outside ClearRent\'s fees — for example, transport or logistics costs agreed directly between a tenant and an agent for travel to an inspection.')}
      {p('We may suspend or ban any account, and pursue recovery of avoided fees, where we reasonably believe deliberate circumvention has occurred.')}

      {h('10. Fees and Payments')}
      {p('The following fees apply on ClearRent:')}
      {ul([
        'Tenant verification: ₦5,000 to verify, then ₦3,000 for each annual renewal',
        'Landlord verification: ₦15,000 to verify, then ₦12,000 for each annual renewal',
        'Agent verification: ₦10,000 to verify, then ₦7,000 for each annual renewal',
        'Property listing fees: as displayed at the time of listing',
        'Inspection fees: as displayed to tenants before booking, calculated by area and handler',
        'Deal completion fee: a fee charged to the parties to a completed rental on first rent payment, as displayed at the time, which unlocks post-deal tools',
        'Landlord Pro subscription: an optional annual subscription, priced as displayed, offering additional landlord features',
      ])}
      {p('All fees are displayed before you are charged. All fees are processed securely via Paystack. Fees are subject to change with notice to registered users; changes do not affect fees already paid.')}

      {h('11. Refunds')}
      {p('Verification fees are non-refundable once your documents have been reviewed, regardless of outcome. Inspection fees include a non-refundable platform service charge; the remaining handler\'s portion is refundable where an inspection is declined by the handler, cancelled by the handler, or otherwise not conducted for reasons not attributable to the tenant, in accordance with the refund process shown in the app. Deal completion fees and subscription fees are non-refundable once the corresponding service or access has been provided, except as required by law.')}
      {p('Specific refund conditions are shown in the app at the relevant point. Where a refund is due, it is processed within a reasonable period.')}

      {h('12. Payments and Payouts')}
      {p('ClearRent facilitates payments between users through Paystack and disburses payouts (such as rent and inspection earnings) to the bank details you provide. ClearRent is not a bank or a licensed financial institution. We act solely as a technology platform facilitating these transactions. You are responsible for the accuracy of the bank details you provide; we are not liable for funds misdirected due to incorrect details supplied by you.')}

      {h('13. Prohibited Conduct')}
      {p('You must not use ClearRent to:')}
      {ul([
        'Post fraudulent, misleading, or inaccurate property listings',
        'Impersonate another person or misrepresent your identity',
        'Create multiple or duplicate accounts, or register after being banned',
        'Collect or solicit platform fees from users outside the platform',
        'Harass, threaten, abuse, or discriminate against other users',
        'Attempt to circumvent the verification or payment systems',
        'Use the platform for money laundering or any unlawful purpose',
        'Upload malicious code or attempt to compromise platform security',
        'Scrape, copy, reproduce, or redistribute platform content without permission',
        'Use another user\'s account or share your own',
      ])}

      {h('14. Platform Role and User Disputes')}
      {p('ClearRent is a marketplace platform. We facilitate connections between landlords, tenants, and agents but are not a party to any tenancy agreement or other arrangement entered into between users. We do not guarantee the quality, safety, or legality of any listed property, and we are not responsible for the conduct of any user.')}
      {p('Disputes between users (for example, between a landlord and tenant over a tenancy) are the responsibility of the parties involved. ClearRent does not act as an arbitrator or guarantor of any agreement, though we may, at our discretion, suspend accounts or assist law enforcement where fraud or unlawful conduct is evident.')}

      {h('15. Suspension and Termination')}
      {p('We reserve the right to suspend or permanently ban any account that violates these Terms, engages in fraudulent activity, or harms other users. Verification fees paid prior to suspension are non-refundable. You may close your account at any time, subject to completion of any pending transactions and our legal retention obligations.')}

      {h('16. Limitation of Liability')}
      {p('To the fullest extent permitted by Nigerian law, Verealty Technologies Ltd. shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the ClearRent platform, including but not limited to losses arising from fraudulent third-party conduct, property disputes, failed tenancy agreements, or unavailability of the platform. Nothing in these Terms excludes liability that cannot lawfully be excluded.')}

      {h('17. Indemnity')}
      {p('You agree to indemnify and hold harmless Verealty Technologies Ltd. and its officers and employees from any claims, losses, or liabilities arising from your breach of these Terms, your misuse of the platform, or your violation of any law or the rights of another party.')}

      {h('18. Intellectual Property')}
      {p('All platform content, branding, and software (excluding content you upload) are the property of Verealty Technologies Ltd. You may not copy, modify, or reproduce them without our written permission. You retain ownership of content you upload but grant us a licence to use it for the purpose of operating the platform.')}

      {h('19. Force Majeure')}
      {p('We are not liable for any failure or delay in performance caused by circumstances beyond our reasonable control, including network outages, third-party provider failures, natural events, or government action.')}

      {h('20. Severability and Assignment')}
      {p('If any provision of these Terms is found unenforceable, the remaining provisions continue in effect. We may assign these Terms to a successor entity (for example, in connection with a merger or acquisition); you may not assign your rights without our consent.')}

      {h('21. Governing Law and Jurisdiction')}
      {p('These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of Lagos State, Nigeria.')}

      {h('22. Changes to These Terms')}
      {p('We may update these Terms from time to time. Registered users will be notified of material changes through in-app announcements. The "Last updated" date reflects the most recent revision. Continued use of the platform after the effective date of changes constitutes your acceptance.')}

      {h('23. Contact')}
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
        'Authentication state — when you use email verification or sign-in features, Google Firebase may store authentication data in your browser to manage your session.',
      ])}

      {h('Analytics Cookies')}
      {p('We do not currently use any third-party analytics cookies (e.g. Google Analytics). If this changes, we will update this policy and obtain your consent before setting any analytics cookies.')}

      {h('Marketing Cookies')}
      {p('We do not use any advertising or marketing cookies. ClearRent does not display advertisements and does not share your browsing data with advertisers.')}

      {h('3. Third-Party Services')}
      {p('Our website uses the following third-party services that may set their own cookies or use local storage:')}
      {ul([
        'Google Fonts — used to load the Outfit and Lora typefaces. Google may collect limited data on font requests. See Google\'s Privacy Policy for details.',
        'Google Firebase — used for authentication (including email verification) and may store authentication state in your browser. See Google\'s Privacy Policy for details.',
        'Vercel — our hosting provider may set functional cookies as part of their infrastructure. See Vercel\'s Privacy Policy for details.',
      ])}

      {h('4. Local Storage')}
      {p('In addition to cookies, we use your browser\'s localStorage to save your theme preference (light/dark/system). This data stays on your device and is never transmitted to our servers. Firebase authentication features may also use local browser storage to maintain your signed-in state.')}

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