import { sourceIndex } from "../sources";

/** Inline footnote marker, e.g. <Ref k="mpi" />, linking to the references block. */
export function Ref({ k }: { k: string }) {
  const entry = sourceIndex[k];
  if (!entry) return null;
  return (
    <sup className="ml-0.5">
      <a
        id={`ref-${entry.n}`}
        href={`#note-${entry.n}`}
        className="font-body text-[0.7em] font-medium text-gold no-underline hover:underline"
        aria-label={`Footnote ${entry.n}`}
      >
        {entry.n}
      </a>
    </sup>
  );
}
