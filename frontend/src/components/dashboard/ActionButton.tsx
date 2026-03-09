interface ActionButtonProps {
  title: string;
  subtitle: string;
  color: 'blue' | 'green';
  onClick: () => void;
}

export default function ActionButton({ title, subtitle, color, onClick }: ActionButtonProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
  };

  return (
    <button
      onClick={onClick}
      className={`bg-gradient-to-r ${colorClasses[color]} text-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-between group w-full text-left`}
    >
      <div>
        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-sm opacity-90">{subtitle}</p>
      </div>
      <span className="text-2xl group-hover:translate-x-2 transition-transform">→</span>
    </button>
  );
}
