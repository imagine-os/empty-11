// Fixture for the R3 integration test (PAP-305): an optional module reaching
// into another optional module's implementation. `pnpm lint:deps` must fail
// this with rule R3 and name growth as the owner to talk to.
import { deals } from '../../crm/src/index.ts';

export const invoicedDeals = deals.length;
