# WAAudio Studio 技术架构与开发计划

## 📁 项目结构

```
waaudio/
├── src/
│   ├── core/                    # 核心音频引擎
│   │   ├── index.ts             # 主入口，WAAudioContext
│   │   ├── context.ts           # 音频上下文管理
│   │   ├── source/              # 音频源模块
│   │   │   ├── index.ts
│   │   │   ├── file-source.ts  # 文件音频源
│   │   │   ├── mic-source.ts    # 麦克风源
│   │   │   └── oscillator.ts    # 振荡器
│   │   ├── effects/             # 效果器模块
│   │   │   ├── index.ts
│   │   │   ├── eq.ts            # 均衡器
│   │   │   ├── compressor.ts    # 压缩器
│   │   │   ├── reverb.ts        # 混响
│   │   │   ├── delay.ts         # 延迟
│   │   │   └── distortion.ts    # 失真
│   │   ├── analyser/            # 分析模块
│   │   │   ├── index.ts
│   │   │   ├── spectrum.ts      # 频谱分析
│   │   │   ├── waveform.ts      # 波形分析
│   │   │   └── meter.ts         # 电平表
│   │   ├── recorder/            # 录音模块
│   │   │   └── index.ts
│   │   └── utils/               # 工具函数
│   │       └── index.ts
│   │
│   ├── engine/                   # 混音引擎
│   │   ├── index.ts             # 主引擎
│   │   ├── track.ts            # 轨道
│   │   ├── mixer.ts            # 混音器
│   │   └── session.ts          # 会话管理
│   │
│   ├── editors/                  # 编辑器
│   │   ├── waveform/            # 波形编辑器
│   │   │   └── index.ts
│   │   └── multitrack/          # 多轨编辑器
│   │       └── index.ts
│   │
│   ├── demos/                    # 演示页面
│   │   ├── workstation/         # 音频工作站
│   │   │   └── AudioWorkstation.svelte
│   │   ├── visualizer/          # 频谱可视化
│   │   │   └── SpectrumVisualizer.svelte
│   │   └── oscillator/          # 振荡器演示
│   │       └── OscillatorDemo.svelte
│   │
│   ├── components/               # 通用组件
│   │   ├── transports/          # 播放控制
│   │   ├── meters/              # 电平表
│   │   └── controls/            # 旋钮/滑块
│   │
│   └── types/                    # 类型定义
│       └── index.ts
│
├── test-audio/                   # 测试音频
└── package.json
```

## 🎯 核心设计模式

### 1. 工厂模式 (Factory)
```typescript
// 创建不同类型的音频源
const source = WAAudioSourceFactory.create({
  type: 'file',
  file: audioFile
});

const mic = WAAudioSourceFactory.create({
  type: 'microphone'
});
```

### 2. 链式调用 (Chain)
```typescript
// 效果器链式连接
const chain = new EffectChain()
  .add(new EQ({ low: 2, mid: 0, high: -1 }))
  .add(new Compressor({ threshold: -20, ratio: 4 }))
  .add(new Reverb({ roomSize: 0.5 }));
```

### 3. 观察者模式 (Observer)
```typescript
// 状态变化监听
analyser.on('peak', (value: number) => {
  meter.setValue(value);
});
```

### 4. 单例模式 (Singleton)
```typescript
// 全局音频引擎
const engine = WAAudioEngine.getInstance();
```

## 📋 迭代计划

### Phase 1: 核心引擎 (v1.0.0) ✅ 已完成
- [x] WAAudioContext 基础框架
- [x] 文件音频源
- [x] 基础波形显示
- [x] 简单播放控制

### Phase 2: 效果器系统 (v1.1.0) 🔄 当前
- [x] 均衡器 (3段 EQ)
- [x] 压缩器
- [ ] 混响 (Convolution)
- [ ] 延迟 (Delay)
- [ ] 失真 (Distortion)
- [ ] 效果器路由系统

### Phase 3: 录音功能 (v1.2.0)
- [ ] 麦克风录音
- [ ] 录音波形预览
- [ ] 录音文件导出

### Phase 4: 多轨混音 (v2.0.0)
- [ ] 多轨道支持
- [ ] 轨道音量/声像
- [ ] 混音器界面
- [ ] 发送效果

### Phase 5: 高级编辑 (v2.1.0)
- [ ] 波形剪辑
- [ ] 淡入淡出
- [ ] 归一化
- [ ] 标记点

### Phase 6: 高级效果 (v2.2.0)
- [ ] 降噪
- [ ] 变速不变调
- [ ] 消除人声

## 🔧 核心接口设计

### WAAudioContext
```typescript
interface WAAudioContext {
  // 音频上下文
  readonly context: AudioContext;
  
  // 音频源
  createSource(file: File): Promise<WAAudioSource>;
  createMicrophoneSource(): Promise<MediaStreamAudioSourceNode>;
  createOscillator(type: OscillatorType, frequency: number): WAAudioOscillator;
  
  // 效果器
  createEQ(): WAAudioEQ;
  createCompressor(): WAAudioCompressor;
  createReverb(): WAAudioReverb;
  createDelay(): WAAudioDelay;
  createDistortion(): WAAudioDistortion;
  
  // 分析器
  createAnalyser(): WAAudioAnalyser;
  
  // 录音
  createRecorder(): WAAudioRecorder;
  
  // 混音引擎
  createMixer(): WAAudioMixer;
}
```

### WAAudioSource
```typescript
interface WAAudioSource {
  readonly duration: number;
  readonly playing: boolean;
  
  connect(node: AudioNode): void;
  disconnect(): void;
  
  play(offset?: number): void;
  pause(): void;
  stop(): void;
  
  setVolume(value: number): void;
  setPlaybackRate(value: number): void;
  
  getBuffer(): AudioBuffer | null;
}
```

### WAAudioMixer
```typescript
interface WAAudioMixer {
  addTrack(track: WAAudioTrack): number;
  removeTrack(trackId: number): void;
  
  setMasterVolume(value: number): void;
  getMasterVolume(): number;
  
  setTrackVolume(trackId: number, value: number): void;
  setTrackPan(trackId: number, value: number): void;
  setTrackMute(trackId: number, muted: boolean): void;
  setTrackSolo(trackId: number, solo: boolean): void;
  
  getMasterAnalyser(): AnalyserNode;
}
```

## 📊 当前实现状态

| 模块 | 文件 | 状态 | 类型 |
|------|------|------|------|
| Core | index.ts | ✅ 完成 | Class |
| Core | context.ts | ⚠️ 内联 | - |
| Source | file-source.ts | ❌ 未创建 | - |
| Source | oscillator.ts | ✅ 完成 | Class |
| Effects | eq.ts | ✅ 完成 | Class |
| Effects | compressor.ts | ✅ 完成 | Class |
| Effects | reverb.ts | ✅ 完成 | Class |
| Effects | delay.ts | ✅ 完成 | Class |
| Effects | distortion.ts | ✅ 完成 | Class |
| Analyser | spectrum.ts | ✅ 完成 | Class |
| Recorder | index.ts | ✅ 完成 | Class |
| Engine | mixer.ts | ❌ 未创建 | - |
| Engine | track.ts | ❌ 未创建 | - |

## 🎨 UI 组件规划

```
Workstation (主界面)
├── Toolbar (工具栏)
│   ├── Logo + 标题
│   ├── 文件操作 (打开/保存/导出)
│   └── 设置按钮
│
├── WaveformPanel (波形面板)
│   ├── Canvas 绘制波形
│   ├── 播放头位置
│   ├── 缩放控制
│   └── 循环区域
│
├── SpectrumPanel (频谱面板)
│   └── Canvas 绘制频谱
│
├── TransportPanel (控制台)
│   ├── 时间显示
│   ├── 播放按钮
│   └── 音量/速度
│
└── EffectsRack (效果器机架)
    ├── EQ (均衡器)
    ├── Compressor (压缩器)
    ├── Reverb (混响)
    └── Delay (延迟)
```

## 🚀 下一步任务

### Priority 0 (当前)
1. **重构核心代码** - 分离 source 模块
2. **实现效果器路由** - 效果器可自由连接
3. **完善 EQ 交互** - 拖拽频点

### Priority 1
1. **添加录音功能** - 麦克风实时录音
2. **多轨道支持** - 基础混音引擎
3. **导出功能** - WAV 文件导出

### Priority 2
1. **波形编辑** - 剪辑/淡入淡出
2. **高级效果** - 降噪/变速
3. **预设系统** - 保存/加载设置

---

*文档版本: 1.0.0*
*最后更新: 2026-02-04*
