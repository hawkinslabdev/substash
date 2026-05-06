const ALLOWED = new Set([
  "P",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "S",
  "DEL",
  "STRIKE",
  "H2",
  "H3",
  "CODE",
  "PRE",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "A",
]);

function cleanNode(node: Node): void {
  for (const child of [...node.childNodes]) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (!ALLOWED.has(el.tagName)) {
      while (el.firstChild) node.insertBefore(el.firstChild, el);
      el.remove();
    } else {
      const isAnchor = el.tagName === "A";
      for (const attr of [...el.attributes]) {
        if (
          isAnchor &&
          (attr.name === "href" ||
            attr.name === "target" ||
            attr.name === "rel")
        )
          continue;
        el.removeAttribute(attr.name);
      }
      if (isAnchor) {
        const href = el.getAttribute("href") ?? "";
        if (!href.startsWith("http://") && !href.startsWith("https://"))
          el.removeAttribute("href");
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      cleanNode(el);
    }
  }
}

export function sanitize(html: string): string {
  if (typeof document === "undefined") return "";
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  cleanNode(tpl.content);
  const div = document.createElement("div");
  div.appendChild(tpl.content.cloneNode(true));
  return div.innerHTML;
}
