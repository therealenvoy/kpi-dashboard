import { useState } from "react";

export default function CollapsibleAnalysisSection({
  title,
  description,
  defaultOpen = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-panel ${open ? "collapsible-panel-open" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {open ? "Open analysis" : "Optional analysis"}
          </p>
          <h3 className="font-display text-[1.35rem] leading-tight text-white">{title}</h3>
          {description ? <p className="max-w-2xl text-[12px] leading-6 text-slate-400">{description}</p> : null}
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-full border border-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">
          {open ? "Hide" : "Open"}
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </span>
      </button>

      {open ? <div className="mt-5 border-t border-white/6 pt-5">{children}</div> : null}
    </section>
  );
}
