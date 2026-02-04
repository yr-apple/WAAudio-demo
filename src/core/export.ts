/**
 * WAAudio Export - 音频导出工具
 * 
 * 支持 WAV 导出
 */

// ============================================
// 导出函数
// ============================================

/**
 * 编码为 WAV Blob
 */
export function encodeWAV(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const samples = audioBuffer.length;
  const dataSize = samples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  // WAV 文件头
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // 音频数据
  const offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = audioBuffer.getChannelData(Math.min(channel, numChannels - 1))[i];
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * 写入字符串
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 下载 Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导出为 WAV 文件
 */
export function exportWAV(buffer: AudioBuffer, filename: string = 'export.wav'): void {
  const wavBlob = encodeWAV(buffer);
  downloadBlob(wavBlob, filename);
}

/**
 * 获取 WAV Blob 的 URL
 */
export function getWAVUrl(buffer: AudioBuffer): string {
  const blob = encodeWAV(buffer);
  return URL.createObjectURL(blob);
}

/**
 * 将 AudioBuffer 转换为 MediaStream
 */
function audioBufferToMediaStream(buffer: AudioBuffer): MediaStream {
  const stream = buffer.getChannelData(0) as unknown as MediaStream;
  return stream;
}

/**
 * 导出为 WebM (使用 MediaRecorder)
 */
export async function exportWebM(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  filename: string = 'export.webm'
): Promise<void> {
  // 创建离线上下文渲染
  const offlineContext = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate
  );
  
  // 创建缓冲区源
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineContext.destination);
  source.start();
  
  // 渲染
  const renderedBuffer = await offlineContext.startRendering();
  
  // 创建 MediaRecorder
  const destination = offlineContext.createMediaStreamDestination();
  source.disconnect();
  source.connect(destination);
  
  const mediaRecorder = new MediaRecorder(destination.stream, {
    mimeType: 'audio/webm;codecs=opus'
  });
  
  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e: MessageEvent) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    downloadBlob(blob, filename);
  };
  
  mediaRecorder.start();
  mediaRecorder.stop();
}
