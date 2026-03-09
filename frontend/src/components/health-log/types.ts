export type FieldColor = "green" | "amber" | "red" | "blue" | "purple";

export interface DayEntry {
  fruitsVeg: string;
  fiber: string;
  totalCalories: string;
  upfCalories: string;
  redMeat: string;
  processedMeat: string;
  ssb: string;
  alcoholMl: string;
  alcoholAbv: string;
  bmi: string;
  waistCm: string;
  notes: string;
}

export interface WeeklyScore {
  components: Record<string, number | null>;
  total: number;
  maxPossible: number;
  risk: string;
  riskCol: string;
  daysLogged: number;
  avgFV: number | null;
  avgFiber: number | null;
  totalRed: number;
  totalProc: number;
  avgSSB: number | null;
  avgEth: number | null;
  latestBMI: number | null;
  latestWaist: number | null;
}