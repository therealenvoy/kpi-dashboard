import { useState } from "react";

export default function MonetizationPasswordPrompt({ error, onSubmit, onClose }) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(code.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 px-6 py-6 shadow-2xl"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Restricted section
        </p>
        <h2 className="mt-2 font-display text-lg text-white">Enter password</h2>
        <p className="mt-1 text-[12px] text-slate-400">
          A password is required to access Monetization data.
        </p>

        <input
          type="password"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Password"
          autoFocus
          className="mt-4 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-white/25"
        />

        {error ? (
          <p className="mt-2 text-[12px] text-rose-400">{error}</p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-400 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!code.trim() || submitting}
            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition-opacity disabled:opacity-40"
          >
            {submitting ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
