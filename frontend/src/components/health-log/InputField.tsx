import type { FieldColor } from "./types";
import { colorMap } from "./constants";

interface Props {
  label: string;
  unit: string;
  placeholder: string;
  hint: string;
  value: string | number;
  onChange: (v: string) => void;
  color: FieldColor;
}

export default function InputField({ label, unit, placeholder, hint, value, onChange, color }: Props) {
  const c = colorMap[color];
  const filled = value !== "" && value !== null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${c.badge} ${c.badgeBg}`}>
          {unit}
        </span>
      </div>
      <input
        type="number"
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2.5 text-sm rounded-lg border transition-all outline-none
          focus:ring-2 focus:ring-offset-0 ${c.ring}
          ${filled ? `${c.filled} ${c.filledBorder}` : "bg-white border-gray-200 focus:border-gray-300"}
          text-gray-900 placeholder-gray-400`}
      />
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}