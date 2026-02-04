/**
 * WAAudio Recorder - 录音管理器
 */

export class WAAudioRecorder {
  private context: AudioContext;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording: boolean = false;
  private startTime: number = 0;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * 开始录音
   */
  async start(source?: AudioNode): Promise<void> {
    if (this.isRecording) {
      console.warn('已经在录音中');
      return;
    }

    // 获取麦克风
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 创建 MediaRecorder
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    
    this.chunks = [];
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    };
    
    this.mediaRecorder.start(100); // 每 100ms 收集一次数据
    this.isRecording = true;
    this.startTime = Date.now();
    
    console.log('🎙️ 开始录音');
  }

  /**
   * 停止录音
   */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('没有在录音'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.getSupportedMimeType() });
        this.isRecording = false;
        
        // 停止所有 track
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        console.log(`🎙️ 录音结束，时长: ${(Date.now() - this.startTime) / 1000}s`);
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 暂停录音
   */
  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      console.log('🎙️ 录音暂停');
    }
  }

  /**
   * 恢复录音
   */
  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      console.log('🎙️ 录音恢复');
    }
  }

  /**
   * 是否正在录音
   */
  getRecording(): boolean {
    return this.isRecording;
  }

  /**
   * 获取录音时长
   */
  getDuration(): number {
    if (!this.isRecording) return 0;
    return (Date.now() - this.startTime) / 1000;
  }

  /**
   * 下载录音
   */
  async download(blob: Blob, filename: string = 'recording.webm'): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 获取录音 Blob 的 URL
   */
  getBlobURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * 获取支持的 MIME 类型
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'audio/webm';
  }
}

export default WAAudioRecorder;
