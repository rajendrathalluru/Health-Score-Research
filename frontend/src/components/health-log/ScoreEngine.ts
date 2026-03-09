import type { DayEntry, WeeklyScore } from "./types";
import { safeAvg, safeSum, lastValid, ethanolGrams } from "./utils";

export function scoreWeight(
  bmi: number | null,
  waist: number | null,
  gender = "male"
): number | null {
  if (bmi === null && waist === null) return null;
  let s = 0, possible = 0;
  if (bmi !== null) {
    possible += 0.5;
    if (+bmi >= 18.5 && +bmi < 25) s += 0.5;
    else if (+bmi >= 25 && +bmi < 30) s += 0.25;
  }
  if (waist !== null) {
    possible += 0.5;
    const lo = gender === "female" ? 80 : 94;
    const hi = gender === "female" ? 88 : 102;
    if (+waist < lo) s += 0.5;
    else if (+waist <= hi) s += 0.25;
  }
  if (possible > 0 && possible < 1.0) s = s / possible;
  return +s.toFixed(2);
}

export function scorePlantFoods(
  avgFV: number | null,
  avgFiber: number | null
): number | null {
  if (avgFV === null && avgFiber === null) return null;
  let s = 0, possible = 0;
  if (avgFV !== null) {
    possible += 0.5;
    if (+avgFV >= 400) s += 0.5;
    else if (+avgFV >= 200) s += 0.25;
  }
  if (avgFiber !== null) {
    possible += 0.5;
    if (+avgFiber >= 30) s += 0.5;
    else if (+avgFiber >= 15) s += 0.25;
  }
  if (possible > 0 && possible < 1.0) s = s / possible;
  return +s.toFixed(2);
}

export function scoreUPF(entries: DayEntry[]): number | null {
  const percents = entries
    .map(e => {
      const t = +e.totalCalories, u = +e.upfCalories;
      return t > 0 && u >= 0 ? (u / t) * 100 : null;
    })
    .filter((x): x is number => x !== null && !isNaN(x));
  if (!percents.length) return null;
  const avg = percents.reduce((a, b) => a + b, 0) / percents.length;
  if (avg <= 20) return 1;
  if (avg <= 35) return 0.5;
  return 0;
}

export function scoreMeat(
  totalRedMeat: number,
  totalProcMeat: number
): number | null {
  if (totalRedMeat === 0 && totalProcMeat === 0) return null;
  if (totalRedMeat > 500) return 0;
  if (totalProcMeat >= 100) return 0;
  if (totalRedMeat <= 500 && totalProcMeat < 21) return 1;
  if (totalRedMeat <= 500 && totalProcMeat < 100) return 0.5;
  return 0;
}

export function scoreSSB(avgMl: number | null): number | null {
  if (avgMl === null) return null;
  if (+avgMl <= 0) return 1;
  if (+avgMl <= 250) return 0.5;
  return 0;
}

export function scoreAlcohol(
  avgEthanolG: number | null,
  gender = "male"
): number | null {
  if (avgEthanolG === null) return null;
  if (+avgEthanolG <= 0) return 1;
  return +avgEthanolG <= (gender === "female" ? 14 : 28) ? 0.5 : 0;
}

export function computeWeeklyScore(
  entries: Record<number, DayEntry>,
  savedCount: number,
  gender = "male"
): WeeklyScore {
  const all = Object.values(entries);

  const avgFV    = safeAvg(all.map(e => e.fruitsVeg));
  const avgFiber = safeAvg(all.map(e => e.fiber));
  const totalRed  = safeSum(all.map(e => e.redMeat));
  const totalProc = safeSum(all.map(e => e.processedMeat));
  const meatEntered = all.some(e => e.redMeat !== "" || e.processedMeat !== "");
  const avgSSB = safeAvg(all.map(e => e.ssb));
  const alcoholEntered = all.some(e => e.alcoholMl !== "");
  const avgEth = alcoholEntered
    ? safeAvg(all.map(e => e.alcoholMl !== "" ? ethanolGrams(e.alcoholMl, e.alcoholAbv) : null))
    : null;
  const latestBMI   = lastValid(all.map(e => e.bmi));
  const latestWaist = lastValid(all.map(e => e.waistCm));

  const components = {
    weight:     scoreWeight(latestBMI, latestWaist, gender),
    plantFoods: scorePlantFoods(avgFV, avgFiber),
    fastFood:   scoreUPF(all),
    meat:       meatEntered ? scoreMeat(totalRed, totalProc) : null,
    ssb:        scoreSSB(avgSSB),
    alcohol:    scoreAlcohol(avgEth, gender),
  };

  const scored      = Object.values(components).filter((v): v is number => v !== null);
  const total       = scored.reduce((a, b) => a + b, 0);
  const maxPossible = scored.length;
  const risk    = total >= maxPossible * 0.75 ? "Low Risk"
                : total >= maxPossible * 0.50 ? "Moderate Risk" : "High Risk";
  const riskCol = risk === "Low Risk" ? "text-green-600"
                : risk === "Moderate Risk" ? "text-amber-600" : "text-red-500";

  return {
    components, total: +total.toFixed(1), maxPossible,
    risk, riskCol, daysLogged: savedCount,
    avgFV, avgFiber, totalRed, totalProc,
    avgSSB, avgEth, latestBMI, latestWaist,
  };
}