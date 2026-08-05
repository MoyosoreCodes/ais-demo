// Simulated integrations. Everything here stands in for an external system the
// real product would call (SeyID, SMS gateway, email, device camera/GPS). The UI
// must always label these as "simulated".
import { nowIso } from './format';
import { uid } from './ids';
import type { AppNotification, DocRef, NotificationChannel } from './types';

// Fixed OTP so the demo is reproducible (SeyID / 2FA modal).
export const DEMO_OTP = '824193';

export interface NotificationInput {
  channel: NotificationChannel;
  to: string;
  clientId?: string;
  subject: string;
  body: string;
  template: string;
  event: string;
}

export function makeNotification(input: NotificationInput): AppNotification {
  return {
    id: uid('NT'),
    status: 'sent',
    simulated: true,
    createdAt: nowIso(),
    ...input,
  };
}

// A simulated document/photo upload (no real file leaves the browser).
export function makeSimDoc(name: string, category: string): DocRef {
  return {
    id: uid('DOC'),
    name,
    category,
    uploadedAt: nowIso(),
    verified: false,
    sizeKb: Math.round(120 + Math.random() * 1800),
    simulated: true,
  };
}

// A GPS reading near a district centre, standing in for the device geolocation API.
export function simulateGps(base: [number, number]): [number, number] {
  return [
    +(base[0] + (Math.random() - 0.5) * 0.004).toFixed(5),
    +(base[1] + (Math.random() - 0.5) * 0.004).toFixed(5),
  ];
}
