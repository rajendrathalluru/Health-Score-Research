export function safeAvg(arr: (string | number | null | undefined)[]): number | null {
  const valid = arr
    .filter(x => x !== "" && x !== null && x !== undefined && !isNaN(+x!))
    .map(Number);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

export function safeSum(arr: (string | number | null)[]): number {
  return arr
    .filter(x => x !== "" && x !== null && !isNaN(+x!))
    .map(Number)
    .reduce((a, b) => a + b, 0);
}

export function lastValid(arr: (string | number | null | undefined)[]): number | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i];
    if (v !== "" && v !== null && v !== undefined && !isNaN(+v!) && +v! > 0) return +v!;
  }
  return null;
}

export const ethanolGrams = (
  ml: string | number | null | undefined,
  abv: string | number | null | undefined
): number => (+(ml ?? 0) || 0) * ((+(abv ?? 0) || 0) / 100) * 0.789;