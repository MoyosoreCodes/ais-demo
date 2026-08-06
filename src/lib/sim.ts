/**
 * Simulated integrations.
 *
 * CLAUDE.md §2: the prototype makes no network calls other than OpenStreetMap
 * tile requests, and every simulated integration must be *labelled* as
 * simulated in the UI. Nothing in this module contacts an external service —
 * these are local stand-ins that make the workflow demonstrable without
 * claiming a capability that does not exist.
 *
 * `SIMULATED_LABEL` is the single string every affected control renders, so an
 * evaluator can see at a glance what is real and what is staged.
 */

import type { Client } from './types'

export const SIMULATED_LABEL = 'simulated'

/** How long a staged round-trip should appear to take, in ms. */
const LATENCY = { seyId: 900, otp: 600, sms: 500, geo: 1100, sync: 700 } as const

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ *
 * SeyID identity lookup (i.8, ii.3) — SIMULATED
 * ------------------------------------------------------------------ */

export interface SeyIdProfile {
  nin: string
  firstName: string
  lastName: string
  gender: 'F' | 'M'
  dateOfBirth: string
  district: string
  address: string
  phone: string
}

export interface SeyIdLookupResult {
  matched: boolean
  profile?: SeyIdProfile
  message: string
  simulated: true
}

/**
 * Stands in for a SeyID lookup keyed on NIN. In production this would be a
 * server-to-server call to the national identity service; here it resolves
 * against the local seed so the demo can show pre-filled, "verified" data.
 */
export async function seyIdLookup(
  nin: string,
  clients: Client[],
): Promise<SeyIdLookupResult> {
  await wait(LATENCY.seyId)
  const match = clients.find((c) => c.nin === nin.trim() && c.status !== 'merged')
  if (!match) {
    return {
      matched: false,
      message: `No SeyID record matches ${nin}. Continue with manual entry and local 2FA.`,
      simulated: true,
    }
  }
  return {
    matched: true,
    profile: {
      nin: match.nin,
      firstName: match.firstName,
      lastName: match.lastName,
      gender: match.gender,
      dateOfBirth: match.dateOfBirth,
      district: match.district,
      address: match.address,
      phone: match.phone,
    },
    message: 'SeyID returned a matching citizen record.',
    simulated: true,
  }
}

/* ------------------------------------------------------------------ *
 * One-time passcodes (i.8) — SIMULATED
 * ------------------------------------------------------------------ */

export interface OtpChallenge {
  /** The code is shown on screen precisely because delivery is simulated. */
  code: string
  channel: 'sms' | 'email' | 'totp'
  sentTo: string
  expiresAt: number
  simulated: true
}

/** Six digits from the Web Crypto RNG — no SMS or email leaves the browser. */
export async function issueOtp(
  channel: OtpChallenge['channel'],
  sentTo: string,
): Promise<OtpChallenge> {
  await wait(LATENCY.otp)
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000
  return {
    code: String(n).padStart(6, '0'),
    channel,
    sentTo,
    expiresAt: Date.now() + 5 * 60 * 1000,
    simulated: true,
  }
}

export const verifyOtp = (challenge: OtpChallenge, entered: string): 'ok' | 'expired' | 'mismatch' => {
  if (Date.now() > challenge.expiresAt) return 'expired'
  return entered.trim() === challenge.code ? 'ok' : 'mismatch'
}

/* ------------------------------------------------------------------ *
 * SMS / email dispatch (vi.8, xiii.3, xiii.4) — SIMULATED
 * ------------------------------------------------------------------ */

export interface DispatchResult {
  delivered: true
  channel: 'sms' | 'email'
  to: string
  at: string
  simulated: true
}

/** Records an outbound message locally. No gateway is contacted. */
export async function dispatchMessage(
  channel: 'sms' | 'email',
  to: string,
): Promise<DispatchResult> {
  await wait(LATENCY.sms)
  return { delivered: true, channel, to, at: new Date().toISOString(), simulated: true }
}

/* ------------------------------------------------------------------ *
 * Device geolocation (iii.2) — SIMULATED
 * ------------------------------------------------------------------ */

export interface FixResult {
  lat: number
  lng: number
  accuracyM: number
  simulated: true
}

/**
 * Returns a fix near the supplied district centroid. The real browser
 * geolocation API is deliberately not called: the demo is walked indoors,
 * often on a laptop in another country, and a genuine fix would put the pin
 * in the wrong hemisphere.
 */
export async function simulatedFix(near: { lat: number; lng: number }): Promise<FixResult> {
  await wait(LATENCY.geo)
  const jitter = () => (crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff - 0.5) * 0.0016
  return {
    lat: Number((near.lat + jitter()).toFixed(5)),
    lng: Number((near.lng + jitter()).toFixed(5)),
    accuracyM: 6 + Math.round((crypto.getRandomValues(new Uint32Array(1))[0] / 0xffffffff) * 9),
    simulated: true,
  }
}

/* ------------------------------------------------------------------ *
 * Offline queue sync (x.3) — SIMULATED
 * ------------------------------------------------------------------ */

export const simulateSync = (): Promise<void> => wait(LATENCY.sync)

/* ------------------------------------------------------------------ *
 * Document & photo capture (iii.4, x.4) — SIMULATED
 * ------------------------------------------------------------------ */

/**
 * A deterministic placeholder "scan"/"photo" as a data URI. Real documents are
 * never used — CLAUDE.md §6 requires generated placeholders.
 */
export function placeholderImage(swatch: string, label: string, w = 420, h = 560): string {
  const palettes: Record<string, [string, string]> = {
    a: ['#E7EFEA', '#0F6B4F'],
    b: ['#EFEBE3', '#7C4600'],
    c: ['#E6EDF2', '#1F4E6B'],
    d: ['#EFE7E9', '#7F1616'],
  }
  const [bg, fg] = palettes[swatch[0]] ?? palettes.a
  const lines = Number(swatch[1] ?? 3) + 6
  const rows = Array.from({ length: lines }, (_, i) => {
    const y = 96 + i * 26
    const width = w - 64 - ((i * 37) % 90)
    return `<rect x="32" y="${y}" width="${width}" height="9" rx="4" fill="${fg}" opacity="0.16"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${bg}"/>
<rect x="16" y="16" width="${w - 32}" height="${h - 32}" fill="#fff" stroke="${fg}" stroke-opacity="0.25"/>
<rect x="32" y="40" width="150" height="14" rx="4" fill="${fg}" opacity="0.5"/>
<rect x="32" y="64" width="${w - 140}" height="11" rx="4" fill="${fg}" opacity="0.3"/>
${rows}
<text x="${w / 2}" y="${h - 44}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" fill="${fg}" opacity="0.75">${label}</text>
<text x="${w / 2}" y="${h - 26}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="${fg}" opacity="0.55">GENERATED PLACEHOLDER — NOT A REAL DOCUMENT</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
