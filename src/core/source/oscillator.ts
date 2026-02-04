/**
 * WAAudio Oscillator - 振荡器
 * 
 * 使用 Web Audio API 的振荡器节点
 * 生成正弦波、方波、锯齿波、三角波
 */

// ============================================
// 类型定义
// ============================================

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface OscillatorOptions {
  /** 频率 (Hz) */
  frequency?: number;
  /** 音量 (0-1) */
  volume?: number;
  /** 初始状态 */
  autoplay?: boolean;
}

// ============================================
// 振荡器类
// ============================================

/**
 * WAAudioOscillator - 振荡器
 * 
 * 使用示例：
 * ```typescript
 * const osc = new WAAudioOscillator(context, destination, 'sine', 440);
 * osc.play();
 * osc.setFrequency(880);
 * ```
 */
export class WAAudioOscillator {
  /** 上下文 */
  private readonly _context: AudioContext;
  
  /** 目标节点 */
  private _destination: AudioNode;
  
  /** 振荡器节点 */
  private readonly _oscillator: OscillatorNode;
  
  /** 增益节点 */
  private readonly _gainNode: GainNode;
  
  /** 当前频率 */
  private _frequency: number;
  
  /** 播放状态 */
  private _isPlaying = false;
  
  // ============================================
  // 构造函数
  // ============================================
  
  /**
   * @param context - AudioContext
   * @param destination - 目标节点
   * @param type - 波形类型
   * @param frequency - 初始频率 (Hz)
   * @param options - 选项
   */
  constructor(
    context: AudioContext,
    destination: AudioNode,
    type: OscillatorType = 'sine',
    frequency: number = 440,
    options: OscillatorOptions = {}
  ) {
    this._context = context;
    this._destination = destination;
    this._frequency = frequency;
    
    // 创建振荡器
    this._oscillator = context.createOscillator();
    this._oscillator.type = type;
    this._oscillator.frequency.value = frequency;
    
    // 创建增益节点
    this._gainNode = context.createGain();
    this._gainNode.gain.value = options.volume ?? 0.5;
    
    // 连接: Oscillator -> Gain -> Destination
    this._oscillator.connect(this._gainNode);
    this._gainNode.connect(destination);
    
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
  
  /** 获取振荡器节点 */
  get oscillator(): OscillatorNode {
    return this._oscillator;
  }
  
  /** 获取增益节点 */
  get gainNode(): GainNode {
    return this._gainNode;
  }
  
  /** 波形类型 */
  get type(): OscillatorType {
    return this._oscillator.type;
  }
  
  /** 频率 (Hz) */
  get frequency(): number {
    return this._frequency;
  }
  
  /** 音量 (0-1) */
  get volume(): number {
    return this._gainNode.gain.value;
  }
  
  /** 是否正在播放 */
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  
  // ============================================
  // 播放控制
  // ============================================
  
  /** 播放 */
  play(): void {
    if (!this._isPlaying) {
      this._oscillator.start();
      this._isPlaying = true;
    }
  }
  
  /** 停止 */
  stop(): void {
    if (this._isPlaying) {
      this._oscillator.stop();
      this._isPlaying = false;
    }
  }
  
  // ============================================
  // 频率控制
  // ============================================
  
  /** 设置频率 */
  setFrequency(frequency: number): void {
    this._frequency = frequency;
    this._oscillator.frequency.setValueAtTime(frequency, this._context.currentTime);
  }
  
  /** 频率渐变 */
  rampToFrequency(frequency: number, duration: number = 0.1): void {
    this._oscillator.frequency.cancelScheduledValues(this._context.currentTime);
    this._oscillator.frequency.setValueAtTime(this._frequency, this._context.currentTime);
    this._oscillator.frequency.exponentialRampToValueAtTime(frequency, this._context.currentTime + duration);
    this._frequency = frequency;
  }
  
  // ============================================
  // 音量控制
  // ============================================
  
  /** 设置音量 */
  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(volume, 1));
    this._gainNode.gain.setTargetAtTime(clampedVolume, this._context.currentTime, 0.01);
  }
  
  /** 渐变音量 */
  rampToVolume(volume: number, duration: number = 0.1): void {
    const clampedVolume = Math.max(0, Math.min(volume, 1));
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(clampedVolume, this._context.currentTime + duration);
  }
  
  // ============================================
  // 淡入淡出
  // ============================================
  
  /** 淡入 */
  fadeIn(duration: number = 0.5): void {
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(0, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(this._gainNode.gain.value, this._context.currentTime + duration);
  }
  
  /** 淡出并停止 */
  fadeOut(duration: number = 0.5): void {
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.setValueAtTime(this._gainNode.gain.value, this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(0, this._context.currentTime + duration);
    
    setTimeout(() => {
      this.stop();
    }, duration * 1000);
  }
  
  // ============================================
  // 节点连接
  // ============================================
  
  /** 连接到新的目标节点 */
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
   * 播放音符
   * 
   * @param note - 音符名 (如 'A4', 'C5')
   * @param duration - 持续时间（秒）
   */
  playNote(note: string, duration?: number): void {
    const freq = this.noteToFrequency(note);
    if (freq) {
      this.setFrequency(freq);
      this.play();
      
      if (duration) {
        this.fadeOut(duration);
      }
    }
  }
  
  /**
   * 音符转频率
   * 
   * @param note - 音符名 (如 'A4', 'C#5', 'Bb3')
   */
  static noteToFrequency(note: string): number {
    // 音符映射
    const notes: Record<string, number> = {
      'C0': 16.35, 'C#0': 17.32, 'Db0': 17.32, 'D0': 18.35, 'D#0': 19.45, 'Eb0': 19.45,
      'E0': 20.60, 'F0': 21.83, 'F#0': 23.12, 'Gb0': 23.12, 'G0': 24.50, 'G#0': 25.96,
      'Ab0': 25.96, 'A0': 27.50, 'A#0': 29.14, 'Bb0': 29.14, 'B0': 30.87,
      'C1': 32.70, 'C#1': 34.65, 'Db1': 34.65, 'D1': 36.71, 'D#1': 38.89, 'Eb1': 38.89,
      'E1': 41.20, 'F1': 43.65, 'F#1': 46.25, 'Gb1': 46.25, 'G1': 49.00, 'G#1': 51.91,
      'Ab1': 51.91, 'A1': 55.00, 'A#1': 58.27, 'Bb1': 58.27, 'B1': 61.74,
      'C2': 65.41, 'C#2': 69.30, 'Db2': 69.30, 'D2': 73.42, 'D#2': 77.78, 'Eb2': 77.78,
      'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'Gb2': 92.50, 'G2': 98.00, 'G#2': 103.83,
      'Ab2': 103.83, 'A2': 110.00, 'A#2': 116.54, 'Bb2': 116.54, 'B2': 123.47,
      'C3': 130.81, 'C#3': 138.59, 'Db3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'Eb3': 155.56,
      'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'Gb3': 185.00, 'G3': 196.00, 'G#3': 207.65,
      'Ab3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'Bb3': 233.08, 'B3': 246.94,
      'C4': 261.63, 'C#4': 277.18, 'Db4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'Eb4': 311.13,
      'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'Gb4': 369.99, 'G4': 392.00, 'G#4': 415.30,
      'Ab4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'Bb4': 466.16, 'B4': 493.88,
      'C5': 523.25, 'C#5': 554.37, 'Db5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'Eb5': 622.25,
      'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'Gb5': 739.99, 'G5': 783.99, 'G#5': 830.61,
      'Ab5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'Bb5': 932.33, 'B5': 987.77,
      'C6': 1046.50, 'C#6': 1108.73, 'Db6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'Eb6': 1244.51,
      'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'Gb6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22,
      'Ab6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'Bb6': 1864.66, 'B6': 1975.53,
      'C7': 2093.00, 'C#7': 2217.46, 'Db7': 2217.46, 'D7': 2349.32, 'D#7': 2489.02, 'Eb7': 2489.02,
      'E7': 2637.02, 'F7': 2793.83, 'F#7': 2959.96, 'Gb7': 2959.96, 'G7': 3135.96, 'G#7': 3322.44,
      'Ab7': 3322.44, 'A7': 3520.00, 'A#7': 3729.31, 'Bb7': 3729.31, 'B7': 3951.07,
      'C8': 4186.01
    };
    
    return notes[note] || 440; // 默认 A4
  }
  
  /**
   * 频率转音符
   * 
   * @param frequency - 频率 (Hz)
   */
  static frequencyToNote(frequency: number): string {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNum = 12 * (Math.log2(frequency / 440)) + 49;
    const octave = Math.floor((noteNum + 8) / 12);
    const noteIndex = Math.round(noteNum) % 12;
    return `${noteNames[noteIndex]}${octave}`;
  }
}

// ============================================
// 导出
// ============================================

export default WAAudioOscillator;
