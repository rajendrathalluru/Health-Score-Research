import { type DayEntry, type FieldColor } from "./types";

// ─── Week dates ──────────────────────────────────────────────────────────────
function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const diff = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export const WEEK_MONDAY = getMondayOfCurrentWeek();
export const WEEK_DATES  = getWeekDates(WEEK_MONDAY);
export const TODAY       = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
export const TODAY_IDX   = WEEK_DATES.findIndex(d => d.toDateString() === TODAY.toDateString());
export const DAYS_SHORT  = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
export const DAYS_FULL   = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Empty entry factory ─────────────────────────────────────────────────────
export const emptyEntry = (): DayEntry => ({
  fruitsVeg: "", fiber: "",
  totalCalories: "", upfCalories: "",
  redMeat: "", processedMeat: "",
  ssb: "", alcoholMl: "", alcoholAbv: "",
  bmi: "", waistCm: "",
  notes: "",
});

// ─── Color map ────────────────────────────────────────────────────────────────
export const colorMap: Record<FieldColor, {
  ring: string;
  badge: string;
  badgeBg: string;
  filled: string;
  filledBorder: string;
}> = {
  green:  { ring: "focus:ring-green-500",  badge: "text-green-700",  badgeBg: "bg-green-50 border-green-200",   filled: "bg-green-50",  filledBorder: "border-green-300"  },
  amber:  { ring: "focus:ring-amber-500",  badge: "text-amber-700",  badgeBg: "bg-amber-50 border-amber-200",   filled: "bg-amber-50",  filledBorder: "border-amber-300"  },
  red:    { ring: "focus:ring-red-500",    badge: "text-red-700",    badgeBg: "bg-red-50 border-red-200",       filled: "bg-red-50",    filledBorder: "border-red-300"    },
  blue:   { ring: "focus:ring-blue-500",   badge: "text-blue-700",   badgeBg: "bg-blue-50 border-blue-200",    filled: "bg-blue-50",   filledBorder: "border-blue-300"   },
  purple: { ring: "focus:ring-purple-500", badge: "text-purple-700", badgeBg: "bg-purple-50 border-purple-200", filled: "bg-purple-50", filledBorder: "border-purple-300" },
};