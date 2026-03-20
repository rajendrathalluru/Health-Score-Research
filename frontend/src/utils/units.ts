const KG_TO_LB = 2.2046226218;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export function kgToLb(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number((Number(value) * KG_TO_LB).toFixed(1));
}

export function lbToKg(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number((Number(value) / KG_TO_LB).toFixed(1));
}

export function cmToFeetInches(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return { feet: null, inches: null };
  }

  const totalInches = Math.round(Number(value) / CM_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number) {
  const totalInches = feet * INCHES_PER_FOOT + inches;
  return Number((totalInches * CM_PER_INCH).toFixed(1));
}

export function formatFeetInches(value: number | null | undefined) {
  const { feet, inches } = cmToFeetInches(value);
  if (feet === null || inches === null) return null;
  return `${feet} ft ${inches} in`;
}

export function cmToInches(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number((Number(value) / CM_PER_INCH).toFixed(1));
}

export function inchesToCm(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return Number((Number(value) * CM_PER_INCH).toFixed(1));
}
