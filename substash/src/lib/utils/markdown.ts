function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Editor bodies start with a tag only if a block element was typed first; testing that alone double-escapes the rest
export function isHtmlBody(body: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(body) || /&(?:[a-z]+|#\d+);/i.test(body);
}

export function renderMarkdown(raw: string): string {
  // Escape HTML first so no injected tags survive
  let s = escapeHtml(raw.trim());

  // Fenced code blocks (``` or ~~~)
  s = s.replace(
    /```([\s\S]*?)```/g,
    (_, code) => `<pre><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Bold **text** or __text__
  s = s.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/gs, "<strong>$1</strong>");

  // Italic *text* or _text_ (not inside words)
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "<em>$1</em>");
  s = s.replace(/(?<![\w_])_([^_\n]+)_(?![\w_])/g, "<em>$1</em>");

  // Blockquote lines (> text, already HTML-escaped as &gt;)
  s = s.replace(/^&gt; ?(.*)$/gm, "<blockquote>$1</blockquote>");

  // Links [text](https://...): http/https only to prevent javascript: URLs
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Paragraphs: split on blank lines, wrap each non-empty chunk
  const paragraphs = s.split(/\n{2,}/).map((chunk) => {
    chunk = chunk.trim();
    if (!chunk) return "";
    // Don't wrap block elements
    if (/^<(pre|blockquote)/.test(chunk)) return chunk;
    return `<p>${chunk.replace(/\n/g, "<br>")}</p>`;
  });

  return paragraphs.filter(Boolean).join("\n");
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
