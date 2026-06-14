<script lang="ts">
  import { onMount } from "svelte";
  import type { AppController } from "./controller.js";

  let { ctrl }: { ctrl: AppController } = $props();
  let host: HTMLDivElement;

  onMount(() => {
    ctrl.attach(host);
  });
</script>

<div class="host" bind:this={host}></div>

<style>
  .host {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #0B0D11;
    cursor: crosshair;
  }
</style>
