import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactNumber, formatFullNumber } from "../lib/formatters";
import SectionHeader from "./SectionHeader";

const BAR_COLORS = ["#e7ecf6", "#c8d2e5", "#9cb0d3", "#7b95c4", "#5875af"];

export default function CountryBreakdown({ countries }) {
  return (
    <section className="panel p-6">
      <SectionHeader
        eyebrow="Audience"
        title="Top follower countries"
        description="The five strongest audience markets from the account overview tab."
      />
      <div className="mt-6 space-y-5">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={countries} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="code"
                tick={{ fill: "#dbe7f8", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(value) => formatFullNumber(value)}
                contentStyle={{
                  backgroundColor: "#101522",
                  borderColor: "rgba(255,255,255,0.12)",
                  borderRadius: "16px"
                }}
              />
              <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                {countries.map((country, index) => (
                  <Cell key={country.code} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {countries.map((country, index) => (
            <div
              key={country.code}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-slate-950"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                >
                  {country.code}
                </span>
                <div>
                  <p className="font-semibold text-white">{country.code}</p>
                  <p className="text-xs text-slate-400">Follower concentration</p>
                </div>
              </div>
              <p className="font-display text-lg text-white">{formatCompactNumber(country.count)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
