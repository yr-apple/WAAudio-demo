/**
 * WAAudio Core - Web Audio API Wrapper
 */

export class WAAudioContext {
  private context: AudioContext;
  private masterGain: GainNode;
  private compressor: DynamicsCompressorNode;

  constructor() {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.compressor = this.context.createDynamicsCompressor();
    
    // 信号链路: Source -> Effects -> Analyser -> Compressor -> MasterGain -> Destination
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
  }

  /**
   * 获取原生 AudioContext
   */
  getContext(): AudioContext {
    return this.context;
  }

  /**
   * 创建音频源（文件）
   */
  async createSource(file: File): Promise<WAAudioSource> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    return new WAAudioSource(this.context, audioBuffer, this.compressor);
  }

  /**
   * 创建麦克风源
   */
  async createMicrophoneSource(): Promise<MediaStreamAudioSourceNode> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return this.context.createMediaStreamSource(stream);
  }

  /**
   * 创建振荡器
   */
  createOscillator(type: OscillatorType = 'sine', frequency: number = 440): WAAudioOscillator {
    return new WAAudioOscillator(this.context, this.compressor, type, frequency);
  }

  /**
   * 创建分析器
   */
  createAnalyser(): AnalyserNode {
    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;
    this.compressor.connect(analyser);
    return analyser;
  }

  /**
   * 设置主音量
   */
  setMasterVolume(value: number): void {
    this.masterGain.gain.setValueAtTime(value, this.context.currentTime);
  }

  /**
   * 暂停
   */
  suspend(): Promise<void> {
    return this.context.suspend();
  }

  /**
   * 恢复
   */
  resume(): Promise<void> {
    return this.context.resume();
  }

  /**
   * 获取当前时间
   */
  getCurrentTime(): number {
    return this.context.currentTime;
  }
}

/**
 * 音频源基类
 */
export class WAAudioSource {
  protected context: AudioContext;
  protected buffer: AudioBuffer;
  protected destination: AudioNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private isPlaying: boolean = false;

  constructor(context: AudioContext, buffer: AudioBuffer, destination: AudioNode) {
    this.context = context;
    this.buffer = buffer;
    this.destination = destination;
    this.gainNode = context.createGain();
    this.gainNode.connect(destination);
  }

  /**
   * 播放
   */
  play(loop: boolean = false): void {
    this.stop();
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.loop = loop;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(0);
    this.isPlaying = true;
  }

  /**
   * 暂停
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
  }

  /**
   * 设置音量
   */
  setVolume(value: number): void {
    this.gainNode.gain.setValueAtTime(value, this.context.currentTime);
  }

  /**
   * 是否正在播放
   */
  getPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取音频时长
   */
  getDuration(): number {
    return this.buffer.duration;
  }

  /**
   * 获取原生节点
   */
  getGainNode(): GainNode {
    return this.gainNode;
  }
}

/**
 * 振荡器
 */
export class WAAudioOscillator {
  private context: AudioContext;
  private destination: AudioNode;
  private oscillator: OscillatorNode;
  private gainNode: GainNode;
  private isPlaying: boolean = false;

  constructor(context: AudioContext, destination: AudioNode, type: OscillatorType, frequency: number) {
    this.context = context;
    this.destination = destination;
    
    this.oscillator = context.createOscillator();
    this.oscillator.type = type;
    this.oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    
    this.gainNode = context.createGain();
    this.gainNode.gain.setValueAtTime(0, context.currentTime);
    
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(destination);
  }

  /**
   * 播放
   */
  play(): void {
    if (!this.isPlaying) {
      this.oscillator.start();
      this.isPlaying = true;
    }
  }

  /**
   * 停止
   */
  stop(): void {
    if (this.isPlaying) {
      this.oscillator.stop();
      this.isPlaying = false;
    }
  }

  /**
   * 设置频率
   */
  setFrequency(value: number): void {
    this.oscillator.frequency.setValueAtTime(value, this.context.currentTime);
  }

  /**
   * 设置音量
   */
  setVolume(value: number): void {
    this.gainNode.gain.setValueAtTime(value, this.context.currentTime);
  }

  /**
   * 淡入
   */
  fadeIn(duration: number = 1): void {
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(this.gainNode.gain.value, this.context.currentTime + duration);
  }

  /**
   * 淡出
   */
  fadeOut(duration: number = 1): void {
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);
  }
}

export default WAAudioContext;
