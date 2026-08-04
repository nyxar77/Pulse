<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";

  let {
    id,
    value = $bindable(""),
    options,
    placeholder = "Start typing…",
  }: {
    id: string;
    value?: string;
    options: readonly string[];
    placeholder?: string;
  } = $props();

  let open = $state(false);
  let activeIndex = $state(0);
  let listboxId = $derived(`${id}-suggestions`);
  let matches = $derived.by(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options.slice(0, 10);
    return options
      .filter((option) => option.toLowerCase().includes(query))
      .sort((left, right) => {
        const leftStarts = left.toLowerCase().startsWith(query);
        const rightStarts = right.toLowerCase().startsWith(query);
        return Number(rightStarts) - Number(leftStarts) || left.localeCompare(right);
      })
      .slice(0, 10);
  });

  function choose(option: string) {
    value = option;
    open = false;
    activeIndex = 0;
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
    } else if ((event.key === "Enter" || event.key === "Tab") && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === "Escape") {
      open = false;
    }
  }

  function handleBlur() {
    window.setTimeout(() => (open = false), 100);
  }
</script>

<div class="autocomplete">
  <div class:open class="autocomplete-control">
    <input
      {id}
      bind:value
      {placeholder}
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open && matches[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
      onfocus={() => (open = true)}
      oninput={() => {
        open = true;
        activeIndex = 0;
      }}
      onkeydown={handleKeydown}
      onblur={handleBlur}
    />
    <button type="button" tabindex="-1" onclick={() => (open = !open)} aria-label="Toggle equipment suggestions">
      <span class:turned={open}><ChevronDown size={15} /></span>
    </button>
  </div>

  {#if open && matches.length}
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
          onclick={() => choose(option)}
        >
          <span>{option}</span>
          {#if index === activeIndex}<kbd>Tab</kbd>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
    min-width: 0;
  }

  .autocomplete-control {
    display: flex;
    align-items: center;
    color: var(--text);
    background: var(--mantle);
    border: 1px solid var(--surface-1);
    border-radius: 2px;
  }

  .autocomplete-control:focus-within,
  .autocomplete-control.open {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 8%, transparent);
  }

  input {
    min-width: 0;
    width: 100%;
    padding: 9px 2px 9px 10px;
    color: var(--text);
    background: transparent;
    border: 0;
    outline: 0;
    font-size: 0.7rem;
  }

  input::placeholder {
    color: var(--overlay);
  }

  .autocomplete-control > button {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--overlay);
    background: transparent;
    border: 0;
  }

  .autocomplete-control > button span {
    display: grid;
    place-items: center;
    transition: transform 140ms ease;
  }

  .autocomplete-control > button span.turned {
    transform: rotate(180deg);
  }

  .suggestions {
    position: absolute;
    z-index: 70;
    top: calc(100% + 5px);
    right: 0;
    left: 0;
    max-height: 230px;
    overflow-y: auto;
    padding: 5px;
    background: var(--mantle);
    border: 1px solid var(--surface-2);
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.34);
  }

  .suggestions button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 9px;
    color: var(--subtext);
    text-align: left;
    background: transparent;
    border: 0;
    font-size: 0.66rem;
  }

  .suggestions button.active {
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  kbd {
    color: var(--accent);
    font: 400 0.5rem "Space Mono", monospace;
  }
</style>
