interface StatCardProps {
  label: string;
  value: string;
  subtitle: string;
  change: string;
  changeType: 'positive' | 'neutral' | 'negative';
}

export default function StatCard({ label, value, subtitle, change, changeType }: StatCardProps) {
  const changeColors = {
    positive: 'text-green-600 bg-green-50',
    neutral: 'text-gray-600 bg-gray-50',
    negative: 'text-red-600 bg-red-50'
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className={`text-xs font-medium px-2 py-1 rounded ${changeColors[changeType]}`}>
          {change}
        </span>
      </div>
      <div className="mb-1">
        <span className="text-3xl font-semibold text-gray-900">{value}</span>
      </div>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}
