import type { WeeklyScore } from "./types";
import ScoreBar from "./ScoreBar";

interface Props {
  score: WeeklyScore;
  onClose: () => void;
}

export default function ScoreModal({ score, onClose }: Props) {
  const labels: Record<string, string> = {
    weight_score: 'Healthy Weight',
    activity_score: 'Physical Activity',
    plant_based_score: 'Plant-Based Foods',
    fast_processed_score: 'Fast/Processed Foods',
    red_processed_meat_score: 'Red & Processed Meat',
    sugary_drinks_score: 'Sugary Drinks',
    alcohol_score: 'Alcohol',
    q29: 'Fruit & Vegetables',
    q30: 'Beans/Pulses',
    q31: 'Whole Grains',
    q32: 'Fast/Processed Foods',
    q33: 'Sweets & Pastries',
    q34: 'Red Meat',
    q35: 'Processed Meat',
    q36: 'Sugary Drinks',
    q37: 'Alcohol',
    weight: 'Healthy Weight',
    plantFoods: 'Plant Foods',
    fastFood: 'Processed Food',
    meat: 'Red and Processed Meat',
    ssb: 'Sugar Drinks',
    alcohol: 'Alcohol',
  };

  const componentEntries = Object.entries(score.components);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Weekly Score</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-black ${score.riskCol}`}>{score.total}</span>
                <span className="text-sm text-gray-400">/ {score.maxPossible}</span>
              </div>
            </div>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-lg
              ${score.risk === "Low Risk"      ? "bg-green-50 text-green-700 border border-green-200"
              : score.risk === "Moderate Risk" ? "bg-amber-50 text-amber-700 border border-amber-200"
              :                                  "bg-red-50 text-red-600 border border-red-200"}`}>
              {score.risk}
            </span>
          </div>
        </div>

        {/* Breakdown */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Score Breakdown</p>
          {componentEntries.map(([key, value]) => (
            <ScoreBar key={key} label={labels[key] ?? key} value={value} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 space-y-3">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
            <span className="text-sm text-gray-600">Questions answered</span>
            <span className="text-sm font-bold text-gray-900">{score.daysLogged} / {Object.keys(score.components).length}</span>
          </div>
          {score.daysLogged < Object.keys(score.components).length && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              Score is based on {score.daysLogged} answered questions.
            </p>
          )}
          {Object.values(score.components).some(v => v === null) && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2.5">
              Components showing "Not logged" are excluded from the total.
            </p>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
