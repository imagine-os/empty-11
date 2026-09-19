/** Invoice, payment, subscription, payroll and ledger topics. Producers: PAP-177, PAP-180, PAP-179, PAP-184. */
import { z } from 'zod';
import { defineTopic } from '../registry.js';
import {
  amountMinor,
  at,
  changedFields,
  currency,
  errorCode,
  key,
  nullableUuid,
  on,
  reasonCode,
  uuid,
} from './_shared.js';

export const invoiceIssued = defineTopic(
  'invoice.issued',
  z.object({
    invoiceId: uuid,
    customerId: uuid,
    invoiceNumber: key,
    totalMinor: amountMinor,
    currency,
    dueOn: on,
  }),
  {
    description: 'An invoice was finalised and sent to the customer.',
    producer: 'PAP-177 billing',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications', 'PAP-222 webhooks'],
  },
);

export const invoicePaid = defineTopic(
  'invoice.paid',
  z.object({
    invoiceId: uuid,
    customerId: uuid,
    amountMinor,
    currency,
    paidAt: at,
    paymentId: nullableUuid,
  }),
  {
    description: 'An invoice was paid in full. The canonical cross-module example (PAP-28).',
    producer: 'PAP-177 billing',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications', 'PAP-195 segments', 'PAP-222 webhooks'],
  },
);

export const invoiceVoided = defineTopic(
  'invoice.voided',
  z.object({ invoiceId: uuid, customerId: uuid, voidedAt: at, reasonCode }),
  {
    description: 'An issued invoice was voided; the ledger posts a reversal.',
    producer: 'PAP-177 billing',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications'],
  },
);

export const paymentSucceeded = defineTopic(
  'payment.succeeded',
  z.object({
    paymentId: uuid,
    invoiceId: nullableUuid,
    amountMinor,
    currency,
    provider: key,
    providerRef: key,
  }),
  {
    description: 'A payment cleared at the provider.',
    producer: 'PAP-180 payments',
    consumers: ['PAP-179 ledger', 'PAP-177 billing', 'PAP-136 notifications'],
  },
);

export const paymentFailed = defineTopic(
  'payment.failed',
  z.object({
    paymentId: uuid,
    invoiceId: nullableUuid,
    amountMinor,
    currency,
    provider: key,
    errorCode,
  }),
  {
    description: 'A payment attempt was declined or errored at the provider.',
    producer: 'PAP-180 payments',
    consumers: ['PAP-136 notifications', 'PAP-195 segments'],
  },
);

export const paymentRefunded = defineTopic(
  'payment.refunded',
  z.object({ paymentId: uuid, refundId: uuid, amountMinor, currency, reasonCode }),
  {
    description: 'A payment was refunded in full or in part.',
    producer: 'PAP-180 payments',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications'],
  },
);

export const subscriptionUpdated = defineTopic(
  'subscription.updated',
  z.object({
    subscriptionId: uuid,
    customerId: uuid,
    planId: key,
    status: z.enum(['trialing', 'active', 'past_due', 'paused', 'canceled']),
    changedFields,
    currentPeriodEndsAt: at,
  }),
  {
    description: 'A subscription changed plan, status or period.',
    producer: 'PAP-177 billing',
    consumers: ['PAP-179 ledger', 'PAP-195 segments', 'PAP-136 notifications'],
  },
);

export const payrollRunApproved = defineTopic(
  'payroll.run.approved',
  z.object({
    runId: uuid,
    periodStartsOn: on,
    periodEndsOn: on,
    headcount: z.number().int().nonnegative(),
    grossMinor: amountMinor,
    currency,
  }),
  {
    description: 'A payroll run was approved and is queued for funding.',
    producer: 'PAP-184 payroll',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications'],
  },
);

export const payrollRunPaid = defineTopic(
  'payroll.run.paid',
  z.object({ runId: uuid, paidAt: at, netMinor: amountMinor, currency }),
  {
    description: 'A payroll run was funded and paid out.',
    producer: 'PAP-184 payroll',
    consumers: ['PAP-179 ledger', 'PAP-136 notifications'],
  },
);

export const ledgerEntryPosted = defineTopic(
  'ledger.entry.posted',
  z.object({
    entryId: uuid,
    transactionId: uuid,
    sourceType: key,
    sourceId: uuid,
    totalMinor: amountMinor,
    currency,
  }),
  {
    description: 'A balanced journal entry was posted; posted entries are immutable.',
    producer: 'PAP-179 ledger',
    consumers: ['PAP-179 ledger reports', 'PAP-222 webhooks'],
  },
);

export const ledgerEntryReversed = defineTopic(
  'ledger.entry.reversed',
  z.object({ entryId: uuid, reversalEntryId: uuid, reasonCode }),
  {
    description: 'A posted entry was reversed by a new entry; nothing is edited in place.',
    producer: 'PAP-179 ledger',
    consumers: ['PAP-179 ledger reports'],
  },
);

export const commerceTopics = {
  'invoice.issued': invoiceIssued,
  'invoice.paid': invoicePaid,
  'invoice.voided': invoiceVoided,
  'payment.succeeded': paymentSucceeded,
  'payment.failed': paymentFailed,
  'payment.refunded': paymentRefunded,
  'subscription.updated': subscriptionUpdated,
  'payroll.run.approved': payrollRunApproved,
  'payroll.run.paid': payrollRunPaid,
  'ledger.entry.posted': ledgerEntryPosted,
  'ledger.entry.reversed': ledgerEntryReversed,
} as const;
