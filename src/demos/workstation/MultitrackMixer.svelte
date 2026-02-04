<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WAAudioContext, { WAAudioMixer, WAAudioTrack, WAAudioSource } from '@core/index';
  
  // ============================================
  // 状态定义
  // ============================================
  
  let context: WAAudioContext;
  let mixer: WAAudioMixer;
  let analyser: AnalyserNode;
  
  // 轨道管理
  let tracks: Track[] = [];
  let nextTrackId = 1;
  
  // 轨道接口
  interface Track {
    id: number;
    name: string;
    source: WAAudioSource | null;
    volume: number;
    pan: number;
    muted: boolean;
    solo: boolean;
    color: string;
    waveformData: Float32Array | null;
  }
  
  // 播放状态
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let masterVolume = 1;
  
  // Canvas
  let timelineCanvas: HTMLCanvasElement;
  let timelineCtx: CanvasRenderingContext2D;
  let animationId: number;
  
  // 文件
  let selectedFile: File | null = null;
  
  // 快捷键
  const shortcuts: Map<string, () => void> = new Map();
  
  // ============================================
  // 生命周期
  // ============================================
  
  onMount(() => {
    context = new WAAudioContext();
    mixer = context.createMixer();
    analyser = mixer.masterAnalyser;
    
    timelineCtx = timelineCanvas.getContext('2d')!;
    
    _registerShortcuts();
    window.addEventListener('keydown', _handleKeydown);
    
    draw();
  });
  
  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    mixer.stopAll();
    mixer.destroy();
    context.suspend();
    window.removeEventListener('keydown', _handleKeydown);
  });
  
  // ============================================
  // 文件操作
  // ============================================
  
  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      selectedFile = target.files[0];
      await addTrack(selectedFile);
    }
  }
  
  async function addTrack(file: File) {
    const source = await context.createSource(file);
    const waveformData = await _extractWaveform(source);
    
    const track: Track = {
      id: nextTrackId++,
      name: file.name,
      source,
      volume: 1,
      pan: 0,
      muted: false,
      solo: false,
      color: _getRandomColor(),
      waveformData
    };
    
    // 更新时长
    if (source.duration > duration) {
      duration = source.duration;
    }
    
    tracks = [...tracks, track];
    drawTimeline();
  }
  
  function removeTrack(id: number) {
    const track = tracks.find(t => t.id === id);
    if (track) {
      track.source?.stop();
      mixer.removeTrack(id);
      tracks = tracks.filter(t => t.id !== id);
      drawTimeline();
    }
  }
  
  // ============================================
  // 播放控制
  // ============================================
  
  function play() {
    if (tracks.length === 0) return;
    
    tracks.forEach(track => {
      if (track.source && !track.muted) {
        track.source.setVolume(track.volume);
        track.source.play();
      }
    });
    
    isPlaying = true;
    animate();
  }
  
  function pause() {
    tracks.forEach(track => {
      if (track.source) {
        track.source.pause();
      }
    });
    isPlaying = false;
  }
  
  function stop() {
    tracks.forEach(track => {
      if (track.source) {
        track.source.stop();
      }
    });
    isPlaying = false;
    currentTime = 0;
  }
  
  function animate() {
    if (!isPlaying) return;
    
    currentTime = Math.min(currentTime + 0.016, duration);
    drawTimeline();
    
    if (currentTime >= duration) {
      stop();
    } else {
      animationId = requestAnimationFrame(animate);
    }
  }
  
  // ============================================
  // 轨道控制
  // ============================================
  
  function setTrackVolume(id: number, volume: number) {
    const track = tracks.find(t => t.id === id);
    if (track) {
      track.volume = volume;
      track.source?.setVolume(volume);
    }
  }
  
  function setTrackPan(id: number, pan: number) {
    const track = tracks.find(t => t.id === id);
    if (track) {
      track.pan = pan;
      // 更新声像
    }
  }
  
  function toggleMute(id: number) {
    const track = tracks.find(t => t.id === id);
    if (track) {
      track.muted = !track.muted;
      track.source?.setMute?.(track.muted);
    }
  }
  
  function toggleSolo(id: number) {
    const track = tracks.find(t => t.id === id);
    if (track) {
      track.solo = !track.solo;
      mixer.updateSoloState();
    }
  }
  
  function setMasterVolume(volume: number) {
    masterVolume = volume;
    mixer.setMasterVolume(volume);
  }
  
  // ============================================
  // 绘图
  // ============================================
  
  function draw() {
    drawTimeline();
  }
  
  function drawTimeline() {
    if (!timelineCtx) return;
    
    const width = timelineCanvas.width;
    const height = timelineCanvas.height;
    const trackHeight = 60;
    
    // 背景
    timelineCtx.fillStyle = '#1a1a2e';
    timelineCtx.fillRect(0, 0, width, height);
    
    // 时间线
    const timeScale = width / duration;
    const playheadX = currentTime * timeScale;
    
    // 播放头
    timelineCtx.strokeStyle = '#ff6b6b';
    timelineCtx.lineWidth = 2;
    timelineCtx.beginPath();
    timelineCtx.moveTo(playheadX, 0);
    timelineCtx.lineTo(playheadX, height);
    timelineCtx.stroke();
    
    // 绘制每个轨道
    tracks.forEach((track, index) => {
      const y = index * trackHeight;
      
      // 轨道背景
      timelineCtx.fillStyle = index % 2 === 0 ? '#252525' : '#2a2a2a';
      timelineCtx.fillRect(0, y, width, trackHeight);
      
      // 轨道名
      timelineCtx.fillStyle = '#e0e0e0';
      timelineCtx.font = '12px sans-serif';
      timelineCtx.fillText(track.name.substring(0, 20), 10, y + 20);
      
      // 波形
      if (track.waveformData) {
        const data = track.waveformData;
        const amp = (trackHeight - 20) / 2;
        const centerY = y + trackHeight / 2;
        
        timelineCtx.fillStyle = track.color;
        
        for (let i = 0; i < width; i++) {
          const dataIndex = Math.floor(i * (data.length / width));
          const amplitude = data[dataIndex] * amp;
          timelineCtx.fillRect(i, centerY - amplitude, 1, amplitude * 2);
        }
      }
      
      // 音量指示
      const volumeWidth = 50;
      timelineCtx.fillStyle = '#404040';
      timelineCtx.fillRect(width - volumeWidth - 10, y + 15, volumeWidth, 6);
      
      if (!track.muted) {
        const volumeHeight = (track.volume / 1) * 6;
        timelineCtx.fillStyle = track.color;
        timelineCtx.fillRect(width - volumeWidth - 10, y + 21 - volumeHeight, volumeWidth, volumeHeight);
      }
      
      // 轨道分隔线
      timelineCtx.strokeStyle = '#404040';
      timelineCtx.beginPath();
      timelineCtx.moveTo(0, y + trackHeight);
      timelineCtx.lineTo(width, y + trackHeight);
      timelineCtx.stroke();
    });
  }
  
  // ============================================
  // 工具函数
  // ============================================
  
  async function _extractWaveform(source: WAAudioSource): Promise<Float32Array> {
    const buffer = source.getBuffer?.();
    if (buffer) {
      return buffer.getChannelData(0);
    }
    return new Float32Array(0);
  }
  
  function _getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  function _registerShortcuts() {
    shortcuts.set(' ', () => isPlaying ? pause() : play());
    shortcuts.set('Escape', () => stop());
    shortcuts.set('ArrowLeft', () => currentTime = Math.max(0, currentTime - 5));
    shortcuts.set('ArrowRight', () => currentTime = Math.min(duration, currentTime + 5));
  }
  
  function _handleKeydown(e: KeyboardEvent) {
    const handler = shortcuts.get(e.key);
    if (handler && !(e.target as HTMLElement).matches('input')) {
      e.preventDefault();
      handler();
    }
  }
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="multitrack">
  <!-- 顶部工具栏 -->
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="logo">
        <span class="logo-icon">🎚️</span>
        <span class="logo-text">WAAudio</span>
        <span class="logo-version">Mixer</span>
      </div>
    </div>
    
    <div class="toolbar-center">
      <div class="file-info">
        <input type="file" accept="audio/*" on:change={handleFileSelect} id="file-input" hidden />
        <label for="file-input" class="file-btn">
          ➕ 添加音轨
        </label>
        <span class="track-count">{tracks.length} 音轨</span>
      </div>
    </div>
    
    <div class="toolbar-right">
      <div class="master-volume">
        <span>🔊</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={masterVolume} on:input={() => setMasterVolume(masterVolume)} />
        <span class="value">{Math.round(masterVolume * 100)}%</span>
      </div>
    </div>
  </header>
  
  <!-- 时间轴 -->
  <div class="timeline-container">
    <div class="time-display">
      <span class="current">{formatTime(currentTime)}</span>
      <span class="separator">/</span>
      <span class="total">{formatTime(duration)}</span>
    </div>
    
    <div class="timeline" bind:this={timelineCanvas}>
      <canvas bind:this={timelineCanvas} width="1200" height={tracks.length * 60 + 30}></canvas>
    </div>
  </div>
  
  <!-- 控制台 -->
  <div class="console-panel">
    <div class="transport-controls">
      <button class="transport-btn" on:click={() => currentTime = Math.max(0, currentTime - 5)}>⏪</button>
      <button class="transport-btn main" on:click={isPlaying ? pause : play}>
        {isPlaying ? '⏸️' : '▶️'}
      </button>
      <button class="transport-btn" on:click={stop}>⏹️</button>
      <button class="transport-btn" on:click={() => currentTime = Math.min(duration, currentTime + 5)}>⏩</button>
    </div>
    
    <div class="status">
      {#if isPlaying}
        <span class="status-playing">🔴 播放中</span>
      {:else}
        <span class="status-stopped">⚫ 已停止</span>
      {/if}
    </div>
    
    <div class="shortcut-hint">
      空格: 播放 | ←→: 快进
    </div>
  </div>
  
  <!-- 轨道列表 -->
  <div class="tracks-list">
    {#each tracks as track (track.id)}
      <div class="track-item" style="border-left-color: {track.color}">
        <div class="track-info">
          <span class="track-name">{track.name}</span>
          <span class="track-duration">{formatTime(duration)}</span>
        </div>
        
        <div class="track-controls">
          <!-- 音量 -->
          <div class="control-group">
            <span class="control-label">🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={track.volume}
              on:input={(e) => setTrackVolume(track.id, parseFloat(e.currentTarget.value))}
            />
            <span class="control-value">{Math.round(track.volume * 100)}%</span>
          </div>
          
          <!-- 声像 -->
          <div class="control-group">
            <span class="control-label">◀️</span>
            <input 
              type="range" 
              min="-1" 
              max="1" 
              step="0.1"
              value={track.pan}
              on:input={(e) => setTrackPan(track.id, parseFloat(e.currentTarget.value))}
            />
            <span class="control-value">{track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(Math.abs(track.pan) * 100)}`}</span>
          </div>
          
          <!-- 静音/独奏 -->
          <div class="control-buttons">
            <button 
              class="mute-btn" 
              class:active={track.muted}
              on:click={() => toggleMute(track.id)}
            >
              M
            </button>
            <button 
              class="solo-btn"
              class:active={track.solo}
              on:click={() => toggleSolo(track.id)}
            >
              S
            </button>
          </div>
          
          <!-- 删除 -->
          <button class="delete-btn" on:click={() => removeTrack(track.id)}>
            🗑️
          </button>
        </div>
      </div>
    {/each}
    
    {#if tracks.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🎵</span>
        <p>还没有音轨</p>
        <p class="empty-hint">点击"添加音轨"按钮导入音频文件</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .multitrack {
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
  
  .track-count {
    color: #888;
    font-size: 0.9em;
  }
  
  .master-volume {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .master-volume .value {
    min-width: 45px;
    color: #667eea;
    font-family: 'SF Mono', monospace;
  }
  
  input[type="range"] {
    accent-color: #667eea;
  }
  
  .timeline-container {
    padding: 20px;
  }
  
  .time-display {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 1.5em;
    background: #1a1a1a;
    padding: 10px 20px;
    border-radius: 8px;
    margin-bottom: 15px;
    display: inline-block;
  }
  
  .current { color: #4ecdc4; }
  .separator { color: #666; margin: 0 8px; }
  .total { color: #888; }
  
  .timeline {
    background: #252525;
    border-radius: 10px;
    overflow: hidden;
  }
  
  .console-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    padding: 20px;
    background: #252525;
    border-top: 1px solid #404040;
  }
  
  .transport-btn {
    width: 50px;
    height: 50px;
    border: none;
    border-radius: 50%;
    background: #404040;
    cursor: pointer;
    font-size: 1.3em;
  }
  
  .transport-btn:hover {
    background: #505050;
  }
  
  .transport-btn.main {
    background: linear-gradient(135deg, #667eea, #764ba2);
    width: 60px;
    height: 60px;
    font-size: 1.5em;
  }
  
  .status {
    font-size: 0.9em;
  }
  
  .status-playing { color: #4ecdc4; }
  .status-stopped { color: #666; }
  
  .shortcut-hint {
    color: #666;
    font-size: 0.8em;
  }
  
  .tracks-list {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .track-item {
    background: #252525;
    border-radius: 10px;
    padding: 15px 20px;
    border-left: 4px solid;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .track-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .track-name {
    font-weight: 500;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .track-duration {
    font-size: 0.8em;
    color: #888;
  }
  
  .track-controls {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  
  .control-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .control-label {
    font-size: 0.9em;
    color: #888;
  }
  
  .control-value {
    min-width: 40px;
    text-align: right;
    font-size: 0.8em;
    color: #667eea;
    font-family: 'SF Mono', monospace;
  }
  
  .control-buttons {
    display: flex;
    gap: 5px;
  }
  
  .mute-btn, .solo-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: #404040;
    color: #e0e0e0;
    cursor: pointer;
    font-weight: bold;
  }
  
  .mute-btn.active {
    background: #ff6b6b;
    color: white;
  }
  
  .solo-btn.active {
    background: #ffd93d;
    color: black;
  }
  
  .delete-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font-size: 1em;
  }
  
  .delete-btn:hover {
    background: #404040;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #888;
  }
  
  .empty-icon {
    font-size: 3em;
    display: block;
    margin-bottom: 15px;
  }
  
  .empty-hint {
    font-size: 0.9em;
    color: #666;
  }
</style>
