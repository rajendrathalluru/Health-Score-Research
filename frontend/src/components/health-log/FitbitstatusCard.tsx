export default function FitbitStatusCard() {
  return (
    <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Activity synced from Fitbit</p>
        <p className="text-xs text-gray-400 mt-0.5">Steps, MVPA and weight are tracked automatically</p>
      </div>
      <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
    </div>
  );
}