/** Render a server timestamp (ISO 8601, UTC) in the device's locale, or the raw text if unparsable. */
export function formatTimestamp(iso: string): string {
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? iso : time.toLocaleString();
}
