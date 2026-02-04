/**
 * WAAudio Editor - 波形编辑器
 * 
 * 支持波形剪辑、淡入淡出、归一化等功能
 */

// ============================================
// 类型定义
// ============================================

export interface EditRange {
  start: number;  // 起始位置（秒）
  end: number;    // 结束位置（秒）
}

export interface FadeParams {
  inDuration: number;   // 淡入时长（秒）
  outDuration: number;  // 淡出时长（秒）
  curve: 'linear' | 'exponential' | 'sigmoid';
}

export interface EditOperation {
  type: 'cut' | 'copy' | 'delete' | 'trim' | 'silence' | 'reverse';
  range: EditRange;
}

// ============================================
// 波形编辑器类
// ============================================

/**
 * WAAudioEditor - 波形编辑器
 * 
 * 使用示例：
 * ```typescript
 * const editor = new WAAudioEditor(context, buffer);
 * editor.cut(0, 5);  // 剪切 0-5 秒
 * editor.fadeIn(0, 1);  // 淡入 0-1 秒
 * ```
 */
export class WAAudioEditor {
  private readonly context: AudioContext;
  private _buffer: AudioBuffer;
  private _undoStack: AudioBuffer[] = [];
  private _redoStack: AudioBuffer[] = [];
  private readonly _maxUndoSteps = 20;
  
  constructor(context: AudioContext, buffer: AudioBuffer) {
    this.context = context;
    this._buffer = this._cloneBuffer(buffer);
  }
  
  // ============================================
  // 属性访问器
  // ============================================
  
  /** 音频缓冲区 */
  get buffer(): AudioBuffer {
    return this._buffer;
  }
  
  /** 时长（秒） */
  get duration(): number {
    return this._buffer.duration;
  }
  
  /** 采样数 */
  get length(): number {
    return this._buffer.length;
  }
  
  /** 采样率 */
  get sampleRate(): number {
    return this._buffer.sampleRate;
  }
  
  /** 声道数 */
  get numberOfChannels(): number {
    return this._buffer.numberOfChannels;
  }
  
  // ============================================
  // 撤销/重做
  // ============================================
  
  /** 保存当前状态到撤销栈 */
  private _saveState(): void {
    this._undoStack.push(this._cloneBuffer(this._buffer));
    
    // 限制撤销栈大小
    if (this._undoStack.length > this._maxUndoSteps) {
      this._undoStack.shift();
    }
    
    // 清空重做栈
    this._redoStack = [];
  }
  
  /** 撤销 */
  undo(): boolean {
    if (this._undoStack.length === 0) return false;
    
    this._redoStack.push(this._cloneBuffer(this._buffer));
    this._buffer = this._undoStack.pop()!;
    return true;
  }
  
  /** 重做 */
  redo(): boolean {
    if (this._redoStack.length === 0) return false;
    
    this._undoStack.push(this._cloneBuffer(this._buffer));
    this._buffer = this._redoStack.pop()!;
    return true;
  }
  
  /** 清空历史 */
  clearHistory(): void {
    this._undoStack = [];
    this._redoStack = [];
  }
  
  // ============================================
  // 剪辑操作
  // ============================================
  
  /**
   * 剪切 - 移除指定范围并返回
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   * @returns 剪切的音频片段
   */
  cut(start: number, end: number): AudioBuffer | null {
    if (start >= end || start < 0 || end > this.duration) return null;
    
    this._saveState();
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    const cutLength = endSample - startSample;
    
    // 保存被剪切的片段
    const cutBuffer = this._context.createBuffer(
      this.numberOfChannels,
      cutLength,
      this.sampleRate
    );
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const srcData = this._buffer.getChannelData(channel);
      const dstData = cutBuffer.getChannelData(channel);
      dstData.set(srcData.subarray(startSample, endSample));
    }
    
    // 创建新缓冲区
    this._buffer = this._createBufferWithGap(startSample, endSample);
    
    return cutBuffer;
  }
  
  /**
   * 删除 - 移除指定范围（不返回）
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   */
  delete(start: number, end: number): void {
    if (start >= end || start < 0 || end > this.duration) return;
    
    this._saveState();
    this._buffer = this._createBufferWithGap(
      Math.floor(start * this.sampleRate),
      Math.floor(end * this.sampleRate)
    );
  }
  
  /**
   * 复制 - 复制指定范围
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   * @returns 复制的音频片段
   */
  copy(start: number, end: number): AudioBuffer | null {
    if (start >= end || start < 0 || end > this.duration) return null;
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    const copyLength = endSample - startSample;
    
    const copyBuffer = this._context.createBuffer(
      this.numberOfChannels,
      copyLength,
      this.sampleRate
    );
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const srcData = this._buffer.getChannelData(channel);
      const dstData = copyBuffer.getChannelData(channel);
      dstData.set(srcData.subarray(startSample, endSample));
    }
    
    return copyBuffer;
  }
  
  /**
   * 粘贴 - 在指定位置粘贴音频
   * 
   * @param position - 粘贴位置（秒）
   * @param buffer - 要粘贴的音频
   */
  paste(position: number, buffer: AudioBuffer): void {
    if (position < 0 || position > this.duration) return;
    
    this._saveState();
    
    const positionSample = Math.floor(position * this.sampleRate);
    const newLength = positionSample + buffer.length;
    
    const newBuffer = this._context.createBuffer(
      this.numberOfChannels,
      Math.max(this.length, newLength),
      this.sampleRate
    );
    
    // 复制原有数据
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const srcData = this._buffer.getChannelData(channel);
      const dstData = newBuffer.getChannelData(channel);
      dstData.set(srcData);
    }
    
    // 插入新数据
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const srcData = buffer.getChannelData(Math.min(channel, this.numberOfChannels - 1));
      const dstData = newBuffer.getChannelData(channel);
      dstData.set(srcData, positionSample);
    }
    
    this._buffer = newBuffer;
  }
  
  /**
   * 修剪 - 只保留指定范围
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   */
  trim(start: number, end: number): void {
    if (start >= end || start < 0 || end > this.duration) return;
    
    this._saveState();
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    const newLength = endSample - startSample;
    
    const newBuffer = this._context.createBuffer(
      this.numberOfChannels,
      newLength,
      this.sampleRate
    );
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const srcData = this._buffer.getChannelData(channel);
      const dstData = newBuffer.getChannelData(channel);
      dstData.set(srcData.subarray(startSample, endSample));
    }
    
    this._buffer = newBuffer;
  }
  
  /**
   * 静音 - 将指定范围替换为静音
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   */
  silence(start: number, end: number): void {
    if (start >= end || start < 0 || end > this.duration) return;
    
    this._saveState();
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      data.fill(0, startSample, endSample);
    }
  }
  
  /**
   * 反转 - 反转音频
   * 
   * @param start - 起始时间（秒）
   * @param end - 结束时间（秒）
   */
  reverse(start: number, end: number): void {
    if (start >= end || start < 0 || end > this.duration) return;
    
    this._saveState();
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    const length = endSample - startSample;
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      const reversed = new Float32Array(length);
      
      for (let i = 0; i < length; i++) {
        reversed[i] = data[endSample - 1 - i];
      }
      
      data.set(reversed, startSample);
    }
  }
  
  // ============================================
  // 淡入淡出
  // ============================================
  
  /**
   * 淡入 - 渐强
   * 
   * @param start - 起始时间（秒）
   * @param duration - 淡入时长（秒）
   * @param curve - 曲线类型
   */
  fadeIn(start: number, duration: number, curve: FadeParams['curve'] = 'linear'): void {
    this._fade(start, duration, curve, true);
  }
  
  /**
   * 淡出 - 渐弱
   * 
   * @param start - 起始时间（秒）
   * @param duration - 淡出时长（秒）
   * @param curve - 曲线类型
   */
  fadeOut(start: number, duration: number, curve: FadeParams['curve'] = 'linear'): void {
    this._fade(start, duration, curve, false);
  }
  
  /**
   * 淡入淡出
   */
  private _fade(start: number, duration: number, curve: FadeParams['curve'], isFadeIn: boolean): void {
    if (duration <= 0 || start < 0 || start + duration > this.duration) return;
    
    this._saveState();
    
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor((start + duration) * this.sampleRate);
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      
      for (let i = 0; i < endSample - startSample; i++) {
        const t = i / (endSample - startSample);
        const gain = this._applyCurve(t, curve, isFadeIn);
        data[startSample + i] *= gain;
      }
    }
  }
  
  /**
   * 应用曲线
   */
  private _applyCurve(t: number, curve: FadeParams['curve'], isFadeIn: boolean): number {
    let x = isFadeIn ? t : 1 - t;
    
    switch (curve) {
      case 'exponential':
        x = x * x;
        break;
      case 'sigmoid':
        // Sigmoid 曲线
        const k = 10;
        x = 1 / (1 + Math.exp(-k * (x - 0.5)));
        break;
      case 'linear':
      default:
        // 线性（无变化）
        break;
    }
    
    return x;
  }
  
  // ============================================
  // 增益操作
  // ============================================
  
  /**
   * 归一化 - 将峰值调整到指定电平
   * 
   * @param targetDb - 目标峰值电平（dB），默认 -1dB
   */
  normalize(targetDb: number = -1): number {
    const peak = this._getPeak();
    if (peak === 0) return 0;
    
    const targetLinear = Math.pow(10, targetDb / 20);
    const gain = targetLinear / peak;
    
    this._saveState();
    this._applyGain(0, this.duration, gain);
    
    return gain;
  }
  
  /**
   * 增益 - 调整音量
   * 
   * @param gainDb - 增益量（dB）
   */
  gain(gainDb: number): void {
    const linearGain = Math.pow(10, gainDb / 20);
    this._saveState();
    this._applyGain(0, this.duration, linearGain);
  }
  
  /**
   * 应用增益到指定范围
   */
  private _applyGain(start: number, end: number, gain: number): void {
    const startSample = Math.floor(start * this.sampleRate);
    const endSample = Math.floor(end * this.sampleRate);
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      for (let i = startSample; i < endSample; i++) {
        data[i] *= gain;
      }
    }
  }
  
  // ============================================
  // 工具方法
  // ============================================
  
  /**
   * 获取峰值电平
   */
  private _getPeak(): number {
    let peak = 0;
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
      }
    }
    
    return peak;
  }
  
  /**
   * 获取 RMS 电平
   */
  getRMS(): number {
    let sum = 0;
    const total = this.length * this.numberOfChannels;
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
    }
    
    return Math.sqrt(sum / total);
  }
  
  /**
   * 获取峰值时间
   */
  getPeakTime(): number {
    let peak = 0;
    let peakTime = 0;
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const data = this._buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > peak) {
          peak = abs;
          peakTime = i / this.sampleRate;
        }
      }
    }
    
    return peakTime;
  }
  
  /**
   * 导出为 AudioBuffer
   */
  toBuffer(): AudioBuffer {
    return this._cloneBuffer(this._buffer);
  }
  
  /**
   * 克隆缓冲区
   */
  private _cloneBuffer(buffer: AudioBuffer): AudioBuffer {
    const newBuffer = this._context.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      newBuffer.getChannelData(channel).set(buffer.getChannelData(channel));
    }
    
    return newBuffer;
  }
  
  /**
   * 创建带间隙的缓冲区（用于剪切/删除）
   */
  private _createBufferWithGap(removeStart: number, removeEnd: number): AudioBuffer {
    const newLength = this.length - (removeEnd - removeStart);
    const newBuffer = this._context.createBuffer(
      this.numberOfChannels,
      newLength,
      this.sampleRate
    );
    
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
      const srcData = this._buffer.getChannelData(channel);
      const dstData = newBuffer.getChannelData(channel);
      
      // 复制删除段之前的数据
      dstData.set(srcData.subarray(0, removeStart));
      
      // 复制删除段之后的数据
      dstData.set(srcData.subarray(removeEnd), removeStart);
    }
    
    return newBuffer;
  }
}

// ============================================
// 导出
// ============================================

export default WAAudioEditor;
