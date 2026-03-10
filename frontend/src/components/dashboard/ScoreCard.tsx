interface ScoreCardProps {
  title: string;
  score: number;
  maxScore: number;
  description: string;
  trend?: number;
}

export default function ScoreCard({ title, score, maxScore, description, trend }: ScoreCardProps) {
  const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));
  
  const getProgressColor = () => {
    if (percentage === 100) return 'bg-emerald-600';
    if (percentage >= 50) return 'bg-amber-500';
    return 'bg-stone-300';
  };

  return (
    <div className="rounded-[18px] border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2.5 flex justify-between items-start gap-2">
        <h3 className="pr-3 text-sm font-semibold text-stone-900">{title}</h3>
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold ${trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}
          </span>
        )}
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xl font-semibold tracking-tight text-stone-950">{score.toFixed(1)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">of {maxScore}</span>
      </div>

      <div className="mb-2.5 h-2 w-full rounded-full bg-stone-100">
        <div
          className={`h-2 rounded-full transition-all ${getProgressColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="text-[11px] leading-5 text-stone-500">{description}</p>
    </div>
  );
}
