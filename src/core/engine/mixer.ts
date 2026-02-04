/**
 * WAAudio Mixer - 混音引擎
 * 
 * 多轨道混音管理器
 * 支持音量、声像、独奏、静音控制
 */

// ============================================
// 类型定义
// ============================================

export interface TrackConfig {
  /** 轨道名称 */
  name?: string;
  /** 初始音量 */
  volume?: number;
  /** 声像 (-1 到 1) */
  pan?: number;
  /** 是否静音 */
  muted?: boolean;
  /** 是否独奏 */
  solo?: boolean;
  /** 颜色标识 */
  color?: string;
}

export interface MixerState {
  masterVolume: number;
  tracks: TrackState[];
}

export interface TrackState {
  id: number;
  name: string;
  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

// ============================================
// 轨道类
// ============================================

/**
 * WAAudioTrack - 音频轨道
 * 
 * 使用示例：
 * ```typescript
 * const track = mixer.addTrack({ name: 'Vocals', volume: 0.8 });
 * track.connect(source);
 * ```
 */
export class WAAudioTrack {
  /** 轨道 ID */
  private readonly _id: number;
  
  /** 轨道名称 */
  private _name: string;
  
  /** 上下文 */
  private readonly _context: AudioContext;
  
  /** 混音器 */
  private readonly _mixer: WAAudioMixer;
  
  /** 增益节点（音量） */
  private readonly _gainNode: GainNode;
  
  /** 声像节点 */
  private readonly _panNode: StereoPannerNode;
  
  /** 效果器链 */
  private _effectsChain: AudioNode[] = [];
  
  /** 分析器 */
  private _analyser: AnalyserNode | null = null;
  
  /** 静音状态 */
  private _muted = false;
  
  /** 独奏状态 */
  private _solo = false;
  
  /** 原始音量（静音时保存） */
  private _originalVolume = 1;
  
  /** 颜色标识 */
  private readonly _color: string;
  
  // ============================================
  // 构造函数
  // ============================================
  
  /**
   * @param id - 轨道 ID
   * @param context - AudioContext
   * @param mixer - 混音器实例
   * @param config - 轨道配置
   */
  constructor(
    id: number,
    context: AudioContext,
    mixer: WAAudioMixer,
    config: TrackConfig = {}
  ) {
    this._id = id;
    this._context = context;
    this._mixer = mixer;
    this._name = config.name ?? `Track ${id}`;
    this._color = config.color ?? this._getRandomColor();
    
    // 创建声像节点
    this._panNode = context.createStereoPanner();
    this._panNode.pan.value = config.pan ?? 0;
    
    // 创建增益节点
    this._gainNode = context.createGain();
    this._gainNode.gain.value = config.volume ?? 1;
    
    // 连接: Source -> Effects -> Pan -> Gain -> Mixer
    this._panNode.connect(this._gainNode);
    this._gainNode.connect(mixer.masterGain);
  }
  
  // ============================================
  // 属性访问器
  // ============================================
  
  /** 获取轨道 ID */
  get id(): number {
    return this._id;
  }
  
  /** 轨道名称 */
  get name(): string {
    return this._name;
  }
  
  /** 设置名称 */
  set name(value: string) {
    this._name = value;
  }
  
  /** 上下文 */
  get context(): AudioContext {
    return this._context;
  }
  
  /** 增益节点 */
  get gainNode(): GainNode {
    return this._gainNode;
  }
  
  /** 声像节点 */
  get panNode(): StereoPannerNode {
    return this._panNode;
  }
  
  /** 音量 (0-1) */
  get volume(): number {
    return this._muted ? 0 : this._gainNode.gain.value;
  }
  
  /** 声像 (-1 到 1) */
  get pan(): number {
    return this._panNode.pan.value;
  }
  
  /** 是否静音 */
  get muted(): boolean {
    return this._muted;
  }
  
  /** 是否独奏 */
  get solo(): boolean {
    return this._solo;
  }
  
  /** 颜色 */
  get color(): string {
    return this._color;
  }
  
  /** 是否活动（未被独奏轨道影响） */
  get active(): boolean {
    return this._mixer.isTrackActive(this);
  }
  
  // ============================================
  // 音量控制
  // ============================================
  
  /** 设置音量 */
  setVolume(value: number): void {
    const clampedValue = Math.max(0, Math.min(value, 1));
    
    if (!this._muted) {
      this._gainNode.gain.setTargetAtTime(clampedValue, this._context.currentTime, 0.01);
    }
    
    this._originalVolume = clampedValue;
  }
  
  /** 渐变音量 */
  rampVolume(value: number, duration: number = 0.1): void {
    const clampedValue = Math.max(0, Math.min(value, 1));
    this._gainNode.gain.cancelScheduledValues(this._context.currentTime);
    this._gainNode.gain.linearRampToValueAtTime(clampedValue, this._context.currentTime + duration);
  }
  
  // ============================================
  // 声像控制
  // ============================================
  
  /** 设置声像 */
  setPan(value: number): void {
    const clampedValue = Math.max(-1, Math.min(value, 1));
    this._panNode.pan.setTargetAtTime(clampedValue, this._context.currentTime, 0.01);
  }
  
  // ============================================
  // 静音/独奏
  // ============================================
  
  /** 切换静音 */
  toggleMute(): void {
    this.setMute(!this._muted);
  }
  
  /** 设置静音 */
  setMute(muted: boolean): void {
    this._muted = muted;
    
    if (muted) {
      this._gainNode.gain.setTargetAtTime(0, this._context.currentTime, 0.01);
    } else {
      this._gainNode.gain.setTargetAtTime(this._originalVolume, this._context.currentTime, 0.01);
    }
  }
  
  /** 切换独奏 */
  toggleSolo(): void {
    this._solo = !this._solo;
    this._mixer.updateSoloState();
  }
  
  /** 设置独奏 */
  setSolo(solo: boolean): void {
    this._solo = solo;
    this._mixer.updateSoloState();
  }
  
  // ============================================
  // 效果器连接
  // ============================================
  
  /** 添加效果器 */
  addEffect(effect: AudioNode): void {
    // 断开当前位置的连接
    if (this._effectsChain.length > 0) {
      const lastNode = this._effectsChain[this._effectsChain.length - 1];
      lastNode.disconnect();
    } else {
      this._panNode.disconnect();
    }
    
    // 添加到效果链
    this._effectsChain.push(effect);
    
    // 重新连接
    this._reconnectChain();
  }
  
  /** 移除效果器 */
  removeEffect(effect: AudioNode): void {
    const index = this._effectsChain.indexOf(effect);
    if (index > -1) {
      this._effectsChain.splice(index, 1);
      
      // 断开并重新连接
      effect.disconnect();
      this._reconnectChain();
    }
  }
  
  /** 清除所有效果器 */
  clearEffects(): void {
    for (const effect of this._effectsChain) {
      effect.disconnect();
    }
    this._effectsChain = [];
    this._reconnectChain();
  }
  
  /** 重新连接效果链 */
  private _reconnectChain(): void {
    let previousNode: AudioNode = this._panNode;
    
    for (const effect of this._effectsChain) {
      previousNode.connect(effect);
      previousNode = effect;
    }
    
    previousNode.connect(this._gainNode);
  }
  
  // ============================================
  // 分析器
  // ============================================
  
  /** 添加分析器 */
  setAnalyser(analyser: AnalyserNode): void {
    this._analyser = analyser;
    this._gainNode.disconnect();
    this._gainNode.connect(this._mixer.masterGain);
    this._gainNode.connect(analyser);
  }
  
  /** 移除分析器 */
  removeAnalyser(): void {
    if (this._analyser) {
      this._gainNode.disconnect();
      this._gainNode.connect(this._mixer.masterGain);
      this._analyser = null;
    }
  }
  
  // ============================================
  // 实用工具
  // ============================================
  
  /** 获取状态快照 */
  getState(): TrackState {
    return {
      id: this._id,
      name: this._name,
      volume: this._originalVolume,
      pan: this._panNode.pan.value,
      muted: this._muted,
      solo: this._solo,
      color: this._color
    };
  }
  
  /** 随机颜色 */
  private _getRandomColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  /** 销毁轨道 */
  destroy(): void {
    this.stop();
    this._gainNode.disconnect();
    this._panNode.disconnect();
    this.clearEffects();
  }
  
  /** 停止播放 */
  stop(): void {
    // 子类实现
  }
}

// ============================================
// 混音器类
// ============================================

/**
 * WAAudioMixer - 混音器
 * 
 * 使用示例：
 * ```typescript
 * const mixer = new WAAudioMixer(context);
 * const track1 = mixer.addTrack({ name: 'Vocals' });
 * const track2 = mixer.addTrack({ name: 'Backing' });
 * mixer.setMasterVolume(0.8);
 * ```
 */
export class WAAudioMixer {
  /** 上下文 */
  private readonly _context: AudioContext;
  
  /** 主增益节点 */
  private readonly _masterGain: GainNode;
  
  /** 主压缩器 */
  private readonly _masterCompressor: DynamicsCompressorNode;
  
  /** 主分析器 */
  private readonly _masterAnalyser: AnalyserNode;
  
  /** 轨道集合 */
  private readonly _tracks: Map<number, WAAudioTrack>;
  
  /** 下一个轨道 ID */
  private _nextTrackId = 1;
  
  /** 是否有独奏轨道 */
  private _hasSoloTracks = false;
  
  // ============================================
  // 构造函数
  // ============================================
  
  constructor(context: AudioContext) {
    this._context = context;
    
    // 创建主压缩器
    this._masterCompressor = context.createDynamicsCompressor();
    this._masterCompressor.threshold.value = -24;
    this._masterCompressor.knee.value = 30;
    this._masterCompressor.ratio.value = 4;
    this._masterCompressor.attack.value = 0.003;
    this._masterCompressor.release.value = 0.25;
    
    // 创建主增益
    this._masterGain = context.createGain();
    this._masterGain.gain.value = 1;
    
    // 创建主分析器
    this._masterAnalyser = context.createAnalyser();
    this._masterAnalyser.fftSize = 256;
    
    // 连接: Compressor -> Gain -> Analyser -> Destination
    this._masterCompressor.connect(this._masterGain);
    this._masterGain.connect(this._masterAnalyser);
    this._masterAnalyser.connect(context.destination);
    
    this._tracks = new Map();
  }
  
  // ============================================
  // 属性访问器
  // ============================================
  
  /** 主增益节点 */
  get masterGain(): GainNode {
    return this._masterGain;
  }
  
  /** 主压缩器 */
  get masterCompressor(): DynamicsCompressorNode {
    return this._masterCompressor;
  }
  
  /** 主分析器 */
  get masterAnalyser(): AnalyserNode {
    return this._masterAnalyser;
  }
  
  /** 主音量 (0-1) */
  get masterVolume(): number {
    return this._masterGain.gain.value;
  }
  
  /** 所有轨道数量 */
  get trackCount(): number {
    return this._tracks.size;
  }
  
  /** 是否有独奏轨道 */
  get hasSoloTracks(): boolean {
    return this._hasSoloTracks;
  }
  
  // ============================================
  // 轨道管理
  // ============================================
  
  /**
   * 添加轨道
   */
  addTrack(config: TrackConfig = {}): WAAudioTrack {
    const track = new WAAudioTrack(this._nextTrackId++, this._context, this, config);
    this._tracks.set(track.id, track);
    return track;
  }
  
  /**
   * 移除轨道
   */
  removeTrack(trackId: number): boolean {
    const track = this._tracks.get(trackId);
    if (track) {
      track.destroy();
      this._tracks.delete(trackId);
      this.updateSoloState();
      return true;
    }
    return false;
  }
  
  /**
   * 获取轨道
   */
  getTrack(trackId: number): WAAudioTrack | undefined {
    return this._tracks.get(trackId);
  }
  
  /**
   * 获取所有轨道
   */
  getTracks(): WAAudioTrack[] {
    return Array.from(this._tracks.values());
  }
  
  /**
   * 清空所有轨道
   */
  clearTracks(): void {
    for (const track of this._tracks.values()) {
      track.destroy();
    }
    this._tracks.clear();
    this._nextTrackId = 1;
  }
  
  // ============================================
  // 主音量控制
  // ============================================
  
  /** 设置主音量 */
  setMasterVolume(value: number): void {
    const clampedValue = Math.max(0, Math.min(value, 1));
    this._masterGain.gain.setTargetAtTime(clampedValue, this._context.currentTime, 0.01);
  }
  
  /** 渐变主音量 */
  rampMasterVolume(value: number, duration: number = 0.1): void {
    const clampedValue = Math.max(0, Math.min(value, 1));
    this._masterGain.gain.cancelScheduledValues(this._context.currentTime);
    this._masterGain.gain.linearRampToValueAtTime(clampedValue, this._context.currentTime + duration);
  }
  
  // ============================================
  // 批量操作
  // ============================================
  
  /** 静音所有轨道 */
  muteAll(): void {
    for (const track of this._tracks.values()) {
      track.setMute(true);
    }
  }
  
  /** 取消静音所有轨道 */
  unmuteAll(): void {
    for (const track of this._tracks.values()) {
      track.setMute(false);
    }
  }
  
  /** 停止所有轨道 */
  stopAll(): void {
    for (const track of this._tracks.values()) {
      track.stop();
    }
  }
  
  // ============================================
  // 内部方法
  // ============================================
  
  /** 更新独奏状态（内部使用） */
  updateSoloState(): void {
    this._hasSoloTracks = false;
    
    for (const track of this._tracks.values()) {
      if (track.solo) {
        this._hasSoloTracks = true;
        break;
      }
    }
    
    // 如果有独奏轨道，只播放独奏轨道
    for (const track of this._tracks.values()) {
      if (this._hasSoloTracks) {
        // 独奏轨道不受静音影响，非独奏轨道静音
        track.setMute(!track.solo);
      } else {
        // 没有独奏轨道时，恢复原始状态
        track.setMute(false);
      }
    }
  }
  
  /** 检查轨道是否活动（内部使用） */
  isTrackActive(track: WAAudioTrack): boolean {
    if (!this._hasSoloTracks) {
      return !track.muted;
    }
    return track.solo;
  }
  
  // ============================================
  // 状态管理
  // ============================================
  
  /** 获取完整状态 */
  getState(): MixerState {
    return {
      masterVolume: this._masterVolume,
      tracks: this.getTracks().map(t => t.getState())
    };
  }
  
  /** 恢复状态 */
  restoreState(state: MixerState): void {
    this.setMasterVolume(state.masterVolume);
    
    // 清除现有轨道
    this.clearTracks();
    
    // 恢复轨道
    for (const trackState of state.tracks) {
      const track = this.addTrack(trackState);
      track.setMute(trackState.muted);
      track.setSolo(trackState.solo);
    }
  }
  
  // ============================================
  // 实用工具
  // ============================================
  
  /** 获取电平数据 */
  getMasterLevel(): number {
    const dataArray = new Uint8Array(this._masterAnalyser.frequencyBinCount);
    this._masterAnalyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    
    return Math.sqrt(sum / dataArray.length) / 255;
  }
  
  /** 获取峰值电平 */
  getMasterPeak(): number {
    const dataArray = new Uint8Array(this._masterAnalyser.frequencyBinCount);
    this._masterAnalyser.getByteFrequencyData(dataArray);
    
    return Math.max(...dataArray) / 255;
  }
  
  /** 销毁混音器 */
  destroy(): void {
    this.clearTracks();
    this._masterGain.disconnect();
    this._masterCompressor.disconnect();
  }
}

// ============================================
// 导出
// ============================================

export default WAAudioMixer;
