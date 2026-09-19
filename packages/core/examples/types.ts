/**
 * The PAP-302 demo. Run it from the repository root:
 *
 *     pnpm --filter @paperos/core example:types
 *
 * It prints a `Money` value as JSON and parses it back, splits $19.99 three
 * ways without losing a cent, signs a keyset cursor and shows a tampered
 * cursor being rejected. Under a minute, no database, no network.
 */

import {
  ANONYMOUS_ACTOR,
  add,
  allocate,
  type CursorSecrets,
  formatEntityKey,
  money,
  moneyJson,
  multiply,
  parseEntityKey,
  signCursor,
  toActorRef,
  toMajorUnits,
  uuidv7,
  verifyCursor,
} from '../src/types/index.js';

const show = (label: string, value: unknown): void => {
  console.log(`${label.padEnd(22)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);
};

console.log('\n— Money —');
const price = money(1999, 'USD');
show('price', moneyJson.encode(price));
show('major units', toMajorUnits(price));
show(
  'parsed back',
  moneyJson.decode({ amountMinor: '1999', currency: 'USD' }).amountMinor === 1999n,
);
show('+ 8.25% tax', moneyJson.encode(add(price, multiply(price, '0.0825'))));

const split = allocate(price, [1, 1, 1]);
show(
  'split three ways',
  split.map((part) => part.amountMinor.toString()),
);
show('sums back exactly', split.reduce((total, part) => total + part.amountMinor, 0n) === 1999n);

const huge = money(9007199254740993n, 'USD');
show(
  'past 2^53',
  moneyJson.decode(JSON.parse(JSON.stringify(moneyJson.encode(huge)))).amountMinor ===
    huge.amountMinor,
);

console.log('\n— Ids, actors and entities —');
const invoiceId = uuidv7();
show('uuidv7', invoiceId);
show(
  'sorts by time',
  [uuidv7(), uuidv7()].every((id, index, all) => index === 0 || id > (all[index - 1] as string)),
);
show('entity key', formatEntityKey({ type: 'invoice', id: invoiceId }));
show('parsed back', parseEntityKey(formatEntityKey({ type: 'invoice', id: invoiceId })).type);
show(
  'agent actor',
  toActorRef({ id: uuidv7(), type: 'agent', attributes: { character: 'forge' } }),
);
show('anonymous actor', ANONYMOUS_ACTOR);

console.log('\n— Signed cursors —');
const secrets: CursorSecrets = { current: 'demo-secret-do-not-use' };
const cursor = signCursor({ sort: ['2026-09-19T14:03:11.482Z', 1999], id: invoiceId }, secrets);
show('cursor', cursor);
show('verified', verifyCursor(cursor, secrets));

const tampered = `${cursor.slice(0, 4)}${cursor[4] === 'A' ? 'B' : 'A'}${cursor.slice(5)}`;
try {
  verifyCursor(tampered, secrets);
  console.log('tampered cursor accepted — this is a bug');
  process.exitCode = 1;
} catch (error) {
  show('tampered rejected', `${(error as Error).name}: ${(error as Error).message}`);
}
console.log('');
