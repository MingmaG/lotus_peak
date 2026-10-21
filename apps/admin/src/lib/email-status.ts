/**
 * What the Email screens say about a message's state.
 *
 * Here rather than in either screen because the list and the message's own
 * page must not describe the same status differently — "Sent" meaning two
 * things on two screens is worse than it meaning nothing on one.
 */

/** Colour per status. Amber is "nobody was told", red is "it did not arrive". */
export const STATUS_TONE: Record<string, string> = {
  FAILED: 'text-destructive',
  BOUNCED: 'text-destructive',
  COMPLAINED: 'text-destructive',
  /* Amber, not grey: nothing was attempted and nobody was told. */
  SKIPPED: 'text-status-attention',
  QUEUED: 'text-muted-foreground',
  PROCESSING: 'text-muted-foreground',
  SENT: 'text-status-published',
  DELIVERED: 'text-status-published',
  OPENED: 'text-status-published',
  CLICKED: 'text-status-published',
};

/**
 * What a status means, where the word alone does not carry it.
 *
 * "Sent" and "Delivered" look like synonyms and are not: the first is the
 * provider accepting the message, the second is it reaching a mailbox. The
 * distinction is the reason the webhook exists, so it is worth spelling out.
 */
export const STATUS_MEANING: Record<string, string> = {
  QUEUED: 'Written down. Nothing has been attempted — usually because the website has no sending key set.',
  PROCESSING: 'Handed to Resend, no answer yet. A message that stays here means the send did not finish.',
  SENT: 'Resend accepted it. That is not the same as it having arrived.',
  DELIVERED: 'Resend says it reached the mailbox.',
  OPENED: 'Opened by the recipient.',
  CLICKED: 'A link in it was followed.',
  BOUNCED: 'The mailbox refused it. The address is probably wrong.',
  COMPLAINED: 'Marked as spam by the recipient.',
  FAILED: 'The send itself failed. The reason is recorded with the message.',
  SKIPPED: 'Never attempted — the day’s sending allowance was already spent. Write to this person by hand.',
};

/**
 * Resend's own event names, in the office's words.
 *
 * Every event is kept, including the ones that move nothing, because "what
 * happened to this message" is a different question from "where did it end
 * up" — a delivery that was delayed twice before it arrived is worth seeing.
 * An unknown name is shown as it arrived rather than hidden: a provider adding
 * an event type should appear in the history, not vanish from it.
 */
export const EVENT_MEANING: Record<string, string> = {
  'email.sent': 'Resend accepted it.',
  'email.delivered': 'It reached the mailbox.',
  'email.delivery_delayed': 'The receiving server asked Resend to try again later.',
  'email.opened': 'Opened by the recipient.',
  'email.clicked': 'A link in it was followed.',
  'email.bounced': 'The mailbox refused it.',
  'email.complained': 'Marked as spam by the recipient.',
  'email.failed': 'Accepted and then abandoned. Nothing arrived.',
  'email.suppressed':
    'Never attempted: the address is on Resend’s suppression list, usually from an earlier bounce or complaint.',
  'email.scheduled': 'Scheduled by Resend for later.',
};
