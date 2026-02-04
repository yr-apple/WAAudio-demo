<script lang="ts">
  import { onMount } from 'svelte';
  import WAAudioContext from './core';
  import AudioWorkstation from './demos/workstation/AudioWorkstation.svelte';
  import MultitrackMixer from './demos/workstation/MultitrackMixer.svelte';
  
  let currentDemo = 'workstation';
  
  function setDemo(demo: string) {
    currentDemo = demo;
  }
</script>

<main>
  <nav class="nav">
    <div class="nav-brand">🎵 WAAudio</div>
    <div class="nav-links">
      <button class:active={currentDemo === 'workstation'} on:click={() => setDemo('workstation')}>
        🎚️ 音频工作站
      </button>
      <button class:active={currentDemo === 'multitrack'} on:click={() => setDemo('multitrack')}>
        🎛️ 多轨混音
      </button>
    </div>
  </nav>
  
  {#if currentDemo === 'workstation'}
    <AudioWorkstation />
  {:else if currentDemo === 'multitrack'}
    <MultitrackMixer />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  main {
    min-height: 100vh;
    background: #1a1a2e;
  }
  
  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 30px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  
  .nav-brand {
    font-size: 1.3em;
    font-weight: bold;
    background: linear-gradient(45deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .nav-links {
    display: flex;
    gap: 10px;
  }
  
  .nav-links button {
    padding: 8px 16px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .nav-links button:hover {
    background: rgba(255,255,255,0.1);
  }
  
  .nav-links button.active {
    background: linear-gradient(45deg, #667eea, #764ba2);
    border: none;
  }
</style>
