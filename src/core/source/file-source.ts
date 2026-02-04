/**
 * WAAudio Source - File Audio Source
 * 
 * 文件音频源类
 * 支持播放本地音频文件
 */

// ============================================
// 类型定义
// ============================================

export interface SourceOptions {
  /** 音量 (0-1) */
  volume?: number;
  /** 循环播放 */
  loop?: boolean;
  /** 自动播放 */
  autoplay?: boolean;
}

// ============================================
// 音频源类
// ============================================

/**
 * WAAudioSource - 文件音频源
 * 
 * 使用示例：
 * ```typescript
 * const source = new WAAudioSource(context, buffer);
 * source.connect(masterGain);
 * source.play();
 * ```
 */
export class WAAudioSource {
  /** 上下文 */
  private readonly _context: AudioContext;
  
  /** 音频缓冲区 */
  private readonly _buffer: AudioBuffer;
  
  /** 目标节点 */
  private _destination: AudioNode;
  
  /** 源节点 */
  private _sourceNode: AudioBufferSourceNode | null = null;
  
  /** 增益节点（音量控制） */
  private readonly _gainNode: GainNode;
  
  /** 播放状态 */
  private _isPlaying = false;
  
  /** 循环播放 */
  private _loop = false;
  
  /** 播放速率 */
  private _playbackRate = 1;
  
  /** 起始时间 */
  private _startTime = 0;
  
  /** 暂停位置 */
  private _pausePosition = 0;
  
  // ============================================
  // 构造函数
  // ============================================
  
  /**
   * @param context - AudioContext
   * @param buffer - 音频数据
   * @param destination - 目标节点
   * @param options - 选项
   */
  constructor(
    context: AudioContext,
    buffer: AudioBuffer,
    destination: AudioNode,
    options: SourceOptions = {}
  ) {
    this._context = context;
    this._buffer = buffer;
    this._destination = destination;
    
    // 创建增益节点
    this._gainNode = context.createGain();
    this._gainNode.gain.value = options.volume ?? 1;
    
    // 连接增益节点到目标
    this._gainNode.connect(destination);
    
    // 设置选项
    this._loop = options.loop ?? false;
    
    // 自动播放
    if (options.autoplay) {
      this.play();
    }
  }
  
  // ============================================
  // 属性访问器
  // ============================================
  
  /** 获取上下文 */
  get context(): AudioContext {
    return this._context;
  }
  
  /** 获取音频缓冲区 */
  get buffer(): AudioBuffer {
    return this._buffer;
  }
  
  /** 获取时长（秒） */
  get duration(): number {
    return this._buffer.duration;
  }
  
  /** 是否正在播放 */
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  
  /** 循环播放 */
  get loop(): boolean {
    return this._loop;
  }
  
  /** 播放速率 */
  get playbackRate(): number {
    return this._playbackRate;
  }
  
  /** 当前播放位置 */
  get currentTime(): number {
    if (this._isPlaying) {
      return (this._context.currentTime - this._startTime) * this._playbackRate + this._pausePosition;
    }
    return this._pausePosition;
  }
  
  /** 音量 */
  get volume(): number {
    return this._gainNode.gain.value;
  }
  
  /** 增益节点 */
  get gainNode(): GainNode {
    return this._gainNode;
  }
  
  // ============================================
  // 播放控制
  // ============================================
  
  /**
   * 播放
   * 
   * @param offset - 起始位置（秒）
   */
  play(offset?: number): void {
    // 如果正在播放，先停止
    this.stop();
    
    const startOffset = offset ?? this._pausePosition;
    
    // 创建新的源节点
    this._sourceNode = this._context.createBufferSource();
    this._sourceNode.buffer = this._buffer;
    this._sourceNode.loop = this._loop;
    this._sourceNode.playbackRate.value = this._playbackRate;
    
    // 连接节点
    this._sourceNode.connect(this._gainNode);
    
    // 播放
    this._sourceNode.start(0, startOffset);
    this._startTime = this._context.currentTime;
    this._isPlaying = true;
    
    // 监听播放结束
    this._sourceNode.onended = () => {
      if (this._loop) {
        this._pausePosition = 0;
        this.play();
      } else if (this._isPlaying) {
        this.stop();
      }
    };
  }
  
  /** 暂停 */
  pause(): void {
    if (this._isPlaying && this._sourceNode) {
      this._pausePosition = this.currentTime;
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
      this._isPlaying = false;
    }
  }
  
  /** 停止 */
  stop(): void {
    if (this._sourceNode) {
      this._sourceNode.stop();
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    this._isPlaying = false;
    this._pausePosition = 0;
  }
  
  /**
   * 跳转到指定位置
   * 
   * @param time - 目标时间（秒）
   */
  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this.duration));
    
    if (this._isPlaying) {
      this.play(clampedTime);
    } else {
      this._pausePosition = clampedTime;
    }
  }
  
  // ============================================
  // 状态设置
  // ============================================
  
  /** 设置音量 */
  setVolume(value: number): void {
    const clampedValue = Math.max(0, Math.min(value, 1));
    this._gainNode.gain.setTargetAtTime(clampedValue, this._context.currentTime, 0.01);
  }
  
  /** 设置循环 */
  setLoop(loop: boolean): void {
    this._loop = loop;
    if (this._sourceNode) {
      this._sourceNode.loop = loop;
    }
  }
  
  /** 设置播放速率 */
  setPlaybackRate(rate: number): void {
    const clampedRate = Math.max(0.25, Math.min(rate, 4));
    this._playbackRate = clampedRate;
    if (this._sourceNode) {
      this._sourceNode.playbackRate.value = clampedRate;
    }
  }
  
  // ============================================
  // 节点连接
  // ============================================
  
  /** 连接目标节点 */
  connect(destination: AudioNode): void {
    this._destination = destination;
    this._gainNode.disconnect();
    this._gainNode.connect(destination);
  }
  
  /** 断开连接 */
  disconnect(): void {
    this._gainNode.disconnect();
    this._destination = null;
  }
  
  // ============================================
  // 实用工具
  // ============================================
  
  /**
   * 淡入
   * 
   * @param duration - 淡入时长（秒）
   */
  fadeIn(duration: number = 0.5): void {
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(0, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(this._gainNode.gain.value, this._context.currentTime + duration);
  }
  
  /**
   * 淡出
   * 
   * @param duration - 淡出时长（秒）
   */
  fadeOut(duration: number = 0.5): void {
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(0, this._context.currentTime + duration);
  }
  
  /**
   * 渐变到指定音量
   * 
   * @param targetVolume - 目标音量
   * @param duration - 渐变时长（秒）
   */
  fadeTo(targetVolume: number, duration: number = 0.5): void {
    const clampedVolume = Math.max(0, Math.min(targetVolume, 1));
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(clampedVolume, this._context.currentTime + duration);
  }
  
  /**
   * 获取音频缓冲区副本
   */
  getBufferCopy(): AudioBuffer {
    const channels: Float32Array[] = [];
    
    for (let i = 0; i < this._buffer.numberOfChannels; i++) {
      channels.push(new Float32Array(this._buffer.getChannelData(i)));
    }
    
    const newBuffer = this._context.createBuffer(
      this._buffer.numberOfChannels,
      this._buffer.length,
      this._buffer.sampleRate
    );
    
    for (let i = 0; i < newBuffer.numberOfChannels; i++) {
      newBuffer.getChannelData(i).set(channels[i]);
    }
    
    return newBuffer;
  }
}

// ============================================
// 导出
// ============================================

export default WAAudioSource;
