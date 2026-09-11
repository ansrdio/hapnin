"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-[#1B0A2A] px-5 py-2.5 font-display font-semibold text-white hover:bg-[#2C1342]"
    >
      Print / Save as PDF
    </button>
  );
}
