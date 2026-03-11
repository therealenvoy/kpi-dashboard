export default function PresetBar({ presets, activePreset, onChange }) {
  return (
    <section className="panel p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-500">Saved views</p>
          <p className="mt-1 text-sm text-slate-300">Use presets to jump straight to the decision slice you want.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange("")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              !activePreset ? "accent-glow bg-sky-300 text-slate-950" : "border border-white/10 text-slate-300 hover:text-white"
            }`}
          >
            All reels
          </button>
          {presets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(preset.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activePreset === preset.key
                  ? "accent-glow bg-sky-300 text-slate-950"
                  : "border border-white/10 text-slate-300 hover:text-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

