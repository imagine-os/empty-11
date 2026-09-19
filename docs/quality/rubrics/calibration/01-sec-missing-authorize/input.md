# Case 01: new oRPC procedure without authorize()

PR adds `packages/finance/src/router/invoices.ts`:

```ts
export const voidInvoice = procedure
  .input(z.object({ invoiceId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    return withTenant(ctx, (db) => db.update(invoices).set({ status: 'void' }).where(eq(invoices.id, input.invoiceId)));
  });
```

The spec's Access section says `finance.write`. Every other procedure in the file calls `.use(authorize('finance.write'))`. Gate 1 is green; Semgrep did not run on this file because the rule set (PAP-80) is not merged.
