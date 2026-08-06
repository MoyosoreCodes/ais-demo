/**
 * Notification composition (xiii.1–xiii.4, feeding S13).
 *
 * Templates live in the store, so the wording of a status update or a lab-result
 * alert is data rather than code. Email and SMS delivery is simulated — see
 * lib/sim.ts — and every record created here carries `simulated: true` so the
 * UI can label it.
 */

import { localId } from './format'
import type { AppNotification, Client, NotificationChannel, NotificationTemplate } from './types'

/** Replaces `{{token}}` placeholders; an unknown token is left visible. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match)
}

export interface ComposeInput {
  template: NotificationTemplate
  client: Client
  vars: Record<string, string>
  relatedType?: string
  relatedId?: string
  /** Defaults to now. */
  at?: string
}

export function composeNotification({
  template,
  client,
  vars,
  relatedType,
  relatedId,
  at,
}: ComposeInput): AppNotification {
  const address =
    template.channel === 'sms' ? client.phone : template.channel === 'email' ? client.email : 'In-app'

  const merged = { firstName: client.firstName, lastName: client.lastName, ...vars }

  return {
    id: localId('NTF'),
    channel: template.channel,
    templateId: template.id,
    event: template.event,
    recipientClientId: client.id,
    recipientAddress: address,
    subject: renderTemplate(template.subject, merged),
    body: renderTemplate(template.body, merged),
    sentOn: at ?? new Date().toISOString(),
    read: false,
    relatedType,
    relatedId,
    // In-app messages are genuinely delivered; SMS and email are staged.
    simulated: template.channel !== 'in-app',
  }
}

/** Templates registered for an event, optionally narrowed to some channels. */
export function templatesFor(
  templates: NotificationTemplate[],
  event: string,
  channels?: NotificationChannel[],
): NotificationTemplate[] {
  return templates.filter(
    (t) => t.event === event && (!channels || channels.includes(t.channel)),
  )
}

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  sms: 'SMS',
  email: 'Email',
  'in-app': 'In-app',
}
