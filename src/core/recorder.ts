/**
 * WAAudio Recorder - 录音管理器
 * 
 * 支持麦克风录音、实时电平监控、WAV 导出
 */

// ============================================
// 类型定义
// ============================================

export interface RecorderConfig {
  /** 采样率 */
  sampleRate?: number;
  /** 声道数 */
  channels?: number;
  /** MIME 类型 */
  mimeType?: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  level: number;
}

// ============================================
// 录音器类
// ============================================

/**
 * WAAudioRecorder - 录音管理器
 * 
 * 使用示例：
 * ```typescript
 * const recorder = new WAAudioRecorder(context);
 * await recorder.start();
 * // ... 录音中
 * const blob = await recorder.stop();
 * recorder.download(blob, 'my-recording.wav');
 * ```
 */
export class WAAudioRecorder {
  private readonly context: AudioContext;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private analyser: AnalyserNode | null = null;
  private chunks: Blob[] = [];
  private startTime = 0;
  private pauseTime = 0;
  private _isRecording = false;
  private _isPaused = false;
  private animationId: number | null = null;
  private onLevelChange: ((level: number) => void) | null = null;
  
  // 音频缓冲区（用于 WAV 导出）
  private audioBuffer: Float32Array[] = [];
  private readonly channels: number;
  private readonly sampleRate: number;
  private readonly mimeType: string;
  
  constructor(context: AudioContext, config: RecorderConfig = {}) {
    this.context = context;
    this.channels = config.channels || 2;
    this.sampleRate = config.sampleRate || context.sampleRate;
    this.mimeType = config.mimeType || this._getSupportedMimeType();
  }
  
  // ============================================
  // 属性访问器
  // ============================================
  
  /** 是否正在录音 */
  get isRecording(): boolean {
    return this._isRecording;
  }
  
  /** 是否暂停 */
  get isPaused(): boolean {
    return this._isPaused;
  }
  
  /** 录音时长（秒） */
  get duration(): number {
    if (!this._isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }
  
  /** 当前电平 (0-1) */
  get level(): number {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    
    return Math.sqrt(sum / dataArray.length) / 255;
  }
  
  /** 电平变化回调 */
  set onLevelChange(callback: ((level: number) => void) | null) {
    this.onLevelChange = callback;
  }
  
  // ============================================
  // 录音控制
  // ============================================
  
  /**
   * 开始录音
   * 
   * @param options - 媒体设备选项
   */
  async start(options: MediaTrackConstraints = {}): Promise<void> {
    if (this._isRecording) {
      console.warn('[Recorder] 已经在录音中');
      return;
    }
    
    try {
      // 请求麦克风权限
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...options
        }
      });
      
      // 创建分析器（用于电平监控）
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.context.createMediaStreamSource(this.stream);
      source.connect(this.analyser);
      
      // 创建 MediaRecorder
      const mimeType = this._getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: this.sampleRate * this.channels * 16
      });
      
      this.chunks = [];
      this.audioBuffer = Array(this.channels).fill(null).map(() => new Float32Array());
      
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.chunks.push(e.data);
        }
      };
      
      // 开始录音
      this.mediaRecorder.start(100);
      this._isRecording = true;
      this._isPaused = false;
      this.startTime = Date.now();
      
      // 开始电平监控
      this._monitorLevel();
      
      console.log('[Recorder] 开始录音');
      
    } catch (error) {
      console.error('[Recorder] 无法获取麦克风:', error);
      throw error;
    }
  }
  
  /**
   * 停止录音
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this._isRecording || !this.mediaRecorder) {
        reject(new Error('没有在录音'));
        return;
      }
      
      // 停止电平监控
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      
      this.mediaRecorder.onstop = () => {
        const mimeType = this._getSupportedMimeType();
        const blob = new Blob(this.chunks, { type: mimeType });
        
        this._isRecording = false;
        this._isPaused = false;
        
        // 停止麦克风
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        console.log(`[Recorder] 录音结束，时长: ${this.duration.toFixed(1)}s`);
        resolve(blob);
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  /**
   * 暂停录音
   */
  pause(): void {
    if (!this._isRecording || this._isPaused) return;
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this._isPaused = true;
      this.pauseTime = Date.now();
      
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      
      console.log('[Recorder] 录音暂停');
    }
  }
  
  /**
   * 恢复录音
   */
  resume(): void {
    if (!this._isRecording || !this._isPaused) return;
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this._isPaused = false;
      this.startTime += Date.now() - this.pauseTime;
      
      this._monitorLevel();
      
      console.log('[Recorder] 录音恢复');
    }
  }
  
  /**
   * 取消录音
   */
  cancel(): void {
    if (this._isRecording && this.mediaRecorder) {
      this.mediaRecorder.stop();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this._isRecording = false;
    this._isPaused = false;
    this.chunks = [];
    this.audioBuffer = [];
    
    console.log('[Recorder] 录音已取消');
  }
  
  // ============================================
  // 文件导出
  // ============================================
  
  /**
   * 导出为 WAV 文件
   * 
   * @param blob - 录音 Blob
   * @param filename - 文件名
   */
  async exportWAV(blob: Blob, filename: string = 'recording.wav'): Promise<void> {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    
    const wavBlob = this._encodeWAV(audioBuffer);
    this._downloadBlob(wavBlob, filename);
  }
  
  /**
   * 导出为 WebM 文件
   */
  async exportWebM(filename: string = 'recording.webm'): Promise<void> {
    if (this.chunks.length === 0) {
      throw new Error('没有录音数据');
    }
    
    const mimeType = this._getSupportedMimeType();
    const blob = new Blob(this.chunks, { type: mimeType });
    this._downloadBlob(blob, filename);
  }
  
  /**
   * 获取录音 Blob
   */
  getBlob(): Blob | null {
    if (this.chunks.length === 0) return null;
    
    const mimeType = this._getSupportedMimeType();
    return new Blob(this.chunks, { type: mimeType });
  }
  
  /**
   * 获取录音 URL
   */
  getURL(): string | null {
    const blob = this.getBlob();
    return blob ? URL.createObjectURL(blob) : null;
  }
  
  // ============================================
  // 实用工具
  // ============================================
  
  /**
   * 获取录音状态
   */
  getState(): RecordingState {
    return {
      isRecording: this._isRecording,
      isPaused: this._isPaused,
      duration: this.duration,
      level: this.level
    };
  }
  
  /**
   * 格式化时间
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  // ============================================
  // 私有方法
  // ============================================
  
  /**
   * 电平监控
   */
  private _monitorLevel(): void {
    if (!this._isRecording || this._isPaused || !this.analyser) return;
    
    const monitor = () => {
      if (!this._isRecording || this._isPaused) return;
      
      const level = this.level;
      
      if (this.onLevelChange) {
        this.onLevelChange(level);
      }
      
      this.animationId = requestAnimationFrame(monitor);
    };
    
    monitor();
  }
  
  /**
   * 编码为 WAV
   */
  private _encodeWAV(audioBuffer: AudioBuffer): Blob {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const samples = audioBuffer.length;
    const bufferSize = 44 + samples * blockAlign;
    
    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);
    
    // WAV 文件头
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, samples * blockAlign, true);
    
    // 音频数据
    const offset = 44;
    const channelData: Float32Array[] = [];
    
    for (let i = 0; i < numChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    for (let i = 0; i < samples; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
      }
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
  }
  
  /**
   * 写入字符串
   */
  private _writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * 下载 Blob
   */
  private _downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  /**
   * 获取支持的 MIME 类型
   */
  private _getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mp3'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm';
  }
}

// ============================================
// 导出
// ============================================

export default WAAudioRecorder;
