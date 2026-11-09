/**
 * Host half of dsh-balance-chip.
 *
 * The plugin is client-only: this module exists so the host loader can mount a
 * row for the package, which is what makes dsh-client-modules discover and
 * serve lib/client.js. Deliberately no server-side work happens here.
 */

export const name = 'dsh-balance-chip'

export function apply() {
  // Intentionally empty. The balance is read by the browser half through the
  // existing account Remote namespace, so no host route or service is needed.
}
