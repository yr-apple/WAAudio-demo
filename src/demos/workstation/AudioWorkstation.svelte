<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WAAudioContext from '../core/index';
  
  // 状态
  let context: WAAudioContext;
  let audioContext: AudioContext;
  let analyser: AnalyserNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let audioBuffer: AudioBuffer | null = null;
  
  // UI 状态
  let isPlaying = false;
  let isPaused = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let playbackRate = 1;
  let zoom = 1;
  let loopStart = 0;
  let loopEnd = 0;
  let isLooping = false;
  
  // 文件
  let selectedFile: File | null = null;
  let fileName = '';
  
  // Canvas
  let waveformCanvas: HTMLCanvasElement;
  let spectrumCanvas: HTMLCanvasElement;
  let waveformCtx: CanvasRenderingContext2D;
  let spectrumCtx: CanvasRenderingContext2D;
  
  // 动画
  let animationId: number;
  let startTime = 0;
  let pauseOffset = 0;
  
  // 颜色主题
  const theme = {
    bg: '#1e1e1e',
    panel: '#2d2d2d',
    accent: '#007acc',
    accentHover: '#005a9e',
    waveform: '#4ecdc4',
    waveformBg: '#1a1a2e',
    spectrum: '#667eea',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#404040'
  };
  
  onMount(() => {
    context = new WAAudioContext();
    audioContext = context.getContext();
    
    waveformCtx = waveformCanvas.getContext('2d')!;
    spectrumCtx = spectrumCanvas.getContext('2d')!;
    
    // 初始化频谱
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(audioContext.destination);
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
    loopEnd = duration;
    currentTime = 0;
    pauseOffset = 0;
    drawWaveform();
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
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;
    
    source.connect(gainNode);
    gainNode.connect(analyser!);
    
    const startOffset = pauseOffset;
    source.start(0, startOffset);
    startTime = audioContext.currentTime - startOffset / playbackRate;
    
    isPlaying = true;
    isPaused = false;
    
    animate();
    
    source.onended = () => {
      if (isLooping) {
        pauseOffset = loopStart;
        play();
      } else if (playbackRate > 1) {
        pauseOffset = 0;
        play();
      } else {
        stop();
      }
    };
  }
  
  function pause() {
    if (source) {
      source.stop();
      pauseOffset = currentTime;
      source = null;
    }
    isPlaying = false;
    isPaused = true;
  }
  
  function stop() {
    if (source) {
      source.stop();
      source = null;
    }
    isPlaying = false;
    isPaused = false;
    currentTime = 0;
    pauseOffset = 0;
  }
  
  function seek(e: MouseEvent) {
    if (!audioBuffer) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    currentTime = ratio * duration;
    pauseOffset = currentTime;
    
    if (isPlaying) {
      source?.stop();
      play();
    }
  }
  
  function animate() {
    if (!isPlaying) return;
    
    currentTime = (audioContext.currentTime - startTime) * playbackRate;
    
    if (currentTime >= duration) {
      if (isLooping) {
        pauseOffset = loopStart;
        play();
      } else {
        stop();
      }
    }
    
    drawWaveform();
    drawSpectrum();
    animationId = requestAnimationFrame(animate);
  }
  
  function drawWaveform() {
    if (!waveformCtx || !audioBuffer) return;
    
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    // 背景
    waveformCtx.fillStyle = theme.waveformBg;
    waveformCtx.fillRect(0, 0, width, height);
    
    if (!audioBuffer) return;
    
    const data = audioBuffer.getChannelData(0);
    const samples = Math.min(data.length, width * zoom * 10);
    const step = Math.floor(data.length / samples);
    const amp = height / 2 * 0.9;
    const centerY = height / 2;
    
    // 绘制波形
    waveformCtx.strokeStyle = theme.waveform;
    waveformCtx.lineWidth = 1.5;
    waveformCtx.beginPath();
    
    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor(i * step);
      if (dataIndex >= data.length) break;
      
      const amplitude = data[dataIndex] * amp;
      waveformCtx.moveTo(i, centerY - amplitude);
      waveformCtx.lineTo(i, centerY + amplitude);
    }
    waveformCtx.stroke();
    
    // 中心线
    waveformCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    waveformCtx.lineWidth = 1;
    waveformCtx.beginPath();
    waveformCtx.moveTo(0, centerY);
    waveformCtx.lineTo(width, centerY);
    waveformCtx.stroke();
    
    // 播放头
    const playheadX = (currentTime / duration) * width;
    waveformCtx.strokeStyle = '#ff6b6b';
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();
    waveformCtx.moveTo(playheadX, 0);
    waveformCtx.lineTo(playheadX, height);
    waveformCtx.stroke();
    
    // 循环区域高亮
    if (isLooping) {
      const loopStartX = (loopStart / duration) * width;
      const loopEndX = (loopEnd / duration) * width;
      waveformCtx.fillStyle = 'rgba(255, 107, 107, 0.2)';
      waveformCtx.fillRect(loopStartX, 0, loopEndX - loopStartX, height);
    }
  }
  
  function drawSpectrum() {
    if (!spectrumCtx || !analyser) return;
    
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    
    spectrumCtx.fillStyle = theme.waveformBg;
    spectrumCtx.fillRect(0, 0, width, height);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    
    const barCount = 64;
    const barWidth = width / barCount;
    
    const gradient = spectrumCtx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(0.5, '#764ba2');
    gradient.addColorStop(1, '#f093fb');
    
    for (let i = 0; i < barCount; i++) {
      const value = dataArray[Math.floor(i * dataArray.length / barCount)];
      const barHeight = (value / 255) * height * 0.9;
      const x = i * barWidth;
      
      spectrumCtx.fillStyle = gradient;
      spectrumCtx.fillRect(x + 1, height - barHeight, barWidth - 2, barHeight);
    }
  }
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  function setVolume(e: Event) {
    volume = parseFloat((e.target as HTMLInputElement).value);
  }
  
  function setPlaybackRate(e: Event) {
    playbackRate = parseFloat((e.target as HTMLInputElement).value);
  }
  
  function toggleLoop() {
    isLooping = !isLooping;
  }
  
  function skipBackward() {
    currentTime = Math.max(0, currentTime - 10);
    pauseOffset = currentTime;
    if (isPlaying) {
      source?.stop();
      play();
    }
  }
  
  function skipForward() {
    currentTime = Math.min(duration, currentTime + 10);
    pauseOffset = currentTime;
    if (isPlaying) {
      source?.stop();
      play();
    }
  }
</script>

<div class="studio">
  <!-- 顶部工具栏 -->
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="logo">
        <span class="logo-icon">🎵</span>
        <span class="logo-text">WAAudio</span>
        <span class="logo-version">Studio</span>
      </div>
    </div>
    
    <div class="toolbar-center">
      <div class="file-info">
        <input type="file" accept="audio/*" on:change={handleFileSelect} id="file-input" hidden />
        <label for="file-input" class="file-btn">
          📂 打开文件
        </label>
        <span class="file-name">{fileName || '未选择音频文件'}</span>
      </div>
    </div>
    
    <div class="toolbar-right">
      <button class="tool-btn" title="导入">📥</button>
      <button class="tool-btn" title="导出">📤</button>
      <button class="tool-btn" title="设置">⚙️</button>
    </div>
  </header>
  
  <!-- 主工作区 -->
  <div class="workspace">
    <!-- 波形视图 -->
    <div class="waveform-panel">
      <div class="panel-header">
        <span>波形编辑器</span>
        <div class="zoom-controls">
          <button on:click={() => zoom = Math.max(0.25, zoom * 0.5)}>−</button>
          <span class="zoom-level">{Math.round(zoom * 100)}%</span>
          <button on:click={() => zoom = Math.min(4, zoom * 2)}>+</button>
        </div>
      </div>
      <div class="waveform-container" on:click={seek} role="slider" tabindex="0" aria-label="波形位置">
        <canvas bind:this={waveformCanvas} width="1400" height="120"></canvas>
      </div>
      <div class="time-ruler">
        <span>{formatTime(currentTime)}</span>
        <span class="ruler-center">{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
    
    <!-- 频谱视图 -->
    <div class="spectrum-panel">
      <div class="panel-header">
        <span>实时频谱</span>
      </div>
      <canvas bind:this={spectrumCanvas} width="1400" height="80"></canvas>
    </div>
    
    <!-- 控制台 -->
    <div class="console-panel">
      <!-- 播放控制 -->
      <div class="transport-controls">
        <div class="time-display">
          <span class="current">{formatTime(currentTime)}</span>
          <span class="separator">/</span>
          <span class="total">{formatTime(duration)}</span>
        </div>
        
        <div class="buttons">
          <button class="transport-btn" on:click={skipBackward} title="后退10秒">
            ⏪
          </button>
          <button class="transport-btn main" on:click={play}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button class="transport-btn" on:click={stop} title="停止">
            ⏹️
          </button>
          <button class="transport-btn" on:click={skipForward} title="前进10秒">
            ⏩
          </button>
          <button class="transport-btn loop" class:active={isLooping} on:click={toggleLoop} title="循环">
            🔁
          </button>
        </div>
        
        <div class="status">
          {#if isPlaying}
            <span class="status-playing">🔴 播放中</span>
          {:else if isPaused}
            <span class="status-paused">🟡 已暂停</span>
          {:else}
            <span class="status-stopped">⚫ 已停止</span>
          {/if}
        </div>
      </div>
      
      <!-- 音量/速度 -->
      <div class="sliders">
        <div class="slider-group">
          <label>🔊 音量</label>
          <input type="range" min="0" max="1" step="0.01" {volume} on:input={setVolume} />
          <span class="value">{Math.round(volume * 100)}%</span>
        </div>
        <div class="slider-group">
          <label>🚀 速度</label>
          <input type="range" min="0.25" max="2" step="0.25" {playbackRate} on:input={setPlaybackRate} />
          <span class="value">{playbackRate}x</span>
        </div>
      </div>
    </div>
    
    <!-- 效果器插槽 -->
    <div class="effects-rack">
      <div class="panel-header">
        <span>效果器</span>
        <button class="add-effect-btn">+ 添加效果</button>
      </div>
      <div class="effects-grid">
        <div class="effect-unit">
          <div class="effect-header">
            <span>🎚️ 均衡器</span>
            <label class="toggle">
              <input type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls">
            <div class="eq-band">
              <span>低</span>
              <input type="range" min="-12" max="12" value="0" orient="vertical" />
            </div>
            <div class="eq-band">
              <span>中</span>
              <input type="range" min="-12" max="12" value="0" orient="vertical" />
            </div>
            <div class="eq-band">
              <span>高</span>
              <input type="range" min="-12" max="12" value="0" orient="vertical" />
            </div>
          </div>
        </div>
        
        <div class="effect-unit disabled">
          <div class="effect-header">
            <span>🔊 压缩器</span>
            <label class="toggle">
              <input type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-content">
            <span class="placeholder">未加载</span>
          </div>
        </div>
        
        <div class="effect-unit disabled">
          <div class="effect-header">
            <span>🌊 混响</span>
            <label class="toggle">
              <input type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-content">
            <span class="placeholder">未加载</span>
          </div>
        </div>
        
        <div class="effect-unit disabled">
          <div class="effect-header">
            <span>⏱️ 延迟</span>
            <label class="toggle">
              <input type="checkbox" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-content">
            <span class="placeholder">未加载</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .studio {
    background: #1e1e1e;
    min-height: 100vh;
    color: #e0e0e0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  /* 工具栏 */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: #252525;
    border-bottom: 1px solid #404040;
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .logo-icon {
    font-size: 1.5em;
  }
  
  .logo-text {
    font-size: 1.2em;
    font-weight: bold;
    background: linear-gradient(45deg, #667eea, #764ba2);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  
  .logo-version {
    font-size: 0.7em;
    padding: 2px 6px;
    background: #404040;
    border-radius: 4px;
    margin-left: 5px;
  }
  
  .file-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .file-btn {
    padding: 8px 16px;
    background: #007acc;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background 0.2s;
  }
  
  .file-btn:hover {
    background: #005a9e;
  }
  
  .file-name {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #888;
    font-size: 0.9em;
  }
  
  .tool-btn {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid #404040;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1em;
    transition: all 0.2s;
  }
  
  .tool-btn:hover {
    background: #404040;
  }
  
  /* 工作区 */
  .workspace {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    font-weight: 500;
    color: #e0e0e0;
  }
  
  /* 波形面板 */
  .waveform-panel, .spectrum-panel {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 15px;
  }
  
  .waveform-container {
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
  }
  
  .waveform-container:hover {
    box-shadow: 0 0 0 2px #007acc;
  }
  
  canvas {
    display: block;
    width: 100%;
    border-radius: 6px;
  }
  
  .time-ruler {
    display: flex;
    justify-content: space-between;
    padding: 8px 0 0;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.8em;
    color: #888;
  }
  
  .ruler-center {
    opacity: 0.5;
  }
  
  /* 控制台 */
  .console-panel {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .transport-controls {
    display: flex;
    align-items: center;
    gap: 25px;
  }
  
  .time-display {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 1.3em;
    background: #1a1a1a;
    padding: 10px 20px;
    border-radius: 8px;
  }
  
  .current {
    color: #4ecdc4;
  }
  
  .separator {
    color: #666;
    margin: 0 8px;
  }
  
  .total {
    color: #888;
  }
  
  .buttons {
    display: flex;
    gap: 8px;
  }
  
  .transport-btn {
    width: 45px;
    height: 45px;
    border: none;
    border-radius: 50%;
    background: #404040;
    cursor: pointer;
    font-size: 1.2em;
    transition: all 0.2s;
  }
  
  .transport-btn:hover {
    background: #505050;
    transform: scale(1.05);
  }
  
  .transport-btn.main {
    width: 55px;
    height: 55px;
    background: linear-gradient(135deg, #667eea, #764ba2);
    font-size: 1.5em;
  }
  
  .transport-btn.main:hover {
    transform: scale(1.08);
  }
  
  .transport-btn.active {
    background: #007acc;
  }
  
  .status {
    font-size: 0.85em;
  }
  
  .status-playing {
    color: #4ecdc4;
  }
  
  .status-paused {
    color: #f5a623;
  }
  
  .status-stopped {
    color: #666;
  }
  
  .sliders {
    display: flex;
    gap: 30px;
  }
  
  .slider-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .slider-group label {
    color: #888;
    font-size: 0.9em;
  }
  
  input[type="range"] {
    width: 120px;
    accent-color: #667eea;
  }
  
  .value {
    min-width: 45px;
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.9em;
    color: #667eea;
  }
  
  /* 缩放控制 */
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .zoom-controls button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: #404040;
    color: #e0e0e0;
    cursor: pointer;
    font-size: 1.1em;
    transition: background 0.2s;
  }
  
  .zoom-controls button:hover {
    background: #505050;
  }
  
  .zoom-level {
    font-size: 0.85em;
    color: #888;
    min-width: 40px;
    text-align: center;
  }
  
  /* 效果器 */
  .effects-rack {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 15px;
  }
  
  .add-effect-btn {
    padding: 6px 12px;
    background: #404040;
    border: none;
    border-radius: 6px;
    color: #e0e0e0;
    cursor: pointer;
    font-size: 0.85em;
    transition: background 0.2s;
  }
  
  .add-effect-btn:hover {
    background: #505050;
  }
  
  .effects-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 15px;
    margin-top: 10px;
  }
  
  .effect-unit {
    background: #252525;
    border-radius: 8px;
    padding: 15px;
    border: 1px solid #404040;
  }
  
  .effect-unit.disabled {
    opacity: 0.5;
  }
  
  .effect-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  /* 开关 */
  .toggle {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }
  
  .toggle input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  
  .toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #404040;
    transition: 0.3s;
    border-radius: 20px;
  }
  
  .toggle-slider:before {
    position: absolute;
    content: "";
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
  }
  
  .toggle input:checked + .toggle-slider {
    background-color: #007acc;
  }
  
  .toggle input:checked + .toggle-slider:before {
    transform: translateX(16px);
  }
  
  /* EQ 控制 */
  .effect-controls {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 60px;
  }
  
  .eq-band {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }
  
  .eq-band span {
    font-size: 0.7em;
    color: #888;
  }
  
  .eq-band input[type="range"] {
    writing-mode: bt-lr;
    -webkit-appearance: slider-vertical;
    width: 20px;
    height: 50px;
  }
  
  .effect-content {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 60px;
  }
  
  .placeholder {
    color: #666;
    font-size: 0.9em;
  }
</style>
