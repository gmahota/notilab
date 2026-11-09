/**
 * lib/log-safe.ts — Making a caller-supplied string safe to put in a log line.
 *
 * Tool names, JSON-RPC method names and event names all arrive from the network
 * and all end up in a server log. Interpolated raw, two things go wrong. A value
 * carrying CR/LF forges extra log lines, so an attacker writes whatever a log
 * reader — or an alerting rule — will believe. A value carrying `%s` is read by
 * `console.*` as a format directive and pulls the next argument, usually the
 * error object, into a position the author never intended.
 *
 * Everything NotiLab logs through here is an identifier, so the rule is a
 * whitelist rather than a blacklist: anything outside the identifier alphabet
 * becomes `?`, and the result is capped so one request cannot flood the log.
 */

const UNSAFE_IN_LOG = /[^A-Za-z0-9._:/@-]/g

/** Long enough for any real tool or method name, short enough to be harmless. */
const MAX_TOKEN_LENGTH = 120

export function safeLogToken(value: unknown, maxLength: number = MAX_TOKEN_LENGTH): string {
  const text = typeof value === "string" ? value : String(value ?? "")
  const cleaned = text.replace(UNSAFE_IN_LOG, "?")
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength)}...` : cleaned
}
