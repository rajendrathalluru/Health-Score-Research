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
    if (percentage === 100) return 'bg-green-600';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-medium text-gray-900 text-sm">{title}</h3>
        {trend !== undefined && (
          <span className={`text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}
          </span>
        )}
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${getProgressColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
