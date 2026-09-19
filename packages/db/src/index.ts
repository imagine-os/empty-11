/**
 * `@paperos/db` — Drizzle schema-as-code and the adapters the pure packages publish through.
 *
 * Boot order in an app: import the modules that call `on()`, then `installOutboxDriver()`, then
 * `syncEventSubscriptions(db)`.
 */
export {
  drizzleOutboxDriver,
  installOutboxDriver,
  isDrizzleTransaction,
  uninstallOutboxDriver,
} from './outbox-driver.js';
export * from './schema/index.js';
export { syncEventSubscriptions } from './subscriptions.js';
