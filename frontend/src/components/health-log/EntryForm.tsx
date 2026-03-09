import type { DayEntry } from "./types";
import { ethanolGrams } from "./utils";
import InputField from "./InputField";
import SectionCard from "./SectionCard";

interface Props {
  entry: DayEntry;
  update: (k: keyof DayEntry, v: string) => void;
}

export default function EntryForm({ entry, update }: Props) {
  return (
    <div className="space-y-4">

      {/* Plant Foods */}
      <SectionCard title="Plant Foods" label="Daily intake" color="green">
        <InputField
          label="Fruits & Vegetables" unit="grams" placeholder="350"
          hint="Goal: 400g+ per day — fresh, frozen and cooked all count"
          value={entry.fruitsVeg} onChange={v => update("fruitsVeg", v)} color="green"
        />
        <InputField
          label="Dietary Fiber" unit="grams" placeholder="25"
          hint="Goal: 30g+ per day — wholegrains, legumes, vegetables"
          value={entry.fiber} onChange={v => update("fiber", v)} color="green"
        />
      </SectionCard>

      {/* Processed Food */}
      <SectionCard
        title="Processed Food" label="Calorie breakdown" color="amber"
        aside={
          entry.totalCalories && entry.upfCalories && +entry.totalCalories > 0 ? (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
              {Math.min(100, Math.round((+entry.upfCalories / +entry.totalCalories) * 100))}% UPF
            </span>
          ) : undefined
        }
      >
        <InputField
          label="Total Calories" unit="kcal" placeholder="2000"
          hint="Estimated total intake for the day"
          value={entry.totalCalories} onChange={v => update("totalCalories", v)} color="amber"
        />
        <InputField
          label="Ultra-Processed Calories" unit="kcal" placeholder="500"
          hint="Snacks, ready meals, fast food, packaged items"
          value={entry.upfCalories} onChange={v => update("upfCalories", v)} color="amber"
        />
      </SectionCard>

      {/* Meat */}
      <SectionCard title="Red and Processed Meat" label="Weekly totals" color="red">
        <InputField
          label="Red Meat" unit="grams" placeholder="100"
          hint="Beef, lamb, pork, veal — goal: under 500g for the week"
          value={entry.redMeat} onChange={v => update("redMeat", v)} color="red"
        />
        <InputField
          label="Processed Meat" unit="grams" placeholder="20"
          hint="Bacon, ham, sausage, salami — goal: under 21g for the week"
          value={entry.processedMeat} onChange={v => update("processedMeat", v)} color="red"
        />
      </SectionCard>

      {/* Drinks */}
      <SectionCard
        title="Drinks" label="Daily intake in ml" color="blue"
        aside={
          entry.alcoholMl && entry.alcoholAbv && +entry.alcoholMl > 0 ? (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-1 rounded-md">
              {ethanolGrams(entry.alcoholMl, entry.alcoholAbv).toFixed(1)}g ethanol
            </span>
          ) : undefined
        }
      >
        <InputField
          label="Sugar-Sweetened Beverages" unit="ml" placeholder="330"
          hint="Soda, juice, energy drinks, sweet tea — goal: 0ml"
          value={entry.ssb} onChange={v => update("ssb", v)} color="blue"
        />
        <InputField
          label="Alcoholic Drink Volume" unit="ml" placeholder="330"
          hint="Total volume consumed today"
          value={entry.alcoholMl} onChange={v => update("alcoholMl", v)} color="blue"
        />
        <InputField
          label="Alcohol Strength (ABV)" unit="%" placeholder="5"
          hint="Beer ~5%  ·  Wine ~12%  ·  Spirits ~40%"
          value={entry.alcoholAbv} onChange={v => update("alcoholAbv", v)} color="blue"
        />
      </SectionCard>

      {/* Body Measurements */}
      <SectionCard
        title="Body Measurements" label="Optional — synced from Fitbit where available"
        color="purple" optional
        aside={
          entry.bmi && +entry.bmi > 0 ? (
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-1 rounded-md">
              {+entry.bmi < 18.5 ? "Underweight" : +entry.bmi < 25 ? "Healthy" : +entry.bmi < 30 ? "Overweight" : "Obese"}
            </span>
          ) : undefined
        }
      >
        <InputField
          label="BMI" unit="kg/m²" placeholder="22.5"
          hint="Body Mass Index — auto-pulled from Fitbit if linked"
          value={entry.bmi} onChange={v => update("bmi", v)} color="purple"
        />
        <InputField
          label="Waist Circumference" unit="cm" placeholder="85"
          hint="Measure at navel level after exhaling"
          value={entry.waistCm} onChange={v => update("waistCm", v)} color="purple"
        />
      </SectionCard>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Notes</h3>
        <p className="text-xs text-gray-400 mb-3">Optional</p>
        <textarea
          placeholder="e.g. Skipped lunch, ate out, not feeling well..."
          value={entry.notes}
          onChange={e => update("notes", e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-300 resize-none transition-all"
        />
      </div>

    </div>
  );
}