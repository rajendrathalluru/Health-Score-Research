interface MainScoreDisplayProps {
  currentScore: number;
  maxScore: number;
  trend: number;
}

export default function MainScoreDisplay({ currentScore, maxScore, trend }: MainScoreDisplayProps) {
  const percentage = (currentScore / maxScore) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
            <div>
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">WCRF/AICR Score</h2>
              <p className="text-xs text-gray-400 mt-0.5">Updated today</p>
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-5xl font-semibold text-gray-900">{currentScore.toFixed(1)}</span>
              <span className="text-2xl text-gray-400 font-light">/ {maxScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)} points
              </span>
              <span className="text-sm text-gray-400">from yesterday</span>
            </div>
          </div>

          <div className="w-full bg-gray-100 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col items-center ml-12">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="#f3f4f6"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="#2563eb"
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 58}`}
                strokeDashoffset={`${2 * Math.PI * 58 * (1 - percentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-semibold text-gray-900">{Math.round(percentage)}%</div>
                <div className="text-xs text-gray-400 mt-0.5">Target</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
