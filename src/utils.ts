export function fmtMs(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mi = ms % 1000;
  return (
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0") +
    ":" +
    String(mi).padStart(3, "0")
  );
}
