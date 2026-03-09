import { WEEK_DATES, TODAY_IDX, DAYS_FULL } from "./constants";

interface Props {
  selectedDay: number;
  saved: Record<number, boolean>;
}

export default function DaySummaryCard({ selectedDay, saved }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between">
      <div>
        <p className="text-base font-bold text-gray-900">{DAYS_FULL[selectedDay]}</p>
        <p className="text-xs text-gray-400">
          {WEEK_DATES[selectedDay].toLocaleDateString("en-US", { month: "long", day: "numeric" })}
        </p>
      </div>
      <div className="flex gap-2">
        {selectedDay === TODAY_IDX && (
          <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2.5 py-1 rounded-md font-semibold">
            Today
          </span>
        )}
        {saved[selectedDay] && (
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-md font-semibold">
            Saved
          </span>
        )}
      </div>
    </div>
  );
}