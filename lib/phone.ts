/**
 * Nigerian phone → E.164, a direct port of `phoneToE164` in
 * `clearrent/lib/core/utils/phone_utils.dart`. The web must normalise
 * identically or the same person onboarding on web vs app produces two
 * different `phone` values on their user doc, and every phone-keyed lookup
 * (guarantors, tenant search, admin tooling) silently misses.
 *
 * Returns null when the input is not a valid NG mobile number.
 */
export function phoneToE164(raw: string): string | null {
  const digits = raw.replace(/[\s\-()+]/g, '')
  if (!/^\d+$/.test(digits)) return null

  let subscriber: string
  if (digits.length === 11 && digits.startsWith('0')) {
    subscriber = digits.slice(1)
  } else if (digits.length === 13 && digits.startsWith('234')) {
    subscriber = digits.slice(3)
  } else if (digits.length === 10) {
    subscriber = digits
  } else {
    return null
  }

  // NG mobile subscriber numbers start with 7, 8 or 9 (10 digits total).
  if (!/^[789]\d{9}$/.test(subscriber)) return null

  return `+234${subscriber}`
}
