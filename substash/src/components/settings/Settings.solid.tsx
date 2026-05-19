import { createSignal, createMemo, Show, For } from "solid-js";
import { resetShareCache } from "@/lib/utils/share";
import {
  validateTitleExpr,
  evalTitleExpr,
  parseRichTitle,
  DEFAULT_TITLE_EXPR,
  type MetadataExprResult,
} from "@/lib/utils/media-title";

interface Props {
  pinEnabled: boolean;
  sessionHours: number;
  shareEnabled: boolean;
  mediaTitleExpr: string;
  feedFallbackName: string;
  feedShowPrefix: boolean;
  pageNameTags: string;
  pageNamePerformers: string;
  pageNameStudios: string;
}

export default function Settings(props: Props) {
  const [pinEnabled, setPinEnabled] = createSignal(props.pinEnabled);
  const [sessionHours, setSessionHours] = createSignal(props.sessionHours);
  const [shareEnabled, setShareEnabled] = createSignal(props.shareEnabled);
  const [showPinForm, setShowPinForm] = createSignal(false);
  const [pinFormMode, setPinFormMode] = createSignal<"set" | "change">("set");
  const [pinBoxes, setPinBoxes] = createSignal(["", "", "", "", "", ""]);
  const [pinError, setPinError] = createSignal("");
  const [pinLoading, setPinLoading] = createSignal(false);
  const [toast, setToast] = createSignal("");

  const [feedFallbackName, setFeedFallbackName] = createSignal(
    props.feedFallbackName,
  );
  const [feedShowPrefix, setFeedShowPrefix] = createSignal(
    props.feedShowPrefix,
  );
  const [savedFeed, setSavedFeed] = createSignal({
    fallbackName: props.feedFallbackName,
    showPrefix: props.feedShowPrefix,
  });
  const feedDirty = createMemo(
    () =>
      feedFallbackName() !== savedFeed().fallbackName ||
      feedShowPrefix() !== savedFeed().showPrefix,
  );
  const [feedSaving, setFeedSaving] = createSignal(false);

  async function saveFeed() {
    if (!feedDirty()) return;
    setFeedSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedFallbackName: feedFallbackName(),
          feedShowPrefix: feedShowPrefix(),
        }),
      });
      setSavedFeed({
        fallbackName: feedFallbackName(),
        showPrefix: feedShowPrefix(),
      });
      showToast("Feed settings saved.");
    } catch {
      showToast("Failed to save.");
    } finally {
      setFeedSaving(false);
    }
  }

  const [pageNamesOpen, setPageNamesOpen] = createSignal(false);
  const [pageNameTags, setPageNameTags] = createSignal(props.pageNameTags);
  const [pageNamePerformers, setPageNamePerformers] = createSignal(
    props.pageNamePerformers,
  );
  const [pageNameStudios, setPageNameStudios] = createSignal(
    props.pageNameStudios,
  );
  const [savedPageNames, setSavedPageNames] = createSignal({
    tags: props.pageNameTags,
    performers: props.pageNamePerformers,
    studios: props.pageNameStudios,
  });
  const pageNamesDirty = createMemo(
    () =>
      pageNameTags() !== savedPageNames().tags ||
      pageNamePerformers() !== savedPageNames().performers ||
      pageNameStudios() !== savedPageNames().studios,
  );
  const [pageNamesSaving, setPageNamesSaving] = createSignal(false);

  async function savePageNames() {
    if (!pageNamesDirty()) return;
    setPageNamesSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageNameTags: pageNameTags(),
          pageNamePerformers: pageNamePerformers(),
          pageNameStudios: pageNameStudios(),
        }),
      });
      setSavedPageNames({
        tags: pageNameTags(),
        performers: pageNamePerformers(),
        studios: pageNameStudios(),
      });
      showToast("Page names saved.");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      showToast("Failed to save.");
    } finally {
      setPageNamesSaving(false);
    }
  }

  const [scriptOpen, setScriptOpen] = createSignal(false);
  const [titleExpr, setTitleExpr] = createSignal(props.mediaTitleExpr);
  const [titleExprSaving, setTitleExprSaving] = createSignal(false);
  const [sampleTitle, setSampleTitle] = createSignal(
    "dankmemes - This is fine?! 2026-04-24T17:49:48 (by DarkWizard) #1sujk9t",
  );
  const [sampleBasename, setSampleBasename] = createSignal(
    "dankmemes - This is fine?! 2026-04-24T17:49:48 (by DarkWizard) #1sujk9t.jpg",
  );

  // Sample Stash API fields (editable in preview)
  const [sampleStudio, setSampleStudio] = createSignal("Example Studio");
  const [samplePerformers, setSamplePerformers] = createSignal(
    "Jane Doe, John Smith",
  );
  const [sampleTags, setSampleTags] = createSignal("example, sample");
  const [sampleDate, setSampleDate] = createSignal("2026-04-24");
  const [sampleRating, setSampleRating] = createSignal("85");

  // Derive all context variables from the sample inputs
  const sampleCtx = createMemo(() => {
    const b = sampleBasename() || null;
    const ext = b ? (b.match(/\.([^.]+)$/)?.[1] ?? null) : null;
    const filename = b ? b.replace(/\.[^/.]+$/, "") : null;
    const rawBase = sampleTitle() || filename || null;
    const parsed = rawBase ? parseRichTitle(rawBase) : null;
    return {
      title: sampleTitle() || null,
      date: sampleDate() || null,
      rating: sampleRating() ? Number(sampleRating()) : null,
      studio: sampleStudio() || null,
      performers: samplePerformers()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: sampleTags()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      filename,
      basename: b,
      ext,
      subreddit: parsed?.subreddit ?? null,
      postTitle: parsed?.postTitle ?? null,
      author: parsed?.author ?? null,
      dateStr: parsed?.dateStr ?? null,
      hash: parsed?.hash ?? null,
      clean: parsed?.clean ?? null,
    };
  });

  const titleExprValidation = createMemo(() => validateTitleExpr(titleExpr()));

  const exprResult = createMemo<MetadataExprResult | null>(() => {
    if (!titleExprValidation().ok) return null;
    return evalTitleExpr(sampleCtx(), titleExpr());
  });

  const [savedTitleExpr, setSavedTitleExpr] = createSignal(
    props.mediaTitleExpr,
  );
  const titleExprDirty = createMemo(() => titleExpr() !== savedTitleExpr());

  async function saveTitleExpr() {
    if (!titleExprValidation().ok || !titleExprDirty()) return;
    setTitleExprSaving(true);
    try {
      const expr = titleExpr();
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaTitleExpr: expr }),
      });
      setSavedTitleExpr(expr);
      showToast("Metadata expression saved.");
    } catch {
      showToast("Failed to save.");
    } finally {
      setTitleExprSaving(false);
    }
  }

  function resetTitleExpr() {
    setTitleExpr(DEFAULT_TITLE_EXPR);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function openPinForm(mode: "set" | "change") {
    setPinFormMode(mode);
    setShowPinForm(true);
    setPinBoxes(["", "", "", "", "", ""]);
    setPinError("");
    setTimeout(() => document.getElementById("pin-box-0")?.focus(), 50);
  }

  function updateBox(index: number, value: string) {
    const clean = value.replace(/[^a-zA-Z0-9]/g, "").slice(-1);
    const next = [...pinBoxes()];
    next[index] = clean;
    setPinBoxes(next);
    if (clean && index < 5)
      document.getElementById(`pin-box-${index + 1}`)?.focus();
  }

  function handleBoxKeyDown(e: KeyboardEvent, index: number) {
    if (e.key === "Backspace" && !pinBoxes()[index] && index > 0) {
      const next = [...pinBoxes()];
      next[index - 1] = "";
      setPinBoxes(next);
      document.getElementById(`pin-box-${index - 1}`)?.focus();
    }
  }

  async function submitPin() {
    const pin = pinBoxes().join("");
    if (pin.length < 6) {
      setPinError("Enter all 6 characters.");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error ?? "Failed.");
        return;
      }
      const authRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.token)
          localStorage.setItem("substash:session", authData.token);
      }
      setPinEnabled(true);
      setShowPinForm(false);
      setPinBoxes(["", "", "", "", "", ""]);
      showToast("PIN saved.");
    } catch {
      setPinError("Network error.");
    } finally {
      setPinLoading(false);
    }
  }

  async function removePin() {
    await fetch("/api/settings/pin", { method: "DELETE" });
    setPinEnabled(false);
    setShowPinForm(false);
    showToast("PIN removed.");
  }

  function adjustHours(delta: number) {
    const next = Math.max(0, sessionHours() + delta);
    saveSessionHours(next);
  }

  async function saveSessionHours(h: number) {
    setSessionHours(h);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionHours: h }),
    });
  }

  async function toggleShare(enabled: boolean) {
    setShareEnabled(enabled);
    resetShareCache();
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareEnabled: enabled }),
    });
  }

  return (
    <div class="pb-16">
      <Show when={toast()}>
        <div class="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text)] shadow-lg pointer-events-none">
          {toast()}
        </div>
      </Show>

      {/* SECURITY */}
      <SectionLabel>Security</SectionLabel>
      <div class="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {/* PIN row */}
        <Row>
          <RowLabel title="PIN Protection" sub="6-character lock screen" />
          <Show
            when={pinEnabled()}
            fallback={
              <button
                onClick={() => openPinForm("set")}
                class="shrink-0 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Set PIN
              </button>
            }
          >
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-xs text-emerald-400 font-medium mr-1">On</span>
              <PillButton onClick={() => openPinForm("change")}>
                Change
              </PillButton>
              <PillButton onClick={removePin} danger>
                Remove
              </PillButton>
            </div>
          </Show>
        </Row>

        {/* Session length row */}
        <Show when={pinEnabled() && !showPinForm()}>
          <Row>
            <div class="min-w-0">
              <p class="text-sm text-[var(--color-text)]">Session length</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                Time until automatic logout after inactivity.
              </p>
            </div>
            {/* Custom +/- stepper — no native spinners */}
            <div class="flex items-center shrink-0 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-3)]">
              <button
                onClick={() => adjustHours(-1)}
                aria-label="Decrease"
                class="w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" d="M5 12h14" />
                </svg>
              </button>
              <span class="w-14 text-center text-sm font-semibold text-[var(--color-text)] border-x border-[var(--color-border)] self-stretch flex items-center justify-center">
                {sessionHours() === 0 ? "∞" : sessionHours()}
              </span>
              <button
                onClick={() => adjustHours(1)}
                aria-label="Increase"
                class="w-11 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
          </Row>
        </Show>
      </div>

      {/* PIN entry form panel */}
      <Show when={showPinForm()}>
        <div class="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 pt-5 pb-6 space-y-5">
          <p class="text-xs font-medium text-[var(--color-text-muted)]">
            {pinFormMode() === "set"
              ? "Choose a 6-character PIN"
              : "Enter a new PIN"}
          </p>
          <div class="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                id={`pin-box-${i}`}
                type="text"
                maxlength="1"
                inputmode="text"
                autocomplete="off"
                value={pinBoxes()[i]}
                onInput={(e) => updateBox(i, e.currentTarget.value)}
                onKeyDown={(e) => handleBoxKeyDown(e, i)}
                class="w-11 h-13 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-center text-lg font-semibold text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] uppercase caret-[var(--color-accent)] transition-colors"
              />
            ))}
          </div>
          <Show when={pinError()}>
            <p class="text-xs text-red-400">{pinError()}</p>
          </Show>
          <div class="flex items-center gap-5 pt-1">
            <button
              onClick={submitPin}
              disabled={pinLoading()}
              class="h-11 px-6 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-50 transition-colors"
            >
              {pinLoading() ? "Saving…" : "Save PIN"}
            </button>
            <button
              onClick={() => setShowPinForm(false)}
              class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* SHARING */}
      <SectionLabel>Sharing</SectionLabel>
      <div class="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        <Row>
          <div class="min-w-0">
            <p class="text-sm text-[var(--color-text)]">Shorten share links</p>
            {/* Share when disabled */}
            <Show when={!shareEnabled()}>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                Sharing requires user login if a PIN is enabled.
              </p>
            </Show>
            <Show when={shareEnabled()}>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                Anyone with the link can access this item without a PIN.
              </p>
            </Show>
          </div>
          {/* Toggle — inline-flex so thumb is a flex child, never overflows */}
          <button
            role="switch"
            aria-checked={shareEnabled()}
            onClick={() => toggleShare(!shareEnabled())}
            class="shrink-0 flex items-center justify-center focus:outline-none"
          >
            <div
              class={`inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors duration-200 ${shareEnabled() ? "bg-[var(--color-accent)]" : "bg-[#404040]"}`}
            >
              <span
                aria-hidden="true"
                class={`inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-in-out ${shareEnabled() ? "translate-x-5" : "translate-x-0"}`}
                style={{ "box-shadow": "0 1px 4px rgba(0,0,0,0.5)" }}
              />
            </div>
          </button>
        </Row>
      </div>

      {/* DISPLAY */}
      <SectionLabel>Display</SectionLabel>
      <div class="border-t border-b border-[var(--color-border)]">
        {/* Collapsible header row */}
        <button
          onClick={() => setScriptOpen((v) => !v)}
          class="w-full flex items-center justify-between px-4 min-h-[56px] gap-4 hover:bg-[var(--color-surface-2)] transition-colors active:scale-[0.99]"
        >
          <div class="min-w-0 text-left">
            <p class="text-sm text-[var(--color-text)]">Metadata expression</p>
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
              Control title, performer, origin, credit, and day
            </p>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${scriptOpen() ? "rotate-180" : ""}`}
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m6 9 6 6 6-6"
            />
          </svg>
        </button>

        <Show when={scriptOpen()}>
          <div class="px-4 pb-5 space-y-5 border-t border-[var(--color-border)]">
            {/* Script editor */}
            <div class="pt-4">
              <div class="flex items-center justify-end mb-3">
                <button
                  onClick={resetTitleExpr}
                  disabled={titleExpr() === DEFAULT_TITLE_EXPR}
                  class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-default transition-colors"
                >
                  Reset to default
                </button>
              </div>
              <textarea
                value={titleExpr()}
                onInput={(e) => setTitleExpr(e.currentTarget.value)}
                rows={6}
                spellcheck={false}
                autocomplete="off"
                class={`w-full font-mono text-sm bg-[var(--color-surface-3)] border rounded-xl px-3 py-2.5 text-[var(--color-text)] focus:outline-none transition-colors resize-y leading-relaxed ${
                  titleExprValidation().ok
                    ? "border-[var(--color-border)] focus:border-[var(--color-accent)]"
                    : "border-red-500/60 focus:border-red-500"
                }`}
              />
              <Show when={!titleExprValidation().ok}>
                <p class="mt-1.5 text-xs text-red-400 font-mono leading-snug">
                  {!titleExprValidation().ok &&
                    (titleExprValidation() as { ok: false; error: string })
                      .error}
                </p>
              </Show>
            </div>

            {/* Sample data + live variable inspector */}
            <div class="space-y-3">
              <p class="text-[11px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
                Preview
              </p>

              {/* Editable inputs — Stash API fields */}
              <p class="text-[10px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
                Stash fields
              </p>
              <div class="grid grid-cols-2 gap-2">
                {(
                  [
                    [
                      "title",
                      sampleTitle,
                      setSampleTitle,
                      "dankmemes - This is fine?! …",
                    ],
                    [
                      "basename",
                      sampleBasename,
                      setSampleBasename,
                      "dankmemes - … #hash.jpg",
                    ],
                    ["studio", sampleStudio, setSampleStudio, "Example Studio"],
                    [
                      "performers",
                      samplePerformers,
                      setSamplePerformers,
                      "Jane Doe, John Smith",
                    ],
                    ["tags", sampleTags, setSampleTags, "example, sample"],
                    ["date", sampleDate, setSampleDate, "2026-04-24"],
                  ] as [string, () => string, (v: string) => void, string][]
                ).map(([name, get, set, ph]) => (
                  <div>
                    <label class="text-[10px] font-mono text-[var(--color-text-muted)] mb-1 block">
                      {name}
                    </label>
                    <input
                      type="text"
                      value={get()}
                      onInput={(e) => set(e.currentTarget.value)}
                      placeholder={ph}
                      class="w-full font-mono text-xs bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                  </div>
                ))}
              </div>

              {/* Parsed fields — read-only chips */}
              <p class="text-[10px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase pt-1">
                Parsed from title
              </p>
              <div class="grid grid-cols-2 gap-1.5">
                <For
                  each={
                    [
                      ["subreddit", sampleCtx().subreddit],
                      ["postTitle", sampleCtx().postTitle],
                      ["author", sampleCtx().author],
                      ["dateStr", sampleCtx().dateStr],
                      ["hash", sampleCtx().hash],
                      ["clean", sampleCtx().clean],
                    ] as [string, string | null][]
                  }
                >
                  {([name, val]) => (
                    <div class="px-2.5 py-1.5 bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-lg min-w-0">
                      <p class="text-[9px] font-mono text-[var(--color-text-muted)] mb-0.5 tracking-wide">
                        {name}
                      </p>
                      <p class="text-[11px] font-mono text-[var(--color-text)] truncate">
                        {val ?? <span class="opacity-30 italic">null</span>}
                      </p>
                    </div>
                  )}
                </For>
              </div>

              {/* Expression output */}
              <p class="text-[10px] font-semibold tracking-wide text-[var(--color-text-muted)] uppercase pt-1">
                Expression output
              </p>
              <Show
                when={titleExprValidation().ok}
                fallback={
                  <p class="text-xs text-red-400 italic">
                    Fix the expression to see a preview
                  </p>
                }
              >
                <div class="grid grid-cols-2 gap-1.5">
                  <For
                    each={
                      [
                        ["title", exprResult()?.title ?? null],
                        ["performer", exprResult()?.performer ?? null],
                        ["origin", exprResult()?.origin ?? null],
                        ["credit", exprResult()?.credit ?? null],
                        ["day", exprResult()?.day ?? null],
                      ] as [string, string | null][]
                    }
                  >
                    {([name, val]) => (
                      <div class="px-2.5 py-1.5 bg-[var(--color-surface-3)] border border-[var(--color-accent)]/30 rounded-lg min-w-0">
                        <p class="text-[9px] font-mono text-[var(--color-text-muted)] mb-0.5 tracking-wide">
                          {name}
                        </p>
                        <p class="text-[11px] font-mono text-[var(--color-text)] truncate">
                          {val ?? <span class="opacity-30 italic">null</span>}
                        </p>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            {/* Save */}
            <div class="flex items-center gap-4">
              <button
                onClick={saveTitleExpr}
                disabled={
                  !titleExprValidation().ok ||
                  !titleExprDirty() ||
                  titleExprSaving()
                }
                class="h-10 px-5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {titleExprSaving() ? "Saving…" : "Save"}
              </button>
              <Show
                when={
                  titleExprDirty() &&
                  titleExprValidation().ok &&
                  !titleExprSaving()
                }
              >
                <p class="text-xs text-[var(--color-text-muted)]">
                  Unsaved changes
                </p>
              </Show>
            </div>
          </div>
        </Show>

        {/* Page names — collapsible */}
        <div class="border-t border-[var(--color-border)]">
          <button
            onClick={() => setPageNamesOpen((v) => !v)}
            class="w-full flex items-center justify-between px-4 min-h-[56px] gap-4 hover:bg-[var(--color-surface-2)] transition-colors active:scale-[0.99]"
          >
            <div class="min-w-0 text-left">
              <p class="text-sm text-[var(--color-text)]">Page names</p>
              <p class="text-xs text-[var(--color-text-muted)] mt-0.5">
                Custom labels for Tags, Performers, and Studios pages
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class={`shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${pageNamesOpen() ? "rotate-180" : ""}`}
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m6 9 6 6 6-6"
              />
            </svg>
          </button>

          <Show when={pageNamesOpen()}>
            <div class="px-4 pb-5 space-y-4 border-t border-[var(--color-border)] pt-4">
              {(
                [
                  ["Tags page", pageNameTags, setPageNameTags, "Tags"],
                  [
                    "Performers page",
                    pageNamePerformers,
                    setPageNamePerformers,
                    "Creators",
                  ],
                  [
                    "Studios page",
                    pageNameStudios,
                    setPageNameStudios,
                    "Studios",
                  ],
                ] as [string, () => string, (v: string) => void, string][]
              ).map(([label, get, set, placeholder]) => (
                <div>
                  <label class="text-xs text-[var(--color-text-muted)] mb-1.5 block">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={get()}
                    onInput={(e) => set(e.currentTarget.value)}
                    placeholder={placeholder}
                    class="w-full text-sm bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded-xl px-3 py-2.5 text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                </div>
              ))}
              <div class="flex items-center gap-4 pt-1">
                <button
                  onClick={savePageNames}
                  disabled={!pageNamesDirty() || pageNamesSaving()}
                  class="h-10 px-5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {pageNamesSaving() ? "Saving…" : "Save"}
                </button>
                <Show when={pageNamesDirty() && !pageNamesSaving()}>
                  <p class="text-xs text-[var(--color-text-muted)]">
                    Unsaved changes
                  </p>
                </Show>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* FEED */}
      <SectionLabel>Feed</SectionLabel>
      <div class="border-t border-b border-[var(--color-border)] divide-y divide-[var(--color-border)]">
        {/* Show r/ prefix toggle */}
        <Row>
          <RowLabel
            title="Show r/ prefix"
            sub="Display r/ or u/ before community names in cards"
          />
          <button
            role="switch"
            aria-checked={feedShowPrefix()}
            onClick={() => setFeedShowPrefix((v) => !v)}
            class="shrink-0 flex items-center justify-center focus:outline-none"
          >
            <div
              class={`inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors duration-200 ${feedShowPrefix() ? "bg-[var(--color-accent)]" : "bg-[#404040]"}`}
            >
              <span
                aria-hidden="true"
                class={`inline-block h-5 w-5 rounded-full bg-white transition-transform duration-200 ease-in-out ${feedShowPrefix() ? "translate-x-5" : "translate-x-0"}`}
                style={{ "box-shadow": "0 1px 4px rgba(0,0,0,0.5)" }}
              />
            </div>
          </button>
        </Row>

        {/* Fallback community name */}
        <Row>
          <RowLabel
            title="Fallback community"
            sub="Shown when no community is found in the title"
          />
          <div class="flex items-center shrink-0 gap-0 rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-3)]">
            <Show when={feedShowPrefix()}>
              <span class="pl-3 pr-1 text-sm font-mono text-[var(--color-text-muted)] select-none">
                r/
              </span>
            </Show>
            <input
              type="text"
              value={feedFallbackName()}
              onInput={(e) => setFeedFallbackName(e.currentTarget.value)}
              placeholder="discover"
              class={`w-28 text-sm bg-transparent py-2 text-[var(--color-text)] focus:outline-none transition-colors ${feedShowPrefix() ? "pr-3" : "px-3"}`}
            />
          </div>
        </Row>

        {/* Save row */}
        <Show when={feedDirty()}>
          <div class="flex items-center gap-4 px-4 py-3">
            <button
              onClick={saveFeed}
              disabled={feedSaving()}
              class="h-9 px-5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {feedSaving() ? "Saving…" : "Save"}
            </button>
            <p class="text-xs text-[var(--color-text-muted)]">
              Unsaved changes
            </p>
          </div>
        </Show>
      </div>

      {/* ABOUT */}
      <SectionLabel>About</SectionLabel>
      <div class="border-t border-b border-[var(--color-border)]">
        <a
          href="https://github.com/hawkinslabdev/substash"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between px-4 min-h-[52px] gap-4 hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <div class="flex items-center gap-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="text-[var(--color-text-muted)] shrink-0"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <p class="text-sm text-[var(--color-text)]">Source code</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-xs text-[var(--color-text-muted)]">
              substash
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="text-[var(--color-text-muted)]"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="m9 18 6-6-6-6"
              />
            </svg>
          </div>
        </a>
      </div>
    </div>
  );
}

function SectionLabel(props: { children: string }) {
  return (
    <div class="px-4 pt-10 pb-2.5">
      <p class="text-[10px] font-bold tracking-widest text-[var(--color-text-muted)] uppercase">
        {props.children}
      </p>
    </div>
  );
}

function Row(props: { children: any }) {
  return (
    <div class="flex items-center justify-between px-4 min-h-[56px] gap-4">
      {props.children}
    </div>
  );
}

function RowLabel(props: { title: string; sub?: string }) {
  return (
    <div class="min-w-0">
      <p class="text-sm text-[var(--color-text)]">{props.title}</p>
      {props.sub && (
        <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{props.sub}</p>
      )}
    </div>
  );
}

function PillButton(props: {
  children: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={props.onClick}
      class={`text-xs px-2.5 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-surface-3)] ${props.danger ? "text-red-400 hover:text-red-300" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
    >
      {props.children}
    </button>
  );
}
