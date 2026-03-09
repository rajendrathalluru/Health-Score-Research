import { WEEK_DATES, TODAY, TODAY_IDX, DAYS_SHORT } from "./constants";

interface Props {
  selectedDay: number;
  saved: Record<number, boolean>;
  daysLogged: number;
  onSelectDay: (i: number) => void;
}

export default function WeekCalendar({ selectedDay, saved, daysLogged, onSelectDay }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">This Week</span>
        <span className="text-xs font-semibold text-green-600">{Math.round((daysLogged / 7) * 100)}% done</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${(daysLogged / 7) * 100}%` }}
        />
      </div>

      {/* Day pills */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {WEEK_DATES.map((date, i) => {
          const isToday    = i === TODAY_IDX;
          const isFuture   = date > TODAY;
          const isSelected = i === selectedDay;
          const isSaved    = saved[i];
          return (
            <button
              key={i}
              onClick={() => !isFuture && onSelectDay(i)}
              disabled={isFuture}
              title={isFuture ? "Future dates are locked" : undefined}
              className={`
                flex flex-col items-center py-2 rounded-lg transition-all text-center
                ${isFuture ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                ${isSelected
                  ? "bg-gray-900 text-white shadow-sm"
                  : isToday && !isSaved
                  ? "bg-green-50 ring-1 ring-green-400"
                  : isSaved
                  ? "bg-green-50 ring-1 ring-green-200"
                  : "hover:bg-gray-50"}
              `}
            >
              <span className={`text-[9px] font-bold tracking-wide ${isSelected ? "text-gray-300" : "text-gray-400"}`}>
                {DAYS_SHORT[i]}
              </span>
              <span className={`text-sm font-bold mt-0.5 ${isSelected ? "text-white" : isToday ? "text-green-700" : "text-gray-800"}`}>
                {date.getDate()}
              </span>
              <div className={`w-1 h-1 rounded-full mt-0.5 ${isSaved ? (isSelected ? "bg-green-400" : "bg-green-500") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
        Entries are locked to the current week only. Score refreshes every Monday.
      </p>
    </div>
  );
}
