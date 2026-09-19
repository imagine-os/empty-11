/**
 * Which shell PaperOS code is running under. Every other piece of the config
 * layer (which `SecretStore` to hand out, which env source to read) branches
 * on this, so it is the one thing in this folder with zero dependencies.
 */
export type Target = 'web' | 'desktop' | 'ios' | 'android';

/**
 * The globals `getTarget()` reads. Real callers pass nothing and it reads
 * `globalThis`; tests pass a fake scope so the four branches are exercised
 * without a real browser, Tauri runtime or device (DoD test plan: "getTarget()
 * under four fake globals").
 */
export interface TargetScope {
  window?: { __TAURI_INTERNALS__?: unknown } | undefined;
  navigator?: { userAgent: string } | undefined;
}

const IOS_UA = /iPad|iPhone|iPod/i;
const ANDROID_UA = /Android/i;

/**
 * `web` | `desktop` | `ios` | `android`, in that detection order:
 *
 * 1. No `window.__TAURI_INTERNALS__` at all → plain browser → `web`, regardless
 *    of user agent (a phone's mobile browser is still the web target; it has
 *    no OS keychain to reach).
 * 2. `__TAURI_INTERNALS__` present → a Tauri shell. Tauri Mobile injects the
 *    same global on iOS and Android, so the user agent is what tells them
 *    apart from Tauri Desktop.
 */
export function getTarget(scope: TargetScope = globalThis as unknown as TargetScope): Target {
  const hasTauri = scope.window?.__TAURI_INTERNALS__ !== undefined;
  if (!hasTauri) return 'web';

  const userAgent = scope.navigator?.userAgent ?? '';
  if (IOS_UA.test(userAgent)) return 'ios';
  if (ANDROID_UA.test(userAgent)) return 'android';
  return 'desktop';
}
