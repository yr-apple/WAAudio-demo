/**
 * WAAudio Analyser - FFT 频谱分析器
 */

export class WAAudioAnalyser {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private frequencyData: Uint8Array;
  private timeDomainData: Uint8Array;

  constructor(audioContext: AudioContext, fftSize: number = 2048) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = fftSize;
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.frequencyData = new Uint8Array(bufferLength);
    this.timeDomainData = new Uint8Array(bufferLength);
  }

  /**
   * 获取原生 AnalyserNode
   */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /**
   * 连接音频源
   */
  connect(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.analyser.disconnect();
  }

  /**
   * 更新数据
   */
  update(): void {
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);
  }

  /**
   * 获取频谱数据 (0-255)
   */
  getFrequencyData(): Uint8Array {
    return this.frequencyData;
  }

  /**
   * 获取时域数据 (0-255)
   */
  getTimeDomainData(): Uint8Array {
    return this.timeDomainData;
  }

  /**
   * 获取单个频率值
   */
  getFrequencyValue(frequency: number): number {
    const index = Math.round(frequency / (this.analyser.context.sampleRate / this.analyser.fftSize));
    return this.frequencyData[index] || 0;
  }

  /**
   * 获取最大频率值
   */
  getMaxFrequency(): number {
    let max = 0;
    let maxIndex = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      if (this.frequencyData[i] > max) {
        max = this.frequencyData[i];
        maxIndex = i;
      }
    }
    return maxIndex * (this.analyser.context.sampleRate / this.analyser.fftSize);
  }

  /**
   * 获取平均音量
   */
  getAverageVolume(): number {
    let sum = 0;
    for (let i = 0; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / this.frequencyData.length;
  }

  /**
   * 获取低频能量 (Bass)
   */
  getBass(): number {
    const bassRange = Math.floor(this.frequencyData.length * 0.1);
    let sum = 0;
    for (let i = 0; i < bassRange; i++) {
      sum += this.frequencyData[i];
    }
    return sum / bassRange;
  }

  /**
   * 获取中频能量 (Mid)
   */
  getMid(): number {
    const midStart = Math.floor(this.frequencyData.length * 0.1);
    const midEnd = Math.floor(this.frequencyData.length * 0.5);
    let sum = 0;
    for (let i = midStart; i < midEnd; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (midEnd - midStart);
  }

  /**
   * 获取高频能量 (Treble)
   */
  getTreble(): number {
    const trebleStart = Math.floor(this.frequencyData.length * 0.5);
    let sum = 0;
    for (let i = trebleStart; i < this.frequencyData.length; i++) {
      sum += this.frequencyData[i];
    }
    return sum / (this.frequencyData.length - trebleStart);
  }

  /**
   * 获取 FFT 大小
   */
  getFFTSize(): number {
    return this.analyser.fftSize;
  }

  /**
   * 获取频率分辨率
   */
  getFrequencyBinCount(): number {
    return this.analyser.frequencyBinCount;
  }
}

export default WAAudioAnalyser;
