/**
 * Duplicate detection (ii.7 ★, iii.7 ★).
 *
 * Both checks are deterministic and explainable: each match carries the
 * reasons that fired, so the officer sees *why* the system thinks two records
 * are the same and can accept or dismiss the suggestion. Nothing is merged
 * automatically.
 */

import { distanceMetres, similarity } from './format'
import type { Client, Farm } from './types'

export type Confidence = 'high' | 'medium' | 'low'

export interface DuplicateReason {
  field: string
  detail: string
  weight: number
}

export interface ClientMatch {
  client: Client
  score: number
  confidence: Confidence
  reasons: DuplicateReason[]
}

export interface ClientCandidate {
  id?: string
  nin: string
  firstName: string
  lastName: string
  phone: string
  email: string
  dateOfBirth?: string
}

const confidenceFor = (score: number): Confidence =>
  score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low'

/** Candidate duplicates of a client, ranked. Compares NIN, name and contact. */
export function findClientDuplicates(
  candidate: ClientCandidate,
  clients: Client[],
  { threshold = 0.4 }: { threshold?: number } = {},
): ClientMatch[] {
  const nin = candidate.nin.trim()
  const phone = candidate.phone.trim()
  const email = candidate.email.trim().toLowerCase()
  const fullName = `${candidate.firstName} ${candidate.lastName}`.trim()

  const matches: ClientMatch[] = []

  for (const other of clients) {
    if (other.id === candidate.id) continue
    if (other.status === 'merged') continue

    const reasons: DuplicateReason[] = []
    let score = 0

    if (nin && other.nin === nin) {
      reasons.push({ field: 'NIN', detail: `Exact match on ${nin}`, weight: 0.6 })
      score += 0.6
    }

    const nameScore = similarity(fullName, `${other.firstName} ${other.lastName}`)
    if (nameScore >= 0.82) {
      reasons.push({
        field: 'Name',
        detail:
          nameScore === 1
            ? `Identical to “${other.firstName} ${other.lastName}”`
            : `${Math.round(nameScore * 100)}% similar to “${other.firstName} ${other.lastName}”`,
        weight: 0.25,
      })
      score += 0.25 * nameScore
    }

    if (phone && other.phone === phone) {
      reasons.push({ field: 'Mobile', detail: `Same number ${phone}`, weight: 0.2 })
      score += 0.2
    }

    if (email && other.email.toLowerCase() === email) {
      reasons.push({ field: 'Email', detail: `Same address ${email}`, weight: 0.2 })
      score += 0.2
    }

    if (candidate.dateOfBirth && other.dateOfBirth === candidate.dateOfBirth && reasons.length) {
      reasons.push({ field: 'Date of birth', detail: `Same date ${other.dateOfBirth}`, weight: 0.1 })
      score += 0.1
    }

    if (reasons.length && score >= threshold) {
      matches.push({ client: other, score: Math.min(1, score), confidence: confidenceFor(score), reasons })
    }
  }

  return matches.sort((a, b) => b.score - a.score)
}

export interface DuplicatePair {
  /** The record the system recommends keeping. */
  primary: Client
  /** The record the system recommends retiring into `primary`. */
  duplicate: Client
  score: number
  confidence: Confidence
  reasons: DuplicateReason[]
}

/**
 * Which of two matching records should survive a merge.
 *
 * Prefer the record with a verified identity, then the one captured directly
 * (rather than migrated from paper), then the more recent registration. Getting
 * this the wrong way round would retire the better record, so the recommended
 * direction is computed once here and reused by the banner and the merge
 * dialog. The officer can still override it.
 */
export function recommendSurvivor(a: Client, b: Client): { primary: Client; duplicate: Client } {
  const rank = (c: Client): number => {
    let r = 0
    if (c.seyIdVerified) r += 4
    if (c.registeredVia !== 'migrated') r += 2
    if (c.email) r += 1
    return r
  }
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra > rb ? { primary: a, duplicate: b } : { primary: b, duplicate: a }
  return a.registeredOn >= b.registeredOn
    ? { primary: a, duplicate: b }
    : { primary: b, duplicate: a }
}

/** Every pre-existing duplicate pair in the registry — powers the S02 banner. */
export function scanRegistryForDuplicates(clients: Client[]): DuplicatePair[] {
  const seen = new Set<string>()
  const out: DuplicatePair[] = []

  for (const c of clients) {
    if (c.status === 'merged') continue
    const matches = findClientDuplicates(
      { id: c.id, nin: c.nin, firstName: c.firstName, lastName: c.lastName, phone: c.phone, email: c.email, dateOfBirth: c.dateOfBirth },
      clients,
      { threshold: 0.6 },
    )
    for (const m of matches) {
      const key = [c.id, m.client.id].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      const { primary, duplicate } = recommendSurvivor(c, m.client)
      out.push({ primary, duplicate, score: m.score, confidence: m.confidence, reasons: m.reasons })
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

/* ------------------------------------------------------------------ *
 * Farms (iii.7)
 * ------------------------------------------------------------------ */

export interface FarmMatch {
  farm: Farm
  score: number
  confidence: Confidence
  reasons: DuplicateReason[]
  distanceM?: number
}

export interface FarmCandidate {
  id?: string
  clientId: string
  parcelRef: string
  lat: number
  lng: number
  name: string
}

/** Metres within which two holdings are treated as potentially the same. */
export const GPS_PROXIMITY_THRESHOLD_M = 150

export function findFarmDuplicates(
  candidate: FarmCandidate,
  farms: Farm[],
  { threshold = 0.35 }: { threshold?: number } = {},
): FarmMatch[] {
  const parcel = candidate.parcelRef.trim().toUpperCase()
  const matches: FarmMatch[] = []

  for (const other of farms) {
    if (other.id === candidate.id) continue

    const reasons: DuplicateReason[] = []
    let score = 0

    if (parcel && other.parcelRef.trim().toUpperCase() === parcel) {
      reasons.push({ field: 'Parcel', detail: `Same parcel reference ${other.parcelRef}`, weight: 0.5 })
      score += 0.5
    }

    const d = distanceMetres({ lat: candidate.lat, lng: candidate.lng }, { lat: other.lat, lng: other.lng })
    let distanceM: number | undefined
    if (d <= GPS_PROXIMITY_THRESHOLD_M) {
      distanceM = Math.round(d)
      const proximityWeight = 0.35 * (1 - d / GPS_PROXIMITY_THRESHOLD_M)
      reasons.push({
        field: 'GPS',
        detail: `Registered pin is ${distanceM} m away (threshold ${GPS_PROXIMITY_THRESHOLD_M} m)`,
        weight: 0.35,
      })
      score += Math.max(0.12, proximityWeight)
    }

    if (other.clientId === candidate.clientId) {
      reasons.push({ field: 'Owner', detail: 'Registered to the same client record', weight: 0.25 })
      score += 0.25
    }

    const nameScore = similarity(candidate.name, other.name)
    if (nameScore >= 0.8) {
      reasons.push({ field: 'Name', detail: `Holding name ${Math.round(nameScore * 100)}% similar to “${other.name}”`, weight: 0.1 })
      score += 0.1 * nameScore
    }

    if (reasons.length && score >= threshold) {
      matches.push({ farm: other, score: Math.min(1, score), confidence: confidenceFor(score), reasons, distanceM })
    }
  }

  return matches.sort((a, b) => b.score - a.score)
}
