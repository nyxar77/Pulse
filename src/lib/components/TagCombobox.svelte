<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import X from "lucide-svelte/icons/x";

  let {
    id,
    values = $bindable([]),
    options,
    placeholder = "Type to search…",
  }: {
    id: string;
    values?: string[];
    options: readonly string[];
    placeholder?: string;
  } = $props();

  let query = $state("");
  let open = $state(false);
  let activeIndex = $state(0);
  let listboxId = $derived(`${id}-suggestions`);
  let matches = $derived.by(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const selected = new Set(values.map((value) => value.toLowerCase()));
    return options
      .filter((option) => !selected.has(option.toLowerCase()))
      .filter(
        (option) =>
          !normalizedQuery || option.toLowerCase().includes(normalizedQuery),
      )
      .sort((left, right) => {
        const leftStarts = left.toLowerCase().startsWith(normalizedQuery);
        const rightStarts = right.toLowerCase().startsWith(normalizedQuery);
        return (
          Number(rightStarts) - Number(leftStarts) || left.localeCompare(right)
        );
      })
      .slice(0, 10);
  });

  function addValue(value: string) {
    const clean = value.trim();
    if (
      !clean ||
      values.some((item) => item.toLowerCase() === clean.toLowerCase())
    )
      return;
    values = [...values, clean];
    query = "";
    activeIndex = 0;
    open = true;
  }

  function removeValue(value: string) {
    values = values.filter((item) => item !== value);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open = true;
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      open = true;
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (event.key === "Tab" && open && matches[activeIndex]) {
      event.preventDefault();
      addValue(matches[activeIndex]);
    } else if ((event.key === "Enter" || event.key === ",") && query.trim()) {
      event.preventDefault();
      addValue(matches[activeIndex] ?? query);
    } else if (event.key === "Backspace" && !query && values.length) {
      removeValue(values[values.length - 1]);
    } else if (event.key === "Escape") {
      open = false;
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      if (query.trim()) addValue(query);
      open = false;
    }, 100);
  }
</script>

<div class="tag-combobox">
  <div class:open class="tag-control">
    {#each values as value}
      <span class="tag">
        {value}
        <button
          type="button"
          tabindex="-1"
          onclick={() => removeValue(value)}
          aria-label={`Remove ${value}`}><X size={11} /></button
        >
      </span>
    {/each}
    <input
      {id}
      bind:value={query}
      {placeholder}
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open && matches[activeIndex]
        ? `${id}-option-${activeIndex}`
        : undefined}
      onfocus={() => (open = true)}
      oninput={() => {
        open = true;
        activeIndex = 0;
      }}
      onkeydown={handleKeydown}
      onblur={handleBlur}
    />
    <button
      class="toggle"
      type="button"
      tabindex="-1"
      onclick={() => (open = !open)}
      aria-label="Toggle muscle suggestions"
    >
      <span class:turned={open}><ChevronDown size={15} /></span>
    </button>
  </div>

  {#if open && (matches.length || query.trim())}
    <div class="suggestions" id={listboxId} role="listbox">
      {#each matches as option, index}
        <button
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          class:active={index === activeIndex}
          onmouseenter={() => (activeIndex = index)}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => addValue(option)}
        >
          <span>{option}</span>
          {#if index === activeIndex}<kbd>Tab</kbd>{/if}
        </button>
      {/each}
      {#if query.trim() && !options.some((option) => option.toLowerCase() === query
              .trim()
              .toLowerCase())}
        <button
          class="custom"
          type="button"
          onmousedown={(event) => event.preventDefault()}
          onclick={() => addValue(query)}
        >
          Use “{query.trim()}”
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .tag-combobox {
    position: relative;
    min-width: 0;
  }

  .tag-control {
    min-height: 44px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 5px 3px 5px 7px;
    color: var(--text);
    background: var(--mantle);
    border: 1px solid var(--line-strong);
    border-radius: 11px;
    transition: 140ms ease;
  }

  .tag-control:focus-within,
  .tag-control.open {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 4px 4px 8px;
    color: var(--text);
    background: var(--accent-soft);
    border: 1px solid var(--accent-mid);
    border-radius: 999px;
    font-size: 0.67rem;
    font-weight: 650;
  }

  .tag button {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--overlay);
    background: transparent;
    border: 0;
    border-radius: 50%;
  }

  .tag button:hover {
    color: var(--red);
  }

  input {
    min-width: 105px;
    flex: 1;
    min-height: 34px;
    padding: 6px 3px;
    color: var(--text);
    background: transparent;
    border: 0;
    outline: 0;
    font-size: 0.77rem;
    font-weight: 620;
  }

  input::placeholder {
    color: var(--overlay);
  }

  .toggle {
    width: 36px;
    height: 36px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--overlay);
    background: transparent;
    border: 0;
  }

  .toggle span {
    display: grid;
    place-items: center;
    transition: transform 140ms ease;
  }

  .toggle span.turned {
    transform: rotate(180deg);
  }

  .suggestions {
    position: absolute;
    z-index: 70;
    top: calc(100% + 7px);
    right: 0;
    left: 0;
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
    background: var(--panel-raised);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.34);
  }

  .suggestions button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 40px;
    padding: 9px 10px;
    color: var(--subtext);
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 8px;
    font-size: 0.71rem;
    font-weight: 650;
  }

  .suggestions button.active {
    color: var(--text);
    background: var(--accent-soft);
  }

  .suggestions button.custom {
    color: var(--accent);
    border-top: 1px solid var(--line);
  }

  kbd {
    color: var(--accent);
    font:
      700 0.55rem "Space Mono",
      monospace;
  }

  @media (max-width: 700px) {
    input {
      font-size: 1rem;
    }

    .toggle {
      width: 42px;
      height: 42px;
    }

    .suggestions button {
      min-height: 44px;
      font-size: 0.78rem;
    }
  }
</style>
