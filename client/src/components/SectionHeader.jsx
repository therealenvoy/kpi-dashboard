export default function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="subtle-rule pl-10 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{eyebrow}</p>
        ) : null}
        <div className="space-y-1.5">
          <h2 className="font-display text-[1.8rem] leading-tight text-white md:text-[2.25rem]">{title}</h2>
          {description ? <p className="max-w-2xl text-[13px] leading-6 text-slate-300">{description}</p> : null}
        </div>
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
