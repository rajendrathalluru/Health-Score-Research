interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  change: string;
  changeType: 'positive' | 'neutral' | 'negative';
}

export default function StatCard({ label, value, subtitle, change, changeType }: StatCardProps) {
  const changeColors = {
    positive: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    neutral: 'text-stone-600 bg-stone-50 border-stone-200',
    negative: 'text-rose-700 bg-rose-50 border-rose-100'
  };

  return (
    <div className="rounded-[18px] border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex justify-between items-start gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">{label}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${changeColors[changeType]}`}>
          {change}
        </span>
      </div>
      <div className="mb-1 leading-none">
        <span className="text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">{value}</span>
      </div>
      <p className="text-xs leading-5 text-stone-500">{subtitle}</p>
    </div>
  );
}
