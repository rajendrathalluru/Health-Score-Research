interface MainScoreDisplayProps {
  currentScore: number;
  maxScore: number;
  trend: number;
  riskLevel?: string | null;
  weekLabel?: string;
}

export default function MainScoreDisplay({
  currentScore,
  maxScore,
  trend,
  riskLevel,
  weekLabel,
}: MainScoreDisplayProps) {
  const percentage = Math.max(0, Math.min(100, (currentScore / maxScore) * 100));
  const tone = percentage >= 75
    ? {
        stroke: '#2f6f4f',
        fill: 'from-emerald-50 via-white to-emerald-100',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      }
    : percentage >= 50
      ? {
          stroke: '#c4891c',
          fill: 'from-amber-50 via-white to-orange-100',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
        }
      : {
          stroke: '#b6462b',
          fill: 'from-rose-50 via-white to-orange-100',
          badge: 'bg-rose-100 text-rose-800 border-rose-200',
        };

  return (
    <div className={`rounded-[22px] border border-stone-200 bg-gradient-to-br ${tone.fill} p-5 shadow-sm sm:p-6`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-7 w-1.5 rounded-full bg-stone-900"></div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">WCRF/AICR Score</h2>
              <p className="mt-1 text-xs text-stone-500">{weekLabel || 'Current week snapshot'}</p>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <span className="text-4xl font-semibold tracking-tight text-stone-950 sm:text-5xl">{currentScore.toFixed(1)}</span>
              <span className="pb-1 text-lg font-light text-stone-400">/ {maxScore}</span>
              {riskLevel && (
                <span className={`mb-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                  {riskLevel} Risk
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)} points
              </span>
              <span className="text-xs text-stone-400">from last compare point</span>
            </div>
          </div>

          <div className="h-2.5 w-full rounded-full bg-white/80">
            <div
              className="h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, backgroundColor: tone.stroke }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-stone-400">
            <span>0</span>
            <span>{Math.round(percentage)}% aligned</span>
          </div>
        </div>

        <div className="flex flex-col items-center rounded-[20px] border border-white/80 bg-white/75 px-4 py-4 backdrop-blur">
          <div className="relative h-24 w-24 sm:h-28 sm:w-28">
            <svg className="h-24 w-24 -rotate-90 transform sm:h-28 sm:w-28">
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke="#e7e5e4"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="56"
                cy="56"
                r="46"
                stroke={tone.stroke}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 46}`}
                strokeDashoffset={`${2 * Math.PI * 46 * (1 - percentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-xl font-semibold text-stone-950 sm:text-2xl">{Math.round(percentage)}%</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-400">Aligned</div>
              </div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Week Read</p>
            <p className="mt-1.5 text-xs leading-5 text-stone-600">
              {percentage >= 75
                ? 'Strong week across the major recommendations.'
                : percentage >= 50
                  ? 'Solid base, but there are clear gains available.'
                  : 'Focus on a few consistent improvements this week.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
