import { useMemo, useState } from "react";
import SectionHeader from "./SectionHeader";

const MIN_VIEW_OPTIONS = [
  { value: "0", label: "Any views" },
  { value: "10000", label: "10k+ views" },
  { value: "50000", label: "50k+ views" },
  { value: "100000", label: "100k+ views" }
];

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-sky-300/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DashboardFilters({
  query,
  preset,
  boosted,
  surface,
  topCountry,
  engagementBand,
  workflowDecision,
  weekday,
  minViews,
  presets,
  countryOptions,
  resultCount,
  onQueryChange,
  onPresetChange,
  onBoostedChange,
  onSurfaceChange,
  onTopCountryChange,
  onEngagementBandChange,
  onWorkflowDecisionChange,
  onWeekdayChange,
  onMinViewsChange,
  onReset
}) {
  const [showMore, setShowMore] = useState(false);

  const hasAdvancedFilters = useMemo(
    () => topCountry || engagementBand !== "all" || boosted !== "all" || weekday !== "all",
    [boosted, engagementBand, topCountry, weekday]
  );

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Filters"
        title="Find the right reels fast"
        description="Start with search and a saved view. Open more filters only when the default slice is not enough."
        action={<p className="text-sm text-slate-400">{resultCount} matching reels</p>}
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_repeat(3,minmax(0,0.72fr))_auto]">
        <label className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Search</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Caption, reel ID, or Instagram URL"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 transition-colors focus:border-sky-300/60"
          />
        </label>

        <SelectField
          label="Preset"
          value={preset}
          onChange={onPresetChange}
          options={[
            { value: "", label: "All reels" },
            ...(presets || []).map((item) => ({ value: item.key, label: item.label }))
          ]}
        />

        <SelectField
          label="Decision"
          value={workflowDecision}
          onChange={onWorkflowDecisionChange}
          options={[
            { value: "all", label: "All decisions" },
            { value: "scale", label: "Scale" },
            { value: "watch", label: "Watch" },
            { value: "drop", label: "Drop" }
          ]}
        />

        <SelectField
          label="Surface"
          value={surface}
          onChange={onSurfaceChange}
          options={[
            { value: "all", label: "All placements" },
            { value: "feed", label: "In feed" },
            { value: "reels", label: "Reels only" }
          ]}
        />

        <SelectField label="View floor" value={minViews} onChange={onMinViewsChange} options={MIN_VIEW_OPTIONS} />

        <div className="flex items-end">
          <div className="flex w-full gap-2">
            <button
              type="button"
              onClick={() => setShowMore((current) => !current)}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                showMore || hasAdvancedFilters
                  ? "border-white/16 text-white"
                  : "border-white/10 text-slate-300 hover:border-white/30 hover:text-white"
              }`}
            >
              More filters
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {showMore || hasAdvancedFilters ? (
        <div className="mt-4 grid gap-4 border-t border-white/6 pt-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectField
            label="Boosting"
            value={boosted}
            onChange={onBoostedChange}
            options={[
              { value: "all", label: "All reels" },
              { value: "organic", label: "Organic only" },
              { value: "boosted", label: "Boosted only" }
            ]}
          />
          <SelectField
            label="Top country"
            value={topCountry}
            onChange={onTopCountryChange}
            options={[{ value: "", label: "All countries" }, ...countryOptions.map((code) => ({ value: code, label: code }))]}
          />
          <SelectField
            label="Engagement band"
            value={engagementBand}
            onChange={onEngagementBandChange}
            options={[
              { value: "all", label: "Any engagement" },
              { value: "high", label: "High (4%+)" },
              { value: "medium", label: "Medium (2-4%)" },
              { value: "low", label: "Low (<2%)" }
            ]}
          />
          <SelectField
            label="Posted weekday"
            value={weekday}
            onChange={onWeekdayChange}
            options={[
              { value: "all", label: "Any day" },
              { value: "mon", label: "Monday" },
              { value: "tue", label: "Tuesday" },
              { value: "wed", label: "Wednesday" },
              { value: "thu", label: "Thursday" },
              { value: "fri", label: "Friday" },
              { value: "sat", label: "Saturday" },
              { value: "sun", label: "Sunday" }
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}
