<script lang="ts">
  import {
    FEMALE_BACK,
    FEMALE_FRONT,
    MALE_BACK,
    MALE_FRONT,
  } from "@musclemap/assets";
  import type { BodyDiagram } from "@musclemap/assets";
  import { resolveMuscleRegions } from "$lib/muscle-map";
  import type { BodyMap } from "$lib/muscle-map";

  export let muscles: string[] = [];
  export let compact = false;
  export let bodyMap: BodyMap = "male";

  $: diagrams = bodyMapDiagrams(bodyMap);
  $: active = resolveMuscleRegions(muscles);

  function bodyMapDiagrams(
    selection: BodyMap,
  ): { label: string; diagram: BodyDiagram }[] {
    return selection === "female"
      ? [
          { label: "Front", diagram: FEMALE_FRONT },
          { label: "Back", diagram: FEMALE_BACK },
        ]
      : [
          { label: "Front", diagram: MALE_FRONT },
          { label: "Back", diagram: MALE_BACK },
        ];
  }

  function mirrorTransform(diagram: BodyDiagram): string {
    return `translate(${diagram.centerX * 2} 0) scale(-1 1)`;
  }
</script>

<figure
  class:compact
  class="muscle-map"
  role="img"
  aria-label={muscles.length
    ? `Muscles trained: ${muscles.join(", ")}`
    : "No muscles selected"}
>
  <div class="figures" aria-hidden="true">
    {#each diagrams as { label, diagram }}
      <div class="anatomy-view">
        <svg viewBox={diagram.viewBox}>
          <g class="body-outline">
            {#each diagram.outline as part}
              <path d={part.d} />
              {#if part.side === "LEFT"}
                <path d={part.d} transform={mirrorTransform(diagram)} />
              {/if}
            {/each}
          </g>

          <g class="muscle-surfaces">
            {#each diagram.muscles as part}
              <path class:active={active.has(part.group)} d={part.d} />
              {#if part.side === "LEFT"}
                <path
                  class:active={active.has(part.group)}
                  d={part.d}
                  transform={mirrorTransform(diagram)}
                />
              {/if}
            {/each}
          </g>
        </svg>
        <span>{label}</span>
      </div>
    {/each}
  </div>

  <figcaption><i></i>Highlighted muscles</figcaption>
</figure>

<style>
  .muscle-map {
    width: min(100%, 430px);
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 14px 16px 12px;
    border: 1px solid
      color-mix(in srgb, var(--md-sys-color-outline-variant) 70%, transparent);
    border-radius: 22px;
    background:
      radial-gradient(
        circle at 50% 44%,
        color-mix(in srgb, var(--md-sys-color-primary) 7%, transparent),
        transparent 58%
      ),
      var(--md-sys-color-surface-container-low);
  }

  .muscle-map.compact {
    width: min(100%, 350px);
    padding: 10px 12px;
  }

  .figures {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .anatomy-view {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 2px;
  }

  svg {
    width: 100%;
    max-width: 180px;
    height: auto;
    display: block;
    overflow: visible;
    shape-rendering: geometricPrecision;
  }

  .body-outline path {
    fill: color-mix(
      in srgb,
      var(--md-sys-color-on-surface-variant) 20%,
      var(--md-sys-color-surface-container-highest)
    );
    stroke: color-mix(in srgb, var(--md-sys-color-outline) 42%, transparent);
    stroke-width: 3.5;
    vector-effect: non-scaling-stroke;
  }

  .muscle-surfaces path {
    fill: color-mix(
      in srgb,
      var(--md-sys-color-on-surface-variant) 18%,
      var(--md-sys-color-surface-container-highest)
    );
    stroke: color-mix(in srgb, var(--md-sys-color-outline) 58%, transparent);
    stroke-width: 2.25;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
    transition:
      fill 150ms ease,
      stroke 150ms ease,
      opacity 150ms ease;
  }

  .muscle-surfaces path.active {
    fill: var(--md-sys-color-primary);
    stroke: color-mix(
      in srgb,
      var(--md-sys-color-on-primary-container) 72%,
      var(--md-sys-color-primary)
    );
    stroke-width: 3;
  }

  .anatomy-view > span,
  figcaption {
    color: var(--md-sys-color-on-surface-variant);
    font-size: 0.72rem;
    font-weight: 650;
    letter-spacing: 0.04em;
  }

  .anatomy-view > span {
    text-transform: uppercase;
  }

  figcaption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    letter-spacing: 0;
  }

  figcaption i {
    width: 9px;
    height: 9px;
    display: block;
    border-radius: 50%;
    background: var(--md-sys-color-primary);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--md-sys-color-primary) 14%, transparent);
  }

  @media (max-width: 420px) {
    .muscle-map {
      padding: 10px 12px;
      border-radius: 18px;
    }

    .figures {
      gap: 2px;
    }
  }
</style>
