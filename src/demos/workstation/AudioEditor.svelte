<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import WAAudioContext, { WAAudioEditor, WAAudioMarkers, exportWAV, WAAudioEQ, WAAudioCompressor, WAAudioReverb, WAAudioDelay, WAAudioDistortion } from '@core/index';
  
  // ============================================
  // 状态定义
  // ============================================
  
  let context: WAAudioContext;
  let audioContext: AudioContext;
  let editor: WAAudioEditor | null = null;
  let markers: WAAudioMarkers;
  let audioBuffer: AudioBuffer | null = null;
  
  // 播放状态
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let playbackRate = 1;
  let zoom = 1;
  let isLooping = false;
  
  // 选区状态
  let selectionStart = 0;
  let selectionEnd = 0;
  let hasSelection = false;
  
  // 编辑历史
  let canUndo = false;
  let canRedo = false;
  
  // 文件状态
  let fileName = '';
  
  // Canvas
  let waveformCanvas: HTMLCanvasElement;
  let waveformCtx: CanvasRenderingContext2D;
  
  // 动画
  let animationId: number;
  
  // 效果器
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
  let eqLow = 0, eqMid = 0, eqHigh = 0;
  let compThreshold = -24, compRatio = 12;
  let reverbMix = 0.3, reverbSize = 0.5;
  let delayTime = 0.3, delayFeedback = 0.4;
  let distortionAmount = 50;
  
  // ============================================
  // 生命周期
  // ============================================
  
  onMount(() => {
    context = new WAAudioContext();
    audioContext = context.context;
    markers = new WAAudioMarkers();
    
    waveformCtx = waveformCanvas.getContext('2d')!;
    
    // 初始化效果器
    eq = context.createEQ();
    compressor = context.createCompressor();
    reverb = context.createReverb();
    delay = context.createDelay();
    distortion = context.createDistortion();
    
    // 标记变化监听
    markers.onChanged(drawWaveform);
    
    // 键盘快捷键
    window.addEventListener('keydown', handleKeydown);
    
    drawWaveform();
  });
  
  onDestroy(() => {
    if (animationId) cancelAnimationFrame(animationId);
    context.suspend();
    window.removeEventListener('keydown', handleKeydown);
  });
  
  // ============================================
  // 文件操作
  // ============================================
  
  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      fileName = file.name;
      await loadAudio(file);
    }
  }
  
  async function loadAudio(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    editor = new WAAudioEditor(audioContext, audioBuffer);
    duration = audioBuffer.duration;
    markers = new WAAudioMarkers(duration);
    currentTime = 0;
    selectionStart = 0;
    selectionEnd = 0;
    hasSelection = false;
    drawWaveform();
  }
  
  // ============================================
  // 播放控制
  // ============================================
  
  function play() {
    if (!audioBuffer || !editor) return;
    
    if (isPlaying) {
      pause();
      return;
    }
    
    isPlaying = true;
    animate();
  }
  
  function pause() {
    isPlaying = false;
    if (animationId) cancelAnimationFrame(animationId);
  }
  
  function stop() {
    isPlaying = false;
    currentTime = 0;
    if (animationId) cancelAnimationFrame(animationId);
    drawWaveform();
  }
  
  function toggleLoop() {
    isLooping = !isLooping;
  }
  
  function animate() {
    if (!isPlaying) return;
    
    currentTime += 0.016;
    if (currentTime >= duration) {
      if (isLooping) {
        currentTime = 0;
      } else {
        stop();
        return;
      }
    }
    
    drawWaveform();
    animationId = requestAnimationFrame(animate);
  }
  
  // ============================================
  // 波形绘制
  // ============================================
  
  function drawWaveform() {
    if (!waveformCtx || !audioBuffer) return;
    
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    // 背景
    waveformCtx.fillStyle = '#1a1a2e';
    waveformCtx.fillRect(0, 0, width, height);
    
    // 网格
    drawGrid();
    
    // 波形
    const data = audioBuffer.getChannelData(0);
    const samples = Math.min(data.length, width * zoom * 10);
    const step = Math.floor(data.length / samples);
    const amp = height / 2 * 0.8;
    const centerY = height / 2;
    
    // 波形
    waveformCtx.fillStyle = '#4ecdc4';
    for (let i = 0; i < width; i++) {
      const dataIndex = Math.floor(i * step);
      if (dataIndex >= data.length) break;
      
      const amplitude = data[dataIndex] * amp;
      waveformCtx.fillRect(i, centerY - amplitude, 1, amplitude * 2);
    }
    
    // 选区高亮
    if (hasSelection) {
      const startX = (selectionStart / duration) * width;
      const endX = (selectionEnd / duration) * width;
      waveformCtx.fillStyle = 'rgba(255, 107, 107, 0.2)';
      waveformCtx.fillRect(startX, 0, endX - startX, height);
    }
    
    // 播放头
    const playheadX = (currentTime / duration) * width;
    waveformCtx.strokeStyle = '#ff6b6b';
    waveformCtx.lineWidth = 2;
    waveformCtx.beginPath();
    waveformCtx.moveTo(playheadX, 0);
    waveformCtx.lineTo(playheadX, height);
    waveformCtx.stroke();
    
    // 标记点
    drawMarkers();
  }
  
  function drawGrid() {
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    waveformCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    waveformCtx.lineWidth = 1;
    
    // 垂直线（每5秒）
    for (let t = 0; t <= duration; t += 5) {
      const x = (t / duration) * width;
      waveformCtx.beginPath();
      waveformCtx.moveTo(x, 0);
      waveformCtx.lineTo(x, height);
      waveformCtx.stroke();
    }
  }
  
  function drawMarkers() {
    const width = waveformCanvas.width;
    const height = waveformCanvas.height;
    
    markers.all.forEach(marker => {
      const x = (marker.time / duration) * width;
      
      waveformCtx.strokeStyle = marker.color;
      waveformCtx.lineWidth = 2;
      waveformCtx.beginPath();
      waveformCtx.moveTo(x, 0);
      waveformCtx.lineTo(x, height);
      waveformCtx.stroke();
      
      // 标记标签
      waveformCtx.fillStyle = marker.color;
      waveformCtx.font = '10px sans-serif';
      waveformCtx.fillText(marker.name, x + 2, 12);
    });
  }
  
  // ============================================
  // 鼠标交互
  // ============================================
  
  function handleWaveformClick(e: MouseEvent) {
    if (!audioBuffer) return;
    
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    if (e.shiftKey) {
      // 按住 Shift 添加选区
      if (!hasSelection) {
        selectionStart = currentTime;
        selectionEnd = time;
        hasSelection = true;
      } else {
        if (time < selectionStart) {
          selectionStart = time;
        } else {
          selectionEnd = time;
        }
      }
    } else {
      // 点击跳转
      currentTime = time;
      hasSelection = false;
    }
    
    drawWaveform();
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (!(e.target as HTMLElement).matches('input')) {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          play();
          break;
        case 'Escape':
          stop();
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) {
              editor?.redo();
            } else {
              editor?.undo();
            }
          }
          break;
      }
    }
  }
  
  // ============================================
  // 编辑操作
  // ============================================
  
  function cut() {
    if (!editor || !hasSelection) return;
    editor.cut(selectionStart, selectionEnd);
    updateAfterEdit();
  }
  
  function copy() {
    if (!editor || !hasSelection) return;
    editor.copy(selectionStart, selectionEnd);
  }
  
  function deleteSelection() {
    if (!editor || !hasSelection) return;
    editor.delete(selectionStart, selectionEnd);
    updateAfterEdit();
  }
  
  function silence() {
    if (!editor || !hasSelection) return;
    editor.silence(selectionStart, selectionEnd);
    drawWaveform();
  }
  
  function fadeIn() {
    if (!editor || !hasSelection) return;
    editor.fadeIn(selectionStart, selectionEnd - selectionStart);
    drawWaveform();
  }
  
  function fadeOut() {
    if (!editor || !hasSelection) return;
    editor.fadeOut(selectionStart, selectionEnd - selectionStart);
    drawWaveform();
  }
  
  function normalize() {
    if (!editor) return;
    editor.normalize();
    drawWaveform();
  }
  
  function reverse() {
    if (!editor || !hasSelection) return;
    editor.reverse(selectionStart, selectionEnd);
    drawWaveform();
  }
  
  function undo() {
    if (editor?.undo()) {
      updateAfterEdit();
    }
  }
  
  function redo() {
    if (editor?.redo()) {
      updateAfterEdit();
    }
  }
  
  function updateAfterEdit() {
    if (!editor) return;
    audioBuffer = editor.buffer;
    duration = audioBuffer.duration;
    markers.duration = duration;
    currentTime = 0;
    hasSelection = false;
    drawWaveform();
  }
  
  function clearSelection() {
    hasSelection = false;
    drawWaveform();
  }
  
  function selectAll() {
    if (!audioBuffer) return;
    selectionStart = 0;
    selectionEnd = duration;
    hasSelection = true;
    drawWaveform();
  }
  
  // ============================================
  // 标记操作
  // ============================================
  
  function addMarker() {
    if (!audioBuffer) return;
    const name = prompt('标记名称:', `Marker ${markers.count + 1}`);
    if (name) {
      markers.add(name, currentTime);
    }
  }
  
  function addInPoint() {
    markers.setIn(currentTime);
  }
  
  function addOutPoint() {
    markers.setOut(currentTime);
  }
  
  function jumpToPrevMarker() {
    const time = markers.jumpToPrev(currentTime);
    if (time !== null) currentTime = time;
    drawWaveform();
  }
  
  function jumpToNextMarker() {
    const time = markers.jumpToNext(currentTime);
    if (time !== null) currentTime = time;
    drawWaveform();
  }
  
  // ============================================
  // 导出
  // ============================================
  
  function exportWav() {
    if (!editor) return;
    exportWAV(editor.toBuffer(), `${fileName.replace(/\.[^.]+$/, '')}.wav`);
  }
  
  // ============================================
  // 工具函数
  // ============================================
  
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
</script>

<div class="editor">
  <!-- 顶部工具栏 -->
  <header class="toolbar">
    <div class="toolbar-left">
      <div class="logo">
        <span class="logo-icon">🎵</span>
        <span class="logo-text">WAAudio</span>
        <span class="logo-version">Editor</span>
      </div>
    </div>
    
    <div class="toolbar-center">
      <div class="file-info">
        <input type="file" accept="audio/*" on:change={handleFileSelect} id="file-input" hidden />
        <label for="file-input" class="file-btn">📂 打开</label>
        <span class="file-name">{fileName || '未打开文件'}</span>
      </div>
    </div>
    
    <div class="toolbar-right">
      <button class="tool-btn" on:click={exportWav} title="导出 WAV">💾 导出</button>
    </div>
  </header>
  
  <!-- 主工作区 -->
  <div class="workspace">
    <!-- 波形编辑区 -->
    <div class="waveform-section">
      <div class="section-header">
        <span>波形编辑器</span>
        <div class="zoom-controls">
          <button on:click={() => zoom = Math.max(0.25, zoom * 0.5)}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button on:click={() => zoom = Math.min(4, zoom * 2)}>+</button>
        </div>
      </div>
      <div class="waveform-container" on:click={handleWaveformClick} role="button" tabindex="0">
        <canvas bind:this={waveformCanvas} width="1400" height="150"></canvas>
      </div>
      <div class="time-ruler">
        <span>{formatTime(currentTime)}</span>
        <span class="center">{formatTime(duration / 2)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
    
    <!-- 标记区 -->
    <div class="markers-section">
      <div class="section-header">
        <span>标记点</span>
        <div class="marker-buttons">
          <button on:click={addMarker} title="添加标记">➕ 标记</button>
          <button on:click={addInPoint} title="设置入点">📍 In</button>
          <button on:click={addOutPoint} title="设置出点">📍 Out</button>
          <button on:click={jumpToPrevMarker} title="上一个标记">⏮</button>
          <button on:click={jumpToNextMarker} title="下一个标记">⏭</button>
        </div>
      </div>
      <div class="markers-list">
        {#each markers.all as marker}
          <div class="marker-item" style="border-left-color: {marker.color}">
            <span class="marker-name">{marker.name}</span>
            <span class="marker-time">{formatTime(marker.time)}</span>
          </div>
        {/each}
        {#if markers.count === 0}
          <div class="empty-markers">暂无标记</div>
        {/if}
      </div>
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
          <button class="transport-btn" on:click={() => currentTime = Math.max(0, currentTime - 5)}>⏪</button>
          <button class="transport-btn main" on:click={play}>
            {isPlaying ? '⏸️' : '▶️'}
          </button>
          <button class="transport-btn" on:click={stop}>⏹️</button>
          <button class="transport-btn" class:active={isLooping} on:click={toggleLoop}>🔁</button>
        </div>
        
        <div class="status">
          {#if isPlaying}
            <span class="status-playing">🔴</span>
          {:else}
            <span class="status-stopped">⚫</span>
          {/if}
          {#if hasSelection}
            <span class="selection-info">选区: {formatTime(selectionStart)} - {formatTime(selectionEnd)}</span>
          {/if}
        </div>
      </div>
      
      <!-- 编辑控制 -->
      <div class="edit-controls">
        <button on:click={undo} disabled={!canUndo}>↩️ 撤销</button>
        <button on:click={redo} disabled={!canRedo}>↪️ 重做</button>
        <span class="divider">|</span>
        <button on:click={selectAll}>全选</button>
        <button on:click={clearSelection}>清除</button>
        <span class="divider">|</span>
        <button on:click={cut} disabled={!hasSelection}>✂️ 剪切</button>
        <button on:click={copy} disabled={!hasSelection}>📋 复制</button>
        <button on:click={deleteSelection} disabled={!hasSelection}>🗑️ 删除</button>
        <button on:click={silence} disabled={!hasSelection}>🔇 静音</button>
        <span class="divider">|</span>
        <button on:click={fadeIn} disabled={!hasSelection}>📈 淡入</button>
        <button on:click={fadeOut} disabled={!hasSelection}>📉 淡出</button>
        <button on:click={normalize}>📊 归一化</button>
        <button on:click={reverse} disabled={!hasSelection}>🔄 反转</button>
      </div>
      
      <!-- 音量 -->
      <div class="volume-control">
        <span>🔊</span>
        <input type="range" min="0" max="1" step="0.01" bind:value={volume} />
        <span>{Math.round(volume * 100)}%</span>
      </div>
    </div>
  </div>
</div>

<style>
  .editor {
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
  }
  
  .file-name {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #888;
  }
  
  .tool-btn {
    padding: 8px 16px;
    background: #404040;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  
  .workspace {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
  }
  
  .waveform-section, .markers-section {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 15px;
  }
  
  .waveform-container {
    cursor: pointer;
    border-radius: 6px;
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
    font-family: 'SF Mono', monospace;
    font-size: 0.8em;
    color: #888;
  }
  
  .time-ruler .center {
    opacity: 0.5;
  }
  
  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  
  .zoom-controls button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: #404040;
    cursor: pointer;
  }
  
  .zoom-controls span {
    min-width: 40px;
    text-align: center;
    font-size: 0.85em;
    color: #888;
  }
  
  .markers-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    max-height: 100px;
    overflow-y: auto;
  }
  
  .marker-item {
    background: #252525;
    padding: 5px 10px;
    border-radius: 6px;
    border-left: 3px solid;
    font-size: 0.85em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .marker-time {
    color: #888;
    font-size: 0.9em;
  }
  
  .empty-markers {
    color: #666;
    font-size: 0.9em;
  }
  
  .marker-buttons {
    display: flex;
    gap: 5px;
  }
  
  .marker-buttons button {
    padding: 5px 10px;
    background: #404040;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
  }
  
  .console-panel {
    background: #2d2d2d;
    border-radius: 10px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .transport-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 25px;
  }
  
  .time-display {
    font-family: 'SF Mono', monospace;
    font-size: 1.2em;
    background: #1a1a1a;
    padding: 8px 16px;
    border-radius: 8px;
  }
  
  .current { color: #4ecdc4; }
  .separator { color: #666; margin: 0 5px; }
  .total { color: #888; }
  
  .buttons {
    display: flex;
    gap: 8px;
  }
  
  .transport-btn {
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: #404040;
    cursor: pointer;
  }
  
  .transport-btn.main {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #667eea, #764ba2);
  }
  
  .transport-btn.active {
    background: #007acc;
  }
  
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9em;
  }
  
  .selection-info {
    color: #f5a623;
  }
  
  .edit-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    flex-wrap: wrap;
  }
  
  .edit-controls button {
    padding: 6px 12px;
    background: #404040;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85em;
  }
  
  .edit-controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .divider {
    color: #404040;
    margin: 0 5px;
  }
  
  .volume-control {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  
  input[type="range"] {
    width: 100px;
    accent-color: #667eea;
  }
</style>
