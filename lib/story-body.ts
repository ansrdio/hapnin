// Story body text → blocks. Deliberately tiny instead of a rich-text editor
// or markdown library: paragraphs are separated by a blank line, and a
// paragraph starting with "## " is a section heading. Nothing else is
// interpreted, so pasted text can never inject markup. Pure, client-safe.

export type StoryBlock = { kind: "heading"; text: string } | { kind: "paragraph"; text: string };

export function parseStoryBody(raw: string | null | undefined): StoryBlock[] {
  const text = (raw ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const blocks: StoryBlock[] = [];
  for (const chunk of text.split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd());
    const first = lines[0]?.trim() ?? "";
    if (first.startsWith("## ")) {
      const heading = first.slice(3).trim();
      if (heading) blocks.push({ kind: "heading", text: heading });
      const rest = lines.slice(1).join("\n").trim();
      if (rest) blocks.push({ kind: "paragraph", text: rest });
    } else {
      const para = lines.join("\n").trim();
      if (para) blocks.push({ kind: "paragraph", text: para });
    }
  }
  return blocks;
}
