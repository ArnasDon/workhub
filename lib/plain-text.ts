/** Collapse Markdown to one line of plain text for card previews and search snippets. */
export function plainText(md: string, max = 280): string {
  const s = md
    .replace(/```[\s\S]*?```/g, " ")           // fenced code
    .replace(/`([^`]*)`/g, "$1")               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // links → label
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, "") // task lists (before plain bullets)
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "") // headings, quotes, bullets
    .replace(/(\*\*|__|\*|_|~~)/g, "")         // emphasis
    .replace(/\s*\n+\s*/g, " · ")              // line breaks → separator
    .replace(/\s{2,}/g, " ")
    .replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, "") // no dangling separators
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
