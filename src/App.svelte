<script lang="ts">
  import { onMount } from 'svelte';
  import WAAudioContext from './core';

  let waCtx: WAAudioContext;
  let analyser: AnalyserNode | null = null;
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let isPlaying = false;
  let selectedFile: File | null = null;
  let source: any = null;

  onMount(() => {
    waCtx = new WAAudioContext();
    analyser = waCtx.createAnalyser();
    analyser.fftSize = 2048;
    
    ctx = canvas.getContext('2d');
    draw();
  });

  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
    }
  }

  async function play() {
    if (!selectedFile) return;
    
    if (isPlaying) {
      source?.stop();
      isPlaying = false;
      return;
    }

    source = await waCtx.createSource(selectedFile);
    source.connect(analyser!);
    analyser!.connect(waCtx.getContext().destination);
    source.play();
    isPlaying = true;
  }

  function draw() {
    if (!ctx || !analyser) return;
    
    requestAnimationFrame(draw);
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      
      const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      
      x += barWidth + 1;
    }
  }
</script>

<main>
  <h1>🎵 WAAudio Demo</h1>
  
  <div class="controls">
    <input type="file" accept="audio/*" on:change={handleFileSelect} />
    <button on:click={play}>
      {isPlaying ? '⏹️ 停止' : '▶️ 播放'}
    </button>
  </div>
  
  <canvas bind:this={canvas} width="800" height="400"></canvas>
  
  <p class="info">
    选择一个音频文件，点击播放查看频谱可视化效果
  </p>
</main>

<style>
  main {
    padding: 20px;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    min-height: 100vh;
    color: white;
    text-align: center;
  }
  
  h1 {
    margin-bottom: 20px;
  }
  
  .controls {
    margin: 20px 0;
  }
  
  input[type="file"] {
    padding: 10px;
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
    margin-right: 10px;
  }
  
  button {
    padding: 10px 20px;
    background: linear-gradient(45deg, #667eea, #764ba2);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
  }
  
  canvas {
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  }
  
  .info {
    margin-top: 20px;
    opacity: 0.7;
  }
</style>
