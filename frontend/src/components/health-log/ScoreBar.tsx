interface Props {
  label: string;
  value: number | null | undefined;
}

export default function ScoreBar({ label, value }: Props) {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-xs text-gray-300 font-medium">Not logged</span>
      </div>
    );
  }
  const pct = value * 100;
  const barColor  = pct >= 75 ? "bg-green-500"  : pct >= 40 ? "bg-amber-400"  : "bg-red-400";
  const textColor = pct >= 75 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-500";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700 w-40 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${textColor}`}>{value}</span>
    </div>
  );
}