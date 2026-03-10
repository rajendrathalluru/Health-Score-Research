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
  const summaryText = percentage >= 75
    ? 'You are closely following most recommendations this week.'
    : percentage >= 50
      ? 'You are meeting some recommendations, with room to improve.'
      : 'This week is below target. Focus on one or two habits first.';
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
    <div className={`rounded-[22px] border border-stone-200 bg-gradient-to-br ${tone.fill} p-4 shadow-sm sm:p-6`}>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="min-w-0">
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
              <span className="text-xs text-stone-400">vs last saved week</span>
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

        <div className="rounded-[20px] border border-white/80 bg-white/75 px-4 py-4 backdrop-blur">
          <div className="flex items-center gap-4 sm:gap-5 lg:flex-col lg:items-center">
            <div className="relative h-20 w-20 flex-shrink-0 sm:h-24 sm:w-24">
            <svg viewBox="0 0 112 112" className="h-20 w-20 -rotate-90 transform sm:h-24 sm:w-24">
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
                <div className="text-lg font-semibold text-stone-950 sm:text-xl">{Math.round(percentage)}%</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-stone-400">Aligned</div>
              </div>
            </div>
          </div>
            <div className="min-w-0 flex-1 text-left lg:text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">This week</p>
              <p className="mt-1.5 text-sm leading-5 text-stone-600">
                {summaryText}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
