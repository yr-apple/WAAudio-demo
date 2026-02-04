/**
 * WAAudio Core - Web Audio API Wrapper
 * 
 * 核心设计原则：
 * - 类型严格，禁止 any
 * - 性能优先，避免不必要的计算
 * - 模块化设计，便于扩展
 */

import { WAAudioSource } from './source/file-source';
import { WAAudioOscillator } from './source/oscillator';
import { WAAudioAnalyser } from './analyser';
import { WAAudioEQ, WAAudioCompressor, WAAudioReverb, WAAudioDelay, WAAudioDistortion, WAAudioEffectFactory, WAAudioEffectChain } from './effects';
import { WAAudioRecorder } from './recorder';
import { WAAudioMixer, WAAudioTrack } from './engine/mixer';

// ============================================
// 类型定义
// ============================================

export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface WAAudioConfig {
  sampleRate?: number;
  bufferSize?: number;
  autoConnect?: boolean;
}

export interface PlayOptions {
  offset?: number;
  loop?: boolean;
  playbackRate?: number;
}

// ============================================
// 主类
// ============================================

/**
 * WAAudio 主上下文
 */
export class WAAudioContext {
  private _context: AudioContext;
  private _masterGain: GainNode;
  private _compressor: DynamicsCompressorNode;
  
  constructor(config: WAAudioConfig = {}) {
    const sampleRate = config.sampleRate || 44100;
    const AudioContextClass = (window as { AudioContext?: new() => AudioContext }).AudioContext;
    this._context = new AudioContextClass?.() || new (window.AudioContext || (window as { webkitAudioContext: new() => AudioContext }).webkitAudioContext)({ sampleRate });
    
    this._compressor = this._context.createDynamicsCompressor();
    this._compressor.threshold.value = -24;
    this._compressor.knee.value = 30;
    this._compressor.ratio.value = 12;
    this._compressor.attack.value = 0.003;
    this._compressor.release.value = 0.25;
    
    this._masterGain = this._context.createGain();
    this._masterGain.gain.value = 1;
    
    this._compressor.connect(this._masterGain);
    this._masterGain.connect(this._context.destination);
  }
  
  get context(): AudioContext {
    return this._context;
  }
  
  get masterGain(): GainNode {
    return this._masterGain;
  }
  
  get currentTime(): number {
    return this._context.currentTime;
  }
  
  get sampleRate(): number {
    return this._context.sampleRate;
  }
  
  // 音频源
  async createSource(file: File): Promise<WAAudioSource> {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this._context.decodeAudioData(arrayBuffer);
    return new WAAudioSource(this._context, audioBuffer, this._masterGain);
  }
  
  createOscillator(type: OscillatorType = 'sine', frequency: number = 440): WAAudioOscillator {
    return new WAAudioOscillator(this._context, this._masterGain, type, frequency);
  }
  
  async createMicrophoneSource(): Promise<MediaStreamAudioSourceNode> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return this._context.createMediaStreamSource(stream);
  }
  
  // 效果器
  createEQ(): WAAudioEQ {
    return new WAAudioEQ(this._context);
  }
  
  createCompressor(): WAAudioCompressor {
    return new WAAudioCompressor(this._context);
  }
  
  createReverb(duration: number = 2, decay: number = 2): WAAudioReverb {
    const reverb = new WAAudioReverb(this._context);
    reverb.setRoomSize(duration / 4);
    return reverb;
  }
  
  createDelay(time: number = 0.3, feedback: number = 0.4): WAAudioDelay {
    const delay = new WAAudioDelay(this._context);
    delay.setTime(time).setFeedback(feedback);
    return delay;
  }
  
  createDistortion(amount: number = 50): WAAudioDistortion {
    return new WAAudioDistortion(this._context).setAmount(amount);
  }
  
  createLowpass(frequency: number = 1000): BiquadFilterNode {
    const filter = this._context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    return filter;
  }
  
  createHighpass(frequency: number = 500): BiquadFilterNode {
    const filter = this._context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = frequency;
    return filter;
  }
  
  // 分析器
  createAnalyser(fftSize: number = 2048): WAAudioAnalyser {
    return new WAAudioAnalyser(this._context, fftSize);
  }
  
  // 录音
  createRecorder(): WAAudioRecorder {
    return new WAAudioRecorder(this._context);
  }
  
  // 控制
  suspend(): Promise<void> {
    return this._context.suspend();
  }
  
  resume(): Promise<void> {
    return this._context.resume();
  }
  
  close(): Promise<void> {
    return this._context.close();
  }
  
  // 工具
  createSilence(duration: number): AudioBuffer {
    const buffer = this._context.createBuffer(2, this.sampleRate * duration, this.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      buffer.getChannelData(channel).fill(0);
    }
    return buffer;
  }
}

export default WAAudioContext;

// 导出
export { WAAudioSource };
export { WAAudioOscillator };
export { WAAudioAnalyser };
export { WAAudioEQ, WAAudioCompressor, WAAudioReverb, WAAudioDelay, WAAudioDistortion };
export { WAAudioEffectFactory, WAAudioEffectChain };
export { WAAudioRecorder };
export { WAAudioMixer, WAAudioTrack };
export { WAAudioEditor } from './editor';
export { exportWAV, exportWebM } from './export';
export type { WAAudioMarkers, Marker, MarkerType, MarkerRegion } from './markers';
