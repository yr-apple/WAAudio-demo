<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WAAudioContext from '@core/index';
  import { WAAudioEQ, WAAudioCompressor, WAAudioReverb, WAAudioDelay, WAAudioDistortion } from '@core/index';
  
  // ============================================
  // 状态定义
  // ============================================
  
  // 核心状态
  let context: WAAudioContext;
  let audioContext: AudioContext;
  let analyser: AnalyserNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let audioBuffer: AudioBuffer | null = null;
  
  // 播放状态
  let isPlaying = false;
  let isPaused = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let playbackRate = 1;
  let zoom = 1;
  let isLooping = false;
  let loopStart = 0;
  let loopEnd = 0;
  
  // 文件状态
  let selectedFile: File | null = null;
  let fileName = '';
  
  // Canvas 引用
  let waveformCanvas: HTMLCanvasElement;
  let spectrumCanvas: HTMLCanvasElement;
  let waveformCtx: CanvasRenderingContext2D;
  let spectrumCtx: CanvasRenderingContext2D;
  
  // 动画
  let animationId: number;
  let startTime = 0;
  let pauseOffset = 0;
  
  // 效果器实例
  let eq: WAAudioEQ | null = null;
  let compressor: WAAudioCompressor | null = null;
  let reverb: WAAudioReverb | null = null;
  let delay: WAAudioDelay | null = null;
  let distortion: WAAudioDistortion | null = null;
  
  // 效果器启用状态
  let eqEnabled = false;
  let compressorEnabled = false;
  let reverbEnabled = false;
  let delayEnabled = false;
  let distortionEnabled = false;
  
  // 效果器参数
  let eqLow = 0;
  let eqMid = 0;
  let eqHigh = 0;
  let compThreshold = -24;
  let compRatio = 12;
  let reverbMix = 0.3;
  let reverbSize = 0.5;
  let delayTime = 0.3;
  let delayFeedback = 0.4;
  let distortionAmount = 50;
  
  // 快捷键
  const shortcuts: Map<string, () => void> = new Map();
  
  // ============================================
  // 生命周期
  // ============================================
  
  onMount(() => {
    context = new WAAudioContext();
    audioContext = context.context;
    
    // 初始化分析器
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(audioContext.destination);
    
    // 初始化效果器
    eq = context.createEQ();
    compressor = context.createCompressor();
    reverb = context.createReverb();
    delay = context.createDelay();
    distortion = context.createDistortion();
    
    // Canvas 初始化
    waveformCtx = waveformCanvas.getContext('2d')!;
    spectrumCtx = spectrumCanvas.getContext('2d')!;
    
    // 注册快捷键
    _registerShortcuts();
    window.addEventListener('keydown', _handleKeydown);
    
    // 初始绘制
    draw();
  });
  
  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    if (source) source.stop();
    context.suspend();
    window.removeEventListener('keydown', _handleKeydown);
  });
  
  // ============================================
  // 文件操作
  // ============================================
  
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
  
  // ============================================
  // 播放控制
  // ============================================
  
  function play() {
    if (!audioBuffer) return;
    
    if (isPlaying) {
      pause();
      return;
    }
    
    _createSource();
    isPlaying = true;
    isPaused = false;
    startTime = audioContext.currentTime - pauseOffset / playbackRate;
    
    animate();
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
  
  function toggleLoop() {
    isLooping = !isLooping;
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
      _createSource();
    }
  }
  
  function skipBackward() {
    currentTime = Math.max(0, currentTime - 10);
    pauseOffset = currentTime;
    if (isPlaying) {
      source?.stop();
      _createSource();
    }
  }
  
  function skipForward() {
    currentTime = Math.min(duration, currentTime + 10);
    pauseOffset = currentTime;
    if (isPlaying) {
      source?.stop();
      _createSource();
    }
  }
  
  function _createSource() {
    source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = playbackRate;
    
    // 连接效果器链
    let lastNode: AudioNode = source;
    
    // 效果器链: Source -> EQ -> Compressor -> Reverb -> Delay -> Distortion -> Analyser -> Destination
    if (eqEnabled && eq) {
      lastNode.connect(eq.input);
      lastNode = eq.output;
    }
    
    if (compressorEnabled && compressor) {
      lastNode.connect(compressor.input);
      lastNode = compressor.output;
    }
    
    if (reverbEnabled && reverb) {
      lastNode.connect(reverb.input);
      lastNode = reverb.output;
    }
    
    if (delayEnabled && delay) {
      lastNode.connect(delay.input);
      lastNode = delay.output;
    }
    
    if (distortionEnabled && distortion) {
      lastNode.connect(distortion.input);
      lastNode = distortion.output;
    }
    
    // 连接到分析器和输出
    lastNode.connect(analyser!);
    
    source.start(0, currentTime);
    
    source.onended = () => {
      if (isLooping) {
        pauseOffset = loopStart;
        play();
      } else {
        stop();
      }
    };
  }
  
  // ============================================
  // 动画循环
  // ============================================
  
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
  
  // ============================================
  // 绘图
  // ============================================
  
  function draw() {
    drawWaveform();
    drawSpectrum();
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
    const samples = Math.min(data.length, width * zoom * 10);
    const step = Math.floor(data.length / samples);
    const amp = height / 2 * 0.9;
    const centerY = height / 2;
    
    // 波形
    waveformCtx.fillStyle = '#4ecdc4';
    
    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor(i * step);
      if (dataIndex >= data.length) break;
      
      const amplitude = data[dataIndex] * amp;
      waveformCtx.fillRect(i, centerY - amplitude, 1, amplitude * 2);
    }
    
    // 播放头
    const playheadX = (currentTime / duration) * width;
    waveformCtx.strokeStyle = '#ff6b6b';
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();
    waveformCtx.moveTo(playheadX, 0);
    waveformCtx.lineTo(playheadX, height);
    waveformCtx.stroke();
    
    // 循环区域
    if (isLooping) {
      const startX = (loopStart / duration) * width;
      const endX = (loopEnd / duration) * width;
      waveformCtx.fillStyle = 'rgba(255, 107, 107, 0.2)';
      waveformCtx.fillRect(startX, 0, endX - startX, height);
    }
  }
  
  function drawSpectrum() {
    if (!spectrumCtx || !analyser) return;
    
    const width = spectrumCanvas.width;
    const height = spectrumCanvas.height;
    
    spectrumCtx.fillStyle = '#1a1a2e';
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
  
  // ============================================
  // 效果器控制
  // ============================================
  
  function updateEQ() {
    if (!eq) return;
    eq.setLow(eqLow).setMid(eqMid).setHigh(eqHigh);
  }
  
  function updateCompressor() {
    if (!compressor) return;
    compressor.setThreshold(compThreshold).setRatio(compRatio);
  }
  
  function updateReverb() {
    if (!reverb) return;
    reverb.setRoomSize(reverbSize).setMix(reverbMix);
  }
  
  function updateDelay() {
    if (!delay) return;
    delay.setTime(delayTime).setFeedback(delayFeedback);
  }
  
  function updateDistortion() {
    if (!distortion) return;
    distortion.setAmount(distortionAmount);
  }
  
  function applyEQPreset(preset: 'bass' | 'vocal' | 'bright') {
    switch (preset) {
      case 'bass':
        eqLow = 6; eqMid = -2; eqHigh = -2;
        break;
      case 'vocal':
        eqLow = -2; eqMid = 4; eqHigh = 2;
        break;
      case 'bright':
        eqLow = -3; eqMid = 0; eqHigh = 6;
        break;
    }
    updateEQ();
  }
  
  // ============================================
  // 工具函数
  // ============================================
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  // ============================================
  // 快捷键
  // ============================================
  
  function _registerShortcuts() {
    shortcuts.set(' ', () => play());
    shortcuts.set('Escape', () => stop());
    shortcuts.set('l', () => toggleLoop());
    shortcuts.set('ArrowLeft', () => skipBackward());
    shortcuts.set('ArrowRight', () => skipForward());
  }
  
  function _handleKeydown(e: KeyboardEvent) {
    const handler = shortcuts.get(e.key);
    if (handler && !(e.target as HTMLElement).matches('input')) {
      e.preventDefault();
      handler();
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
      <span class="shortcut-hint">空格: 播放 | ←→: 快进 | L: 循环</span>
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
      <div class="transport-controls">
        <div class="time-display">
          <span class="current">{formatTime(currentTime)}</span>
          <span class="separator">/</span>
          <span class="total">{formatTime(duration)}</span>
        </div>
        
        <div class="buttons">
          <button class="transport-btn" on:click={skipBackward} title="后退10秒">⏪</button>
          <button class="transport-btn main" on:click={play}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button class="transport-btn" on:click={stop} title="停止">⏹️</button>
          <button class="transport-btn" on:click={skipForward} title="前进10秒">⏩</button>
          <button class="transport-btn" class:active={isLooping} on:click={toggleLoop} title="循环">🔁</button>
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
          <label>🔊</label>
          <input type="range" min="0" max="1" step="0.01" bind:value={volume} />
          <span class="value">{Math.round(volume * 100)}%</span>
        </div>
        <div class="slider-group">
          <label>🚀</label>
          <input type="range" min="0.25" max="2" step="0.25" bind:value={playbackRate} />
          <span class="value">{playbackRate}x</span>
        </div>
      </div>
    </div>
    
    <!-- 效果器机架 -->
    <div class="effects-rack">
      <div class="panel-header">
        <span>效果器</span>
      </div>
      
      <div class="effects-grid">
        <!-- EQ -->
        <div class="effect-unit" class:disabled={!eqEnabled}>
          <div class="effect-header">
            <span>🎚️ 均衡器</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={eqEnabled} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls">
            <div class="eq-band">
              <span>低</span>
              <input type="range" min="-12" max="12" bind:value={eqLow} on:input={updateEQ} orient="vertical" />
              <span class="db">{eqLow}dB</span>
            </div>
            <div class="eq-band">
              <span>中</span>
              <input type="range" min="-12" max="12" bind:value={eqMid} on:input={updateEQ} orient="vertical" />
              <span class="db">{eqMid}dB</span>
            </div>
            <div class="eq-band">
              <span>高</span>
              <input type="range" min="-12" max="12" bind:value={eqHigh} on:input={updateEQ} orient="vertical" />
              <span class="db">{eqHigh}dB</span>
            </div>
          </div>
          <div class="preset-buttons">
            <button on:click={() => applyEQPreset('bass')}>低音</button>
            <button on:click={() => applyEQPreset('vocal')}>人声</button>
            <button on:click={() => applyEQPreset('bright')}>明亮</button>
          </div>
        </div>
        
        <!-- Compressor -->
        <div class="effect-unit" class:disabled={!compressorEnabled}>
          <div class="effect-header">
            <span>🔊 压缩器</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={compressorEnabled} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls compact">
            <div class="param-row">
              <span>阈值</span>
              <input type="range" min="-60" max="0" bind:value={compThreshold} on:input={updateCompressor} />
              <span class="db">{compThreshold}dB</span>
            </div>
            <div class="param-row">
              <span>比率</span>
              <input type="range" min="1" max="20" bind:value={compRatio} on:input={updateCompressor} />
              <span class="db">{compRatio}:1</span>
            </div>
          </div>
        </div>
        
        <!-- Reverb -->
        <div class="effect-unit" class:disabled={!reverbEnabled}>
          <div class="effect-header">
            <span>🌊 混响</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={reverbEnabled} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls compact">
            <div class="param-row">
              <span>大小</span>
              <input type="range" min="0" max="1" step="0.1" bind:value={reverbSize} on:input={updateReverb} />
              <span class="db">{Math.round(reverbSize * 100)}%</span>
            </div>
            <div class="param-row">
              <span>混合</span>
              <input type="range" min="0" max="1" step="0.05" bind:value={reverbMix} on:input={updateReverb} />
              <span class="db">{Math.round(reverbMix * 100)}%</span>
            </div>
          </div>
        </div>
        
        <!-- Delay -->
        <div class="effect-unit" class:disabled={!delayEnabled}>
          <div class="effect-header">
            <span>⏱️ 延迟</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={delayEnabled} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls compact">
            <div class="param-row">
              <span>时间</span>
              <input type="range" min="0" max="1" step="0.05" bind:value={delayTime} on:input={updateDelay} />
              <span class="db">{Math.round(delayTime * 1000)}ms</span>
            </div>
            <div class="param-row">
              <span>反馈</span>
              <input type="range" min="0" max="0.9" step="0.05" bind:value={delayFeedback} on:input={updateDelay} />
              <span class="db">{Math.round(delayFeedback * 100)}%</span>
            </div>
          </div>
        </div>
        
        <!-- Distortion -->
        <div class="effect-unit" class:disabled={!distortionEnabled}>
          <div class="effect-header">
            <span>⚡ 失真</span>
            <label class="toggle">
              <input type="checkbox" bind:checked={distortionEnabled} />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="effect-controls compact">
            <div class="param-row single">
              <span>失真量</span>
              <input type="range" min="0" max="100" bind:value={distortionAmount} on:input={updateDistortion} />
              <span class="db">{distortionAmount}%</span>
            </div>
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
  
  .shortcut-hint {
    font-size: 0.8em;
    color: #666;
  }
  
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
  
  .current { color: #4ecdc4; }
  .separator { color: #666; margin: 0 8px; }
  .total { color: #888; }
  
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
  
  .transport-btn.active {
    background: #007acc;
  }
  
  .status {
    font-size: 0.85em;
  }
  
  .status-playing { color: #4ecdc4; }
  .status-paused { color: #f5a623; }
  .status-stopped { color: #666; }
  
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
  }
  
  .zoom-level {
    font-size: 0.85em;
    color: #888;
    min-width: 40px;
    text-align: center;
  }
  
  .effects-rack {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 15px;
  }
  
  .effects-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
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
  
  .effect-controls {
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    height: 80px;
  }
  
  .effect-controls.compact {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: auto;
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
  
  .eq-band .db {
    font-size: 0.65em;
    color: #667eea;
  }
  
  .eq-band input[type="range"] {
    writing-mode: bt-lr;
    -webkit-appearance: slider-vertical;
    width: 20px;
    height: 50px;
  }
  
  .param-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8em;
  }
  
  .param-row span:first-child {
    width: 40px;
    color: #888;
  }
  
  .param-row input[type="range"] {
    flex: 1;
    width: auto;
  }
  
  .param-row .db {
    width: 50px;
    text-align: right;
    color: #667eea;
    font-size: 0.85em;
  }
  
  .preset-buttons {
    display: flex;
    gap: 5px;
    margin-top: 10px;
  }
  
  .preset-buttons button {
    flex: 1;
    padding: 4px;
    font-size: 0.7em;
    background: #404040;
    border: none;
    border-radius: 4px;
    color: #e0e0e0;
    cursor: pointer;
  }
  
  .preset-buttons button:hover {
    background: #505050;
  }
</style>
