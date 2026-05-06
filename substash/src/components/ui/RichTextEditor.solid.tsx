import { createSignal, Show, type JSX } from "solid-js";
import { sanitize } from "@/lib/utils/sanitize";

interface Props {
  onSubmit: (html: string) => void;
  placeholder?: string;
  pending?: boolean;
}

export default function RichTextEditor(props: Props) {
  let editorEl: HTMLDivElement | undefined;
  const [empty, setEmpty] = createSignal(true);
  const [linkMode, setLinkMode] = createSignal(false);
  const [linkUrl, setLinkUrl] = createSignal("");
  let savedRange: Range | null = null;

  const checkEmpty = () => setEmpty(!editorEl?.textContent?.trim());

  function exec(cmd: string, value?: string) {
    editorEl?.focus();
    document.execCommand(cmd, false, value ?? "");
    checkEmpty();
  }

  function insertHtml(html: string) {
    editorEl?.focus();
    document.execCommand("insertHTML", false, html);
    checkEmpty();
  }

  function saveRange() {
    const sel = window.getSelection();
    savedRange =
      sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  }

  function restoreRange() {
    const sel = window.getSelection();
    if (sel && savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  function handleHeading() {
    const text = window.getSelection()?.toString() || "Heading";
    insertHtml(`<h3>${text}</h3><p><br></p>`);
  }

  function handleQuote() {
    const text = window.getSelection()?.toString() || "Quote";
    insertHtml(`<blockquote>${text}</blockquote><p><br></p>`);
  }

  function handleInlineCode() {
    const text = window.getSelection()?.toString() || "code";
    insertHtml(`<code>${text}</code>`);
  }

  function handleCodeBlock() {
    insertHtml(`<pre><code>code</code></pre><p><br></p>`);
  }

  function handleLink() {
    saveRange();
    setLinkUrl("");
    setLinkMode(true);
  }

  function confirmLink() {
    restoreRange();
    let url = linkUrl().trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      exec("createLink", url);
      // Make sure link opens in new tab
      editorEl?.querySelectorAll("a:not([target])").forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    }
    setLinkMode(false);
  }

  function cancelLink() {
    setLinkMode(false);
    editorEl?.focus();
  }

  function handleSubmit() {
    if (empty() || props.pending) return;
    const html = sanitize(editorEl?.innerHTML ?? "");
    if (!html) return;
    props.onSubmit(html);
    if (editorEl) editorEl.innerHTML = "";
    checkEmpty();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div class="rounded-xl border border-[var(--color-border)] overflow-hidden focus-within:border-[var(--color-accent)] transition-colors bg-[var(--color-surface-3)]">
      {/* Toolbar */}
      <div class="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <Btn title="Bold (Ctrl+B)" onClick={() => exec("bold")}>
          <span class="font-bold text-xs">B</span>
        </Btn>
        <Btn title="Italic (Ctrl+I)" onClick={() => exec("italic")}>
          <span class="italic text-xs">I</span>
        </Btn>
        <Btn title="Strikethrough" onClick={() => exec("strikeThrough")}>
          <span class="line-through text-xs">S</span>
        </Btn>
        <Sep />
        <Btn title="Heading" onClick={handleHeading}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </Btn>
        <Btn title="Blockquote" onClick={handleQuote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
          </svg>
        </Btn>
        <Btn title="Inline code" onClick={handleInlineCode}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </Btn>
        <Btn title="Code block" onClick={handleCodeBlock}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="m8 21 4-4 4 4" />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Bullet list" onClick={() => exec("insertUnorderedList")}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </Btn>
        <Btn title="Numbered list" onClick={() => exec("insertOrderedList")}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" stroke="currentColor" stroke-linecap="round" />
            <path d="M4 10h2" stroke="currentColor" stroke-linecap="round" />
            <path
              d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"
              stroke="currentColor"
              stroke-linecap="round"
            />
          </svg>
        </Btn>
        <Sep />
        <Btn title="Link" onClick={handleLink}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            />
          </svg>
        </Btn>
      </div>

      {/* Link URL input */}
      <Show when={linkMode()}>
        <div class="flex gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <input
            type="url"
            value={linkUrl()}
            onInput={(e) => setLinkUrl(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmLink();
              if (e.key === "Escape") cancelLink();
            }}
            placeholder="https://…"
            autofocus
            class="flex-1 min-w-0 bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-md px-2.5 py-1 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] min-h-0"
          />
          <button
            type="button"
            onClick={confirmLink}
            class="px-3 py-1 rounded-md bg-[var(--color-accent)] text-white text-xs font-medium min-h-0 h-auto"
          >
            Add
          </button>
          <button
            type="button"
            onClick={cancelLink}
            class="px-3 py-1 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-muted)] text-xs min-h-0 h-auto"
          >
            ✕
          </button>
        </div>
      </Show>

      {/* Editable area */}
      <div
        ref={editorEl}
        contenteditable
        onInput={checkEmpty}
        onKeyDown={onKeyDown}
        data-placeholder={props.placeholder ?? "What are your thoughts?"}
        class="rich-editor min-h-[100px] px-3 py-2.5 text-sm text-[var(--color-text)] focus:outline-none"
      />

      {/* Footer */}
      <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <span class="text-[10px] text-[var(--color-text-muted)]">
          Ctrl+Enter to post
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={empty() || props.pending}
          class="px-4 py-1.5 rounded-full bg-[var(--color-accent)] text-white text-xs font-medium disabled:opacity-40 active:scale-95 transition-all min-h-0 h-auto"
        >
          {props.pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}

function Btn(p: { title: string; onClick: () => void; children: JSX.Element }) {
  return (
    <button
      type="button"
      title={p.title}
      onClick={p.onClick}
      class="flex items-center justify-center w-7 h-7 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)] transition-colors min-h-0 min-w-0"
    >
      {p.children}
    </button>
  );
}

function Sep() {
  return <div class="w-px h-4 bg-[var(--color-border)] mx-0.5 shrink-0" />;
}
