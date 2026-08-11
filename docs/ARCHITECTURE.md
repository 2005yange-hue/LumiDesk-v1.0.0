# 系统架构说明

---

## 一、整体架构概览

```
                        用户
                         │
                         ▼
              ┌───────────────────┐
              │   Electron 桌面壳  │
              │  ┌─────────────┐  │
              │  │  主进程       │  │  ← 窗口/截图/通知
              │  │  preload.ts  │  │  ← IPC 桥接
              │  └──────┬──────┘  │
              │         │ IPC     │
              │  ┌──────▼──────┐  │
              │  │  渲染进程     │  │
              │  │  Vue3 App   │  │  ← 聊天UI / Live2D
              │  └─────────────┘  │
              └────────┬──────────┘
                       │ HTTP + SSE
                       ▼
              ┌───────────────────┐
              │   NestJS 后端      │
              │  ┌─────────────┐  │
              │  │  ChatModule │  │  ← SSE 流式聊天
              │  │  LLMModule  │  │  ← 模型调度
              │  │  (未来扩展)  │  │
              │  └─────────────┘  │
              └────────┬──────────┘
                       │ HTTP
                       ▼
              ┌───────────────────┐
              │  OpenAI 兼容 API  │
              │  GPT / DeepSeek   │
              │  Qwen / Claude    │
              └───────────────────┘
```

---

## 二、前端架构 (Vue3)

### 2.1 目录结构

```
src/
├── views/              # 页面级组件
│   ├── ChatView.vue    # 主聊天界面
│   └── SettingsView.vue # 设置页（模型配置）
├── components/         # 可复用组件（规划中）
├── composables/        # 组合式函数（规划中）
├── stores/             # Pinia 状态管理
│   ├── chat.store.ts   # 聊天状态
│   └── settings.store.ts # 设置持久化
├── services/           # API 调用层
│   └── chat.api.ts     # SSE Chat API
├── types/              # TypeScript 类型
│   ├── chat.types.ts
│   └── settings.types.ts
├── router/             # Vue Router
│   └── index.ts
└── styles/             # 全局样式
    └── global.scss
```

### 2.2 状态管理

| Store | 职责 | 持久化 |
|-------|------|--------|
| `chat.store.ts` | 消息列表、流式状态、AbortController | 无（会话级） |
| `settings.store.ts` | API Key、模型参数 | localStorage |

### 2.3 数据流（聊天场景）

```
ChatView.vue
  │ 用户输入
  ▼
chat.store.ts
  │ sendMessage() + getModelConfig()
  ▼
chat.api.ts
  │ Fetch POST + SSE stream
  ▼
/api/chat/send
  │ 流式响应
  ▼
逐块更新 messages.value
  │ 响应式渲染
  ▼
ChatView.vue 显示消息
```

---

## 三、Electron 架构

### 3.1 进程模型

```
┌────────────────────────────────────┐
│          Electron 主进程            │
│                                    │
│  main.ts                           │
│  ├── BrowserWindow (无边框透明)     │
│  ├── IPC 处理器                     │
│  └── 应用生命周期管理                │
│                                    │
│  preload.ts                        │
│  └── contextBridge (安全暴露 API)   │
└────────────┬───────────────────────┘
             │ IPC
┌────────────▼───────────────────────┐
│         Electron 渲染进程            │
│                                    │
│  Vue3 App (Vite HMR)               │
│  ├── ChatView                      │
│  ├── SettingsView                  │
│  └── Live2D Viewer（规划中）        │
└────────────────────────────────────┘
```

### 3.2 window.electronAPI 接口

| 方法 | 用途 | 状态 |
|------|------|------|
| `getAppVersion()` | 获取应用版本 | ✅ 已实现 |
| `platform` | 平台信息 | ✅ 已实现 |
| `captureScreen()` | 屏幕截图 | 📋 规划中 |
| `sendNotification()` | 系统通知 | 📋 规划中 |

---

## 四、后端架构 (NestJS)

### 4.1 模块结构

```
server/src/
├── app.module.ts           # 根模块
├── app.controller.ts       # 健康检查
├── app.service.ts
├── common/                 # 公共模块（拦截器/过滤器/管道）
│   └── config/
├── modules/
│   ├── chat/               # 聊天模块
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts   # POST /api/chat/send
│   │   ├── chat.service.ts      # 上下文组装
│   │   └── dto/
│   ├── llm/                # LLM 调度模块
│   │   ├── llm.module.ts        # @Global() 全局模块
│   │   ├── llm.service.ts       # 运行时配置 + 适配器缓存
│   │   ├── llm-adapter.interface.ts  # 适配器接口
│   │   └── adapters/
│   │       └── openai.adapter.ts     # OpenAI 兼容实现
│   ├── character/          # 角色模块（规划中）
│   ├── memory/             # 记忆模块（规划中）
│   ├── vision/             # 视觉模块（规划中）
│   ├── agent/              # Agent 模块（规划中）
│   ├── emotion/            # 情绪模块（规划中）
│   └── user/               # 用户模块（规划中）
├── database/
│   ├── entities/           # TypeORM 实体（规划中）
│   └── migrations/         # 数据库迁移（规划中）
└── prompts/                # Prompt 模板
    ├── character.txt       # 角色人格
    ├── system.txt          # 系统指令
    ├── memory-extraction.txt  # 记忆提取
    └── screen-analysis.txt    # 屏幕分析
```

### 4.2 LLM 模块架构

```
LLMService (调度层)
  │ resolveConfig(env + runtime)
  │
  ├─ getAdapter(apiKey, baseURL) ──► 适配器缓存 Map
  │
  └─ chatStream(messages, config)
       │
       ▼
     ILLMAdapter (接口)
       │
       ▼
     OpenAIAdapter (实现)
       │
       ▼
     OpenAI API / DeepSeek / Qwen
```

**关键设计决策：**
- LLMService 使用 `RuntimeModelConfig` 合并环境变量 + 前端传参
- 适配器按 `apiKey:baseURL` 缓存，避免重复创建
- 接口层抽象 (`ILLMAdapter`)，方便扩展 Claude / Qwen 等适配器

---

## 五、AI 调用流程

```
1. 用户输入消息
     │
2. ChatView → chat.store → chat.api.ts (Fetch + AbortController)
     │
3. POST /api/chat/send
   Body: { content, history, modelConfig }
     │
4. ChatService.sendMessageStream()
   ├── 加载 system.txt (系统指令)
   ├── 加载 character.txt (角色人格)
   ├── 拼接历史记录 (最近20条)
   └── 拼接用户消息
     │
5. LLMService.chatStream(messages, modelConfig)
   ├── resolveConfig() → 合并 env + runtime
   ├── getAdapter() → 获取/创建适配器
   └── adapter.chatStream()
     │
6. OpenAIAdapter
   ├── POST https://api.openai.com/v1/chat/completions
   ├── stream: true
   └── wrapStream() → AsyncIterable<LLMStreamChunk>
     │
7. ChatController
   ├── for await (chunk of stream)
   └── res.write("data: {content, fullContent, done}\n\n")
     │
8. 前端 Fetch ReadableStream
   ├── reader.read() 逐块解析
   └── 更新 messages.value（响应式渲染）
```

---

## 六、模块通信方式

| 通信路径 | 方式 | 说明 |
|----------|------|------|
| Vue3 ↔ NestJS | HTTP + SSE | REST API + Server-Sent Events 流式 |
| Vue3 ↔ Electron | contextBridge IPC | 安全暴露原生 API |
| NestJS ↔ LLM API | HTTPS | OpenAI 兼容协议 |
| 设置持久化 | localStorage | 浏览器端存储 |

---

## 七、Prompts 模板管理

所有 Prompt 模板独立存放在 `server/prompts/` 目录，不硬编码在代码中：

| 文件 | 用途 | 使用模块 |
|------|------|---------|
| `system.txt` | 系统级对话规则（中文、字数限制、安全规则） | ChatService |
| `character.txt` | 角色艾莉的人格设定 | ChatService |
| `memory-extraction.txt` | 记忆提取 Prompt，输出 JSON | Memory（规划中） |
| `screen-analysis.txt` | 屏幕分析 Prompt，结构化输出 | Vision（规划中） |

ChatService 启动时通过 `fs.readFileSync` 加载 Prompt，注入到每条消息的 system role 中。

---

## 八、部署架构（规划）

开发阶段：
- Vite Dev Server (5173) + NestJS (3000) + Electron

生产构建：
```
electron-builder
  └── dist-electron/  (Electron 主进程)
  └── dist/           (Vue3 静态资源)
  └── server/dist/    (NestJS 编译输出)
  └── release/        (安装包 .exe / .dmg)
```
