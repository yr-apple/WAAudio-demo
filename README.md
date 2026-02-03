# WAAudio Demo

Web Audio API 封装库演示项目

## 功能演示

| 模块 | 功能 | 演示页面 |
|------|------|----------|
| WAAudioContext | 音频上下文管理 | ✅ |
| AudioSource | 音频源（麦克风/文件/振荡器） | ✅ |
| Analyser | 频谱分析、峰值检测 | ✅ |
| Effects | 混响、回声、压缩器 | ✅ |
| Recorder | 录音功能 | ✅ |

## 技术栈

- **构建工具**: Vite
- **前端框架**: Svelte 5
- **语言**: TypeScript
- **代码规范**: 严格类型检查，禁止 any

## 运行

```bash
cd WAAudio-demo
npm install
npm run dev
```

## 开源地址

https://github.com/yr-apple/WAAudio-demo

## 代码规范

本项目遵循严格代码规范：

- ❌ 禁止使用 `any`
- ✅ 完整类型定义
- ⚡ 性能优先实现
- 📦 适度抽象复用
