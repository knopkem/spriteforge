// Run-length encoding for cel arrays. Cels are number[] of small integers
// (-1 and palette indices); RLE keeps project files compact while remaining
// perfectly lossless on round-trip.

export function rleEncode(values: number[]): string {
  const parts: string[] = [];
  let i = 0;
  const n = values.length;
  while (i < n) {
    const v = values[i];
    let run = 1;
    while (i + run < n && values[i + run] === v) run++;
    parts.push(`${v}:${run}`);
    i += run;
  }
  return parts.join(',');
}

export function rleDecode(text: string, length: number): number[] {
  const out = new Array<number>(length);
  let pos = 0;
  if (text === '') {
    if (length !== 0) throw new Error('Empty RLE but length > 0');
    return out;
  }
  for (const part of text.split(',')) {
    const [vStr, cStr] = part.split(':');
    const v = Number(vStr);
    const c = Number(cStr);
    if (!Number.isInteger(v) || !Number.isInteger(c) || c <= 0) {
      throw new Error(`Bad RLE segment: ${part}`);
    }
    for (let k = 0; k < c; k++) out[pos++] = v;
  }
  if (pos !== length) throw new Error(`RLE length mismatch: got ${pos}, expected ${length}`);
  return out;
}
