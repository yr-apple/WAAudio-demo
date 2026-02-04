/**
 * WAAudio Effects - 音频效果器
 */

export class WAAudioEffects {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * 创建混响效果
   */
  createReverb(duration: number = 2, decay: number = 2): ConvolverNode {
    const convolver = this.context.createConvolver();
    const rate = this.context.sampleRate;
    const length = rate * duration;
    const impulse = this.context.createBuffer(2, length, rate);
    
    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    
    convolver.buffer = impulse;
    return convolver;
  }

  /**
   * 创建延迟效果
   */
  createDelay(time: number = 0.3, feedback: number = 0.4): DelayNode {
    const delay = this.context.createDelay(time * 5);
    delay.delayTime.setValueAtTime(time, this.context.currentTime);
    return delay;
  }

  /**
   * 创建压缩器
   */
  createCompressor(
    threshold: number = -24,
    knee: number = 30,
    ratio: number = 12,
    attack: number = 0.003,
    release: number = 0.25
  ): DynamicsCompressorNode {
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(threshold, this.context.currentTime);
    compressor.knee.setValueAtTime(knee, this.context.currentTime);
    compressor.ratio.setValueAtTime(ratio, this.context.currentTime);
    compressor.attack.setValueAtTime(attack, this.context.currentTime);
    compressor.release.setValueAtTime(release, this.context.currentTime);
    return compressor;
  }

  /**
   * 创建均衡器 (3段)
   */
  createEQ(lowGain: number = 1, midGain: number = 1, highGain: number = 1): BiquadFilterNode[] {
    const low = this.context.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.setValueAtTime(320, this.context.currentTime);
    low.gain.setValueAtTime(lowGain, this.context.currentTime);

    const mid = this.context.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.setValueAtTime(1000, this.context.currentTime);
    mid.Q.setValueAtTime(1, this.context.currentTime);
    mid.gain.setValueAtTime(midGain, this.context.currentTime);

    const high = this.context.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.setValueAtTime(3200, this.context.currentTime);
    high.gain.setValueAtTime(highGain, this.context.currentTime);

    // 连接: low -> mid -> high
    low.connect(mid);
    mid.connect(high);

    return [low, mid, high];
  }

  /**
   * 创建失真效果
   */
  createDistortion(amount: number = 50): WaveShaperNode {
    const distortion = this.context.createWaveShaper();
    const samples = 44100;
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    
    distortion.curve = curve;
    distortion.oversample = '4x';
    return distortion;
  }

  /**
   * 创建低通滤波器
   */
  createLowpass(frequency: number = 1000): BiquadFilterNode {
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(frequency, this.context.currentTime);
    return filter;
  }

  /**
   * 创建高通滤波器
   */
  createHighpass(frequency: number = 500): BiquadFilterNode {
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(frequency, this.context.currentTime);
    return filter;
  }

  /**
   * 创建带通滤波器
   */
  createBandpass(frequency: number = 1000, Q: number = 1): BiquadFilterNode {
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, this.context.currentTime);
    filter.Q.setValueAtTime(Q, this.context.currentTime);
    return filter;
  }

  /**
   * 创建回声效果 (Delay + Feedback)
   */
  createEcho(time: number = 0.4, feedback: number = 0.3): { delay: DelayNode; feedback: GainNode } {
    const delay = this.context.createDelay(time * 5);
    delay.delayTime.setValueAtTime(time, this.context.currentTime);
    
    const feedbackGain = this.context.createGain();
    feedbackGain.gain.setValueAtTime(feedback, this.context.currentTime);
    
    // 回环: delay -> feedback -> delay
    delay.connect(feedbackGain);
    feedbackGain.connect(delay);
    
    return { delay, feedback: feedbackGain };
  }
}

export default WAAudioEffects;
