export default function KpiCard({ label, value, accent, helper }) {
  return (
    <div className="panel px-5 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-4 space-y-3">
        <p className="font-display text-[2.4rem] leading-[0.92] text-white md:text-[2.75rem]">{value}</p>
        {helper ? <p className="max-w-[18rem] text-[12px] leading-5 text-slate-400">{helper}</p> : null}
      </div>
    </div>
  );
}
