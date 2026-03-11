import SectionHeader from "./SectionHeader";

function extractExecutiveBullets(markdown) {
  return String(markdown || "")
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .slice(0, 8);
}

export default function ReportPanel({ report, onCopySummary, exportUrl }) {
  const bullets = extractExecutiveBullets(report?.markdown);

  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Report"
        title="Readable summary"
        description="A copy-ready version of the dashboard, rewritten as short bullets instead of raw metrics."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCopySummary}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Copy summary
            </button>
            <a
              href={exportUrl}
              className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-white/30 hover:text-white"
            >
              Export CSV
            </a>
          </div>
        }
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Quick read</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
            {bullets.length ? bullets.map((line) => <p key={line}>{line.replace(/^- /, "")}</p>) : <p>Generating report...</p>}
          </div>
        </div>
        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Full report</p>
          <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap text-sm leading-7 text-slate-400">
            {report?.markdown || "Generating report..."}
          </pre>
        </div>
      </div>
    </section>
  );
}
