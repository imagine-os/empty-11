# Case 08: declared event never emitted

Spec `specs/finance/invoice-send.md` declares Events: `invoice.sent v1 { invoiceId, sentAt, channel }`. PR implements `sendInvoice` in `packages/finance/src/service/send.ts`: it updates the row, calls the email service, and returns. `defineTopic('invoice.sent')` exists in `@paperos/contract-finance`. No `emit` call in the diff; the automations module (PAP-171) listens for this topic.
