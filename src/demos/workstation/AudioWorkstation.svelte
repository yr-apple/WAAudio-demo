<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WAAudioContext from '../core/index';
  import { WAAudioAnalyser } from '../core/analyser';
  
  // 状态
  let context: WAAudioContext;
  let analyser: WAAudioAnalyser;
  let source: AudioBufferSourceNode | null = null;
  let audioBuffer: AudioBuffer | null = null;
  let audioContext: AudioContext;
  
  // UI 状态
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let playbackRate = 1;
  let zoom = 1;
  
  // 文件
  let selectedFile: File | null = null;
  let fileName = '';
  
  // Canvas 引用
  let waveformCanvas: HTMLCanvasElement;
  let spectrumCanvas: HTMLCanvasElement;
  let meterCanvas: HTMLCanvasElement;
  let waveformCtx: CanvasRenderingContext2D;
  let spectrumCtx: CanvasRenderingContext2D;
  let meterCtx: CanvasRenderingContext2D;
  
  // 动画帧
  let animationId: number;
  let startTime = 0;
  let pauseTime = 0;
  
  onMount(() => {
    context = new WAAudioContext();
    audioContext = context.getContext();
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(audioContext.destination);
    
    // 初始化 Canvas
    waveformCtx = waveformCanvas.getContext('2d')!;
    spectrumCtx = spectrumCanvas.getContext('2d')!;
    meterCtx = meterCanvas.getContext('2d')!;
    
    draw();
  });
  
  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (source) source.stop();
    context.suspend();
  });
  
  function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      fileName = selectedFile.name;
      loadAudio(selectedFile);
    }
  }
  
  async function loadAudio(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    duration = audioBuffer.duration;
    currentTime = 0;
    
    drawWaveform();
    updateTime();
  }
  
  function play() {
    if (!audioBuffer) return;
    
    if (isPlaying) {
      pause();
      return;
    }
    
    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackRate;
    
    // 创建增益节点控制音量
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(analyser.getAnalyser());
    analyser.getAnalyser().connect(audioContext.destination);
    
    source.start(0, currentTime);
    isPlaying = true;
    startTime = audioContext.currentTime - currentTime / playbackRate;
    
    animate();
    source.onended = () => {
      if (playbackRate > 1) {
        loop();
      } else {
        isPlaying = false;
        currentTime = 0;
      }
    };
  }
  
  function pause() {
    if (source) {
      source.stop();
      source = null;
    }
    pauseTime = currentTime;
    isPlaying = false;
  }
  
  function stop() {
    if (source) {
      source.stop();
      source = null;
    }
    isPlaying = false;
    currentTime = 0;
    pauseTime = 0;
  }
  
  function loop() {
    if (!audioBuffer) return;
    currentTime = 0;
    play();
  }
  
  function animate() {
    if (!isPlaying) return;
    
    currentTime = (audioContext.currentTime - startTime) * playbackRate;
    
    if (currentTime >= duration) {
      if (playbackRate > 1) {
        loop();
      } else {
        stop();
      }
    }
    
    drawWaveform();
    drawSpectrum();
    drawMeter();
    
    animationId = requestAnimationFrame(animate);
  }
  
  function drawWaveform() {
    if (!waveformCtx || !audioBuffer) return;
    
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    // 背景
    waveformCtx.fillStyle = '#1a1a2e';
    waveformCtx.fillRect(0, 0, width, height);
    
    if (!audioBuffer) return;
    
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width / zoom);
    const amp = height / 2;
    
    waveformCtx.fillStyle = '#667eea';
    waveformCtx.beginPath();
    
    for (let i = 0; i < width; i++) {
      const min = 1.0;
      const max = -1.0;
      let idx = i * step;
      let datum = data[idx];
      
      for (let j = 0; j < step; j++) {
        const val = data[idx + j];
        if (val < min) datum = val;
        if (val > max) datum = val;
      }
      
      const y = (1 + datum) * amp;
      waveformCtx.fillRect(i, y, 1, 1);
    }
    
    // 播放头
    const playheadX = (currentTime / duration) * width;
    waveformCtx.strokeStyle = '#ff6b6b';
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();
    waveformCtx.moveTo(playheadX, 0);
    waveformCtx.lineTo(playheadX, height);
    waveformCtx.stroke();
  }
  
  function drawSpectrum() {
    if (!spectrumCtx || !analyser) return;
    
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    
    spectrumCtx.fillStyle = '#1a1a2e';
    spectrumCtx.fillRect(0, 0, width, height);
    
    analyser.update();
    const data = analyser.getFrequencyData();
    const barWidth = width / data.length;
    
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c'];
    
    for (let i = 0; i < data.length; i++) {
      const barHeight = (data[i] / 255) * height;
      const x = i * barWidth;
      
      const gradient = spectrumCtx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, colors[i % colors.length]);
      gradient.addColorStop(1, colors[(i + 1) % colors.length]);
      
      spectrumCtx.fillStyle = gradient;
      spectrumCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
    }
  }
  
  function drawMeter() {
    if (!meterCtx || !analyser) return;
    
    const width = meterCanvas.width;
    const height = meterCanvas.height;
    
    analyser.update();
    const data = analyser.getFrequencyData();
    
    // 计算 RMS
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length) / 255;
    const db = 20 * Math.log10(rms + 0.001);
    const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
    
    meterCtx.fillStyle = '#1a1a2e';
    meterCtx.fillRect(0, 0, width, height);
    
    // 电平条
    const meterHeight = normalized * height;
    const gradient = meterCtx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#00ff00');
    gradient.addColorStop(0.7, '#ffff00');
    gradient.addColorStop(1, '#ff0000');
    
    meterCtx.fillStyle = gradient;
    meterCtx.fillRect(0, height - meterHeight, width, meterHeight);
    
    // 刻度
    meterCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    meterCtx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const y = (i / 6) * height;
      meterCtx.beginPath();
      meterCtx.moveTo(0, y);
      meterCtx.lineTo(width, y);
      meterCtx.stroke();
    }
  }
  
  function draw() {
    drawWaveform();
    drawSpectrum();
    drawMeter();
  }
  
  function updateTime() {
    const mins = Math.floor(currentTime / 60);
    const secs = Math.floor(currentTime % 60);
    const ms = Math.floor((currentTime % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  function setVolume(e: Event) {
    volume = parseFloat((e.target as HTMLInputElement).value);
  }
  
  function setPlaybackRate(e: Event) {
    playbackRate = parseFloat((e.target as HTMLInputElement).value);
  }
</script>

<div class="workstation">
  <header class="header">
    <h1>🎵 WAAudio Studio</h1>
    <div class="file-info">
      <input type="file" accept="audio/*" on:change={handleFileSelect} />
      <span class="filename">{fileName || '未选择文件'}</span>
    </div>
  </header>
  
  <div class="main-area">
    <!-- 波形编辑器 -->
    <div class="waveform-section">
      <div class="section-header">
        <span>波形</span>
        <div class="zoom-controls">
          <button on:click={() => zoom = Math.max(0.25, zoom * 0.5)}>-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button on:click={() => zoom = Math.min(4, zoom * 2)}>+</button>
        </div>
      </div>
      <canvas bind:this={waveformCanvas} width="1200" height="150"></canvas>
    </div>
    
    <!-- 频谱分析器 -->
    <div class="spectrum-section">
      <div class="section-header">
        <span>频谱</span>
      </div>
      <canvas bind:this={spectrumCanvas} width="1200" height="100"></canvas>
    </div>
    
    <!-- 控制面板 -->
    <div class="controls-section">
      <!-- 时间显示 -->
      <div class="time-display">
        <span class="current-time">{updateTime()}</span>
        <span class="separator">/</span>
        <span class="total-time">
          {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
        </span>
      </div>
      
      <!-- 播放控制 -->
      <div class="playback-controls">
        <button class="btn" on:click={() => currentTime = Math.max(0, currentTime - 5)}>⏪ 5s</button>
        <button class="btn btn-primary" on:click={play}>
          {isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
        </button>
        <button class="btn" on:click={stop}>⏹️ 停止</button>
        <button class="btn" on:click={loop}>🔁 循环</button>
        <button class="btn" on:click={() => currentTime = Math.min(duration, currentTime + 5)}>5s ⏩</button>
      </div>
      
      <!-- 音量 -->
      <div class="volume-control">
        <span>🔊</span>
        <input type="range" min="0" max="1" step="0.01" value={volume} on:input={setVolume} />
        <span>{Math.round(volume * 100)}%</span>
      </div>
      
      <!-- 播放速度 -->
      <div class="speed-control">
        <span>🚀</span>
        <input type="range" min="0.25" max="2" step="0.25" value={playbackRate} on:input={setPlaybackRate} />
        <span>{playbackRate}x</span>
      </div>
    </div>
    
    <!-- 电平表 -->
    <div class="meter-section">
      <div class="section-header">
        <span>电平</span>
      </div>
      <div class="meters">
        <canvas bind:this={meterCanvas} class="meter-canvas" width="40" height="200"></canvas>
      </div>
    </div>
    
    <!-- 效果器面板（预留） -->
    <div class="effects-section">
      <div class="section-header">
        <span>效果器</span>
      </div>
      <div class="effects-grid">
        <div class="effect-slot">
          <span>EQ</span>
          <button class="btn-small">未加载</button>
        </div>
        <div class="effect-slot">
          <span>压缩</span>
          <button class="btn-small">未加载</button>
        </div>
        <div class="effect-slot">
          <span>混响</span>
          <button class="btn-small">未加载</button>
        </div>
        <div class="effect-slot">
          <span>延迟</span>
          <button class="btn-small">未加载</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .workstation {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    min-height: 100vh;
    color: white;
    padding: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  
  .header h1 {
    margin: 0;
    font-size: 1.5em;
    background: linear-gradient(45deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .file-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .filename {
    opacity: 0.7;
    font-size: 0.9em;
  }
  
  .main-area {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    font-weight: bold;
    opacity: 0.8;
  }
  
  canvas {
    border-radius: 8px;
    width: 100%;
    background: #1a1a2e;
  }
  
  .controls-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 30px;
    padding: 20px;
    background: rgba(255,255,255,0.05);
    border-radius: 12px;
    flex-wrap: wrap;
  }
  
  .time-display {
    font-family: 'Courier New', monospace;
    font-size: 1.5em;
    background: #0a0a1a;
    padding: 10px 20px;
    border-radius: 8px;
  }
  
  .current-time {
    color: #667eea;
  }
  
  .separator {
    opacity: 0.5;
    margin: 0 5px;
  }
  
  .total-time {
    opacity: 0.7;
  }
  
  .playback-controls {
    display: flex;
    gap: 10px;
  }
  
  .btn {
    padding: 10px 15px;
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .btn:hover {
    background: rgba(255,255,255,0.2);
  }
  
  .btn-primary {
    background: linear-gradient(45deg, #667eea, #764ba2) !important;
  }
  
  .volume-control, .speed-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  input[type="range"] {
    width: 100px;
    accent-color: #667eea;
  }
  
  .meter-section {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .meters {
    height: 200px;
  }
  
  canvas.meter-canvas {
    height: 200px;
    border-radius: 4px;
  }
  
  .effects-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  
  .effect-slot {
    background: rgba(255,255,255,0.05);
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .btn-small {
    padding: 5px 10px;
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font-size: 0.8em;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .zoom-controls button {
    padding: 2px 8px;
    background: rgba(255,255,255,0.1);
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
</style>
