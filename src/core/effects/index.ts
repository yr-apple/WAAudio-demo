/**
 * WAAudio Effects - 效果器模块
 * 
 * 统一的效果器类，支持链式调用
 */

// ============================================
// 基础效果器类
// ============================================

/**
 * 均衡器 (3段)
 */
export class WAAudioEQ {
  readonly type = 'eq';
  
  private readonly context: AudioContext;
  private readonly lowFilter: BiquadFilterNode;
  private readonly midFilter: BiquadFilterNode;
  private readonly highFilter: BiquadFilterNode;
  private readonly inputNode: BiquadFilterNode;
  private readonly outputNode: BiquadFilterNode;
  private _enabled = true;
  
  constructor(context: AudioContext) {
    this.context = context;
    
    // 低频 (Low Shelf) - 320Hz
    this.lowFilter = context.createBiquadFilter();
    this.lowFilter.type = 'lowshelf';
    this.lowFilter.frequency.value = 320;
    this.lowFilter.gain.value = 0;
    
    // 中频 (Peaking) - 1000Hz
    this.midFilter = context.createBiquadFilter();
    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 1;
    this.midFilter.gain.value = 0;
    
    // 高频 (High Shelf) - 3200Hz
    this.highFilter = context.createBiquadFilter();
    this.highFilter.type = 'highshelf';
    this.highFilter.frequency.value = 3200;
    this.highFilter.gain.value = 0;
    
    // 连接: Low -> Mid -> High
    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    
    // 输入/输出节点
    this.inputNode = this.lowFilter;
    this.outputNode = this.highFilter;
  }
  
  get input(): AudioNode {
    return this.inputNode;
  }
  
  get output(): AudioNode {
    return this.outputNode;
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  setEnabled(value: boolean): this {
    this._enabled = value;
    return this;
  }
  
  /** 设置低频增益 (-12dB ~ +12dB) */
  setLow(value: number): this {
    this.lowFilter.gain.value = Math.max(-12, Math.min(12, value));
    return this;
  }
  
  /** 设置中频增益 (-12dB ~ +12dB) */
  setMid(value: number): this {
    this.midFilter.gain.value = Math.max(-12, Math.min(12, value));
    return this;
  }
  
  /** 设置高频增益 (-12dB ~ +12dB) */
  setHigh(value: number): this {
    this.highFilter.gain.value = Math.max(-12, Math.min(12, value));
    return this;
  }
  
  /** 预设: 增强低音 */
  bassBoost(): this {
    return this.setLow(6).setMid(-2).setHigh(-2);
  }
  
  /** 预设: 增强人声 */
  vocalBoost(): this {
    return this.setLow(-2).setMid(4).setHigh(2);
  }
  
  /** 预设: 明亮 */
  bright(): this {
    return this.setLow(-3).setMid(0).setHigh(6);
  }
  
  /** 重置 */
  reset(): this {
    return this.setLow(0).setMid(0).setHigh(0);
  }
}

/**
 * 压缩器
 */
export class WAAudioCompressor {
  readonly type = 'compressor';
  
  private readonly context: AudioContext;
  private readonly _node: DynamicsCompressorNode;
  private readonly inputGain: GainNode;
  private readonly outputGain: GainNode;
  private _enabled = true;
  
  constructor(context: AudioContext) {
    this.context = context;
    
    this._node = context.createDynamicsCompressor();
    this._node.threshold.value = -24;
    this._node.knee.value = 30;
    this._node.ratio.value = 12;
    this._node.attack.value = 0.003;
    this._node.release.value = 0.25;
    
    this.inputGain = context.createGain();
    this.outputGain = context.createGain();
    this.outputGain.gain.value = 1;
    
    this.inputGain.connect(this._node);
    this._node.connect(this.outputGain);
  }
  
  get input(): AudioNode {
    return this.inputGain;
  }
  
  get output(): AudioNode {
    return this.outputGain;
  }
  
  get node(): DynamicsCompressorNode {
    return this._node;
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  setEnabled(value: boolean): this {
    this._enabled = value;
    return this;
  }
  
  /** 设置阈值 (dB, -100 ~ 0) */
  setThreshold(value: number): this {
    this.node.threshold.value = Math.max(-100, Math.min(0, value));
    return this;
  }
  
  /** 设置压缩比 (1:1 ~ 20:1) */
  setRatio(value: number): this {
    this.node.ratio.value = Math.max(1, Math.min(20, value));
    return this;
  }
  
  /** 设置起音时间 (秒, 0 ~ 1) */
  setAttack(value: number): this {
    this.node.attack.value = Math.max(0, Math.min(1, value));
    return this;
  }
  
  /** 设置释放时间 (秒, 0 ~ 1) */
  setRelease(value: number): this {
    this.node.release.value = Math.max(0, Math.min(1, value));
    return this;
  }
  
  /** 设置膝点 (dB, 0 ~ 40) */
  setKnee(value: number): this {
    this.node.knee.value = Math.max(0, Math.min(40, value));
    return this;
  }
  
  /** 预设: 柔和压缩 */
  soft(): this {
    return this.setThreshold(-20).setRatio(2).setAttack(0.01).setRelease(0.2);
  }
  
  /** 预设: 硬压缩 */
  hard(): this {
    return this.setThreshold(-10).setRatio(10).setAttack(0.001).setRelease(0.1);
  }
  
  /** 重置 */
  reset(): this {
    return this.setThreshold(-24).setRatio(12).setAttack(0.003).setRelease(0.25);
  }
}

/**
 * 混响
 */
export class WAAudioReverb {
  readonly type = 'reverb';
  
  private readonly context: AudioContext;
  private readonly convolver: ConvolverNode;
  private readonly wetGain: GainNode;
  private readonly dryGain: GainNode;
  private readonly outputGain: GainNode;
  private _enabled = true;
  
  constructor(context: AudioContext) {
    this.context = context;
    
    this.convolver = context.createConvolver();
    this.wetGain = context.createGain();
    this.dryGain = context.createGain();
    this.outputGain = context.createGain();
    
    this.wetGain.gain.value = 0.3;
    this.dryGain.gain.value = 0.7;
    this.outputGain.gain.value = 1;
    
    // 预设为房间混响
    this.setRoomSize(0.5);
  }
  
  get input(): AudioNode {
    return this.convolver;
  }
  
  get output(): AudioNode {
    return this.outputGain;
  }
  
  get wet(): GainNode {
    return this.wetGain;
  }
  
  get dry(): GainNode {
    return this.dryGain;
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  setEnabled(value: boolean): this {
    this._enabled = value;
    return this;
  }
  
  /** 设置混响强度 (0 ~ 1) */
  setMix(value: number): this {
    this.wetGain.gain.value = Math.max(0, Math.min(1, value));
    this.dryGain.gain.value = 1 - value;
    return this;
  }
  
  /** 设置房间大小 (0 ~ 1) */
  setRoomSize(value: number): this {
    const duration = 0.5 + value * 3;
    const decay = 1 + value * 3;
    this._buildImpulse(duration, decay);
    return this;
  }
  
  /** 设置混响时长 (秒) */
  setDuration(value: number): this {
    this._buildImpulse(value, 2);
    return this;
  }
  
  /** 预设: 小房间 */
  smallRoom(): this {
    return this.setRoomSize(0.2).setMix(0.25);
  }
  
  /** 预设: 大厅 */
  hall(): this {
    return this.setRoomSize(0.7).setMix(0.4);
  }
  
  /** 预设: 板式混响 */
  plate(): this {
    return this.setDuration(1.5).setMix(0.35);
  }
  
  /** 预设: 教堂 */
  cathedral(): this {
    return this.setDuration(4).setMix(0.5);
  }
  
  /** 脉冲响应生成 */
  private _buildImpulse(duration: number, decay: number): void {
    const rate = this.context.sampleRate;
    const length = rate * duration;
    const impulse = this.context.createBuffer(2, length, rate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    
    this.convolver.buffer = impulse;
  }
}

/**
 * 延迟
 */
export class WAAudioDelay {
  readonly type = 'delay';
  
  private readonly context: AudioContext;
  private readonly delayNode: DelayNode;
  private readonly feedbackGain: GainNode;
  private readonly wetGain: GainNode;
  private readonly dryGain: GainNode;
  private readonly outputGain: GainNode;
  private _enabled = true;
  
  constructor(context: AudioContext) {
    this.context = context;
    
    this.delayNode = context.createDelay(5);
    this.delayNode.delayTime.value = 0.3;
    
    this.feedbackGain = context.createGain();
    this.feedbackGain.gain.value = 0.4;
    
    this.wetGain = context.createGain();
    this.wetGain.gain.value = 0.3;
    
    this.dryGain = context.createGain();
    this.dryGain.gain.value = 0.7;
    
    this.outputGain = context.createGain();
    this.outputGain.gain.value = 1;
    
    // 连接: Input -> Dry + Delay
    //              |-> Feedback -> Delay
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
  }
  
  get input(): AudioNode {
    return this.delayNode;
  }
  
  get output(): AudioNode {
    return this.outputGain;
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  setEnabled(value: boolean): this {
    this._enabled = value;
    return this;
  }
  
  /** 设置延迟时间 (秒, 0 ~ 5) */
  setTime(value: number): this {
    this.delayNode.delayTime.setTargetAtTime(Math.max(0, Math.min(5, value)), this.context.currentTime, 0.01);
    return this;
  }
  
  /** 设置反馈量 (0 ~ 0.95) */
  setFeedback(value: number): this {
    this.feedbackGain.gain.setTargetAtTime(Math.max(0, Math.min(0.95, value)), this.context.currentTime, 0.01);
    return this;
  }
  
  /** 设置干湿比 (0 ~ 1) */
  setMix(value: number): this {
    this.wetGain.gain.value = Math.max(0, Math.min(1, value));
    this.dryGain.gain.value = 1 - value;
    return this;
  }
  
  /** 预设: 简单延迟 */
  simple(): this {
    return this.setTime(0.3).setFeedback(0.3).setMix(0.25);
  }
  
  /** 预设: 舞蹈延迟 */
  dub(): this {
    return this.setTime(0.5).setFeedback(0.6).setMix(0.4);
  }
  
  /** 预设: _SLAP */
  slap(): this {
    return this.setTime(0.08).setFeedback(0.3).setMix(0.3);
  }
  
  /** 重置 */
  reset(): this {
    return this.setTime(0.3).setFeedback(0.4).setMix(0.3);
  }
}

/**
 * 失真
 */
export class WAAudioDistortion {
  readonly type = 'distortion';
  
  private readonly context: AudioContext;
  private readonly node: WaveShaperNode;
  private readonly inputGain: GainNode;
  private readonly outputGain: GainNode;
  private _enabled = true;
  
  constructor(context: AudioContext) {
    this.context = context;
    
    this.node = context.createWaveShaper();
    this._setCurve(50);
    
    this.inputGain = context.createGain();
    this.inputGain.gain.value = 1;
    
    this.outputGain = context.createGain();
    this.outputGain.gain.value = 0.5;
    
    this.inputGain.connect(this.node);
    this.node.connect(this.outputGain);
  }
  
  get input(): AudioNode {
    return this.inputGain;
  }
  
  get output(): AudioNode {
    return this.outputGain;
  }
  
  get enabled(): boolean {
    return this._enabled;
  }
  
  setEnabled(value: boolean): this {
    this._enabled = value;
    return this;
  }
  
  /** 设置失真量 (0 ~ 100) */
  setAmount(value: number): this {
    this._setCurve(Math.max(0, Math.min(100, value)));
    return this;
  }
  
  /** 预设: 轻度失真 */
  light(): this {
    return this.setAmount(20);
  }
  
  /** 预设: 中度失真 */
  medium(): this {
    return this.setAmount(50);
  }
  
  /** 预设: 重度失真 */
  heavy(): this {
    return this.setAmount(100);
  }
  
  /** 预设: 合唱效果 */
  chorus(): this {
    this.inputGain.gain.value = 2;
    return this.setAmount(30);
  }
  
  /** 预设: FUZZ 效果 */
  fuzz(): this {
    this.inputGain.gain.value = 3;
    return this.setAmount(80);
  }
  
  /** 设置失真曲线 */
  private _setCurve(amount: number): void {
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    this.node.curve = curve;
    this.node.oversample = '4x';
  }
}

// ============================================
// 效果器工厂
// ============================================

export type EffectType = 'eq' | 'compressor' | 'reverb' | 'delay' | 'distortion';

export interface EffectOptions {
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * 效果器工厂类
 */
export class WAAudioEffectFactory {
  private readonly context: AudioContext;
  
  constructor(context: AudioContext) {
    this.context = context;
  }
  
  /** 创建均衡器 */
  createEQ(): WAAudioEQ {
    return new WAAudioEQ(this.context);
  }
  
  /** 创建压缩器 */
  createCompressor(): WAAudioCompressor {
    return new WAAudioCompressor(this.context);
  }
  
  /** 创建混响 */
  createReverb(): WAAudioReverb {
    return new WAAudioReverb(this.context);
  }
  
  /** 创建延迟 */
  createDelay(): WAAudioDelay {
    return new WAAudioDelay(this.context);
  }
  
  /** 创建失真 */
  createDistortion(): WAAudioDistortion {
    return new WAAudioDistortion(this.context);
  }
}

// ============================================
// 效果器链
// ============================================

/**
 * 效果器链 - 管理多个效果器
 */
export class WAAudioEffectChain {
  private readonly effects: Map<string, WAAudioEffect> = new Map();
  private readonly context: AudioContext;
  private _inputNode: AudioNode | null = null;
  private _outputNode: AudioNode | null = null;
  
  constructor(context: AudioContext) {
    this.context = context;
  }
  
  /** 添加效果器 */
  add(id: string, effect: WAAudioEffect): this {
    this.effects.set(id, effect);
    this._rebuild();
    return this;
  }
  
  /** 移除效果器 */
  remove(id: string): this {
    this.effects.delete(id);
    this._rebuild();
    return this;
  }
  
  /** 获取效果器 */
  get(id: string): WAAudioEffect | undefined {
    return this.effects.get(id);
  }
  
  /** 清空所有效果器 */
  clear(): this {
    this.effects.clear();
    this._rebuild();
    return this;
  }
  
  /** 启用/禁用效果器 */
  setEnabled(id: string, enabled: boolean): this {
    const effect = this.effects.get(id);
    if (effect) {
      effect.setEnabled(enabled);
    }
    return this;
  }
  
  get input(): AudioNode | null {
    return this._inputNode;
  }
  
  get output(): AudioNode | null {
    return this._outputNode;
  }
  
  /** 重建连接 */
  private _rebuild(): void {
    const effectsArray = Array.from(this.effects.values());
    
    if (effectsArray.length === 0) {
      this._inputNode = null;
      this._outputNode = null;
      return;
    }
    
    // 第一个效果器的输入
    this._inputNode = effectsArray[0].input;
    
    // 最后一个效果器的输出
    this._outputNode = effectsArray[effectsArray.length - 1].output;
  }
}

// 基础效果器接口
interface WAAudioEffect {
  readonly type: string;
  readonly enabled: boolean;
  setEnabled(value: boolean): this;
  get input(): AudioNode;
  get output(): AudioNode;
}
