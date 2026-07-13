"use client";

import { useState } from "react";

export default function ReasonsCell({ reasons }: { reasons: string[] }) {
  const [open, setOpen] = useState(false);

  if (!reasons || reasons.length === 0) {
    return <span className="text-slate-400">&mdash;</span>;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        aria-expanded={open}
        title={reasons.join("; ")}
      >
        {reasons.length} reason{reasons.length > 1 ? "s" : ""}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
          <ul className="list-disc space-y-1 pl-4">
            {reasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
