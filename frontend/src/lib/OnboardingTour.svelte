<script lang="ts">
  import { onDestroy, onMount } from "svelte";

  export let target: string;
  export let title: string;
  export let description: string;
  export let continueLabel = "";
  export let onContinue: (() => void) | undefined = undefined;
  export let onSkip: () => void;

  let highlighted: HTMLElement | null = null;
  let top = 24;
  let left = 24;
  let placement: "above" | "below" = "below";
  let popover: HTMLElement | null = null;
  let foundTarget = false;
  let modalOpen = false;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let previousTarget = "";

  function clearHighlight() {
    highlighted?.classList.remove("tour-highlight");
    highlighted = null;
  }

  function positionTooltip() {
    // Application dialogs (such as the quiz-preference prompt after accepting
    // a draft) must remain the only active layer. Pause the tour until the
    // student resolves the dialog, rather than letting two instructions overlap.
    modalOpen = !!document.querySelector("dialog[open], .prompt-backdrop");
    if (modalOpen) {
      clearHighlight();
      foundTarget = false;
      return;
    }

    const nextTarget = document.querySelector<HTMLElement>(`[data-tour-target="${target}"]`);
    if (nextTarget !== highlighted) {
      clearHighlight();
      highlighted = nextTarget;
      highlighted?.classList.add("tour-highlight");
    }

    foundTarget = !!highlighted;
    if (!highlighted) {
      top = 96;
      left = Math.max(16, (window.innerWidth - 340) / 2);
      return;
    }

    if (previousTarget !== target) {
      highlighted.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      previousTarget = target;
    }

    const rect = highlighted.getBoundingClientRect();
    const tooltipWidth = Math.min(340, window.innerWidth - 32);
    const tooltipHeight = popover?.offsetHeight ?? 300;
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    // Prefer the area below the control when it fits. That keeps a coachmark
    // for bottom action buttons from obscuring the content the student is
    // meant to review above it.
    placement = spaceBelow >= tooltipHeight || (spaceBelow >= 220 && spaceBelow >= spaceAbove * 0.65)
      ? "below"
      : "above";
    top = placement === "below"
      ? Math.min(rect.bottom + 16, window.innerHeight - tooltipHeight - 16)
      : Math.max(16, rect.top - tooltipHeight - 16);
    left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, rect.left + rect.width / 2 - tooltipWidth / 2));
  }

  onMount(() => {
    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);
    refreshTimer = setInterval(positionTooltip, 300);
  });

  onDestroy(() => {
    clearHighlight();
    window.removeEventListener("resize", positionTooltip);
    window.removeEventListener("scroll", positionTooltip, true);
    if (refreshTimer) clearInterval(refreshTimer);
  });

  $: target, positionTooltip();
</script>

{#if !modalOpen}
  <aside
    bind:this={popover}
    class="tour-popover"
    class:above={placement === "above"}
    class:waiting={!foundTarget}
    style:top={`${top}px`}
    style:left={`${left}px`}
    aria-live="polite"
    aria-label="Beginner guide"
  >
    <p class="eyebrow">Beginner guide</p>
    <h2>{title}</h2>
    <p>{description}</p>
    {#if !foundTarget}<p class="waiting-message">Waiting for this screen to open…</p>{/if}
    <div class="actions">
      <button class="skip" on:click={onSkip}>Skip guide</button>
      {#if continueLabel && onContinue}<button class="btn btn-primary" on:click={onContinue}>{continueLabel}</button>{/if}
    </div>
  </aside>
{/if}

<style>
  :global(.tour-highlight) { position: relative !important; z-index: 30 !important; outline: 3px solid var(--accent); outline-offset: 4px; border-radius: 8px; box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 20%, transparent); }
  .tour-popover { position: fixed; z-index: 40; width: min(340px, calc(100vw - 2rem)); padding: 1rem; border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); border-radius: 12px; background: var(--surface); box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24); }
  .tour-popover::before { content: ""; position: absolute; top: -9px; left: 50%; width: 16px; height: 16px; border-top: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); border-left: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); background: var(--surface); transform: translateX(-50%) rotate(45deg); }
  .tour-popover.above::before { top: auto; bottom: -9px; border-top: 0; border-left: 0; border-right: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); border-bottom: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .tour-popover.waiting::before { display: none; }
  .eyebrow { margin: 0; color: var(--accent); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  h2 { margin: 0.25rem 0 0; font-size: 1.05rem; }
  p { margin: 0.5rem 0 0; line-height: 1.45; }
  .waiting-message { color: var(--text-dim); font-size: 0.85rem; }
  .actions { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; margin-top: 1rem; }
  .skip { border: 0; background: none; color: var(--text-dim); padding: 0.3rem 0; font-size: 0.82rem; }
  .skip:hover { color: var(--text); }
</style>
