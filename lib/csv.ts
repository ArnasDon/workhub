/** RFC 4180 CSV: quotes fields containing commas, quotes or newlines; UTF-8 BOM so Excel opens it correctly. */
export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(cell).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
