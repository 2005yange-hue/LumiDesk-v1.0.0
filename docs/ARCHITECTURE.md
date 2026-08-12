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
              │  │  Live2D渲染  │  │  ← 模型展示（规划）
              │  └──────┬──────┘  │
              │         │ IPC     │
              │  ┌──────▼──────┐  │
              │  │  渲染进程     │  │
              │  │  Vue3 App   │  │  ← 聊天UI / 设置 / Live2D
              │  └─────────────┘  │
              └────────┬──────────┘
                       │ HTTP + SSE
                       ▼
              ┌───────────────────┐
              │   NestJS 后端      │
              │  ┌─────────────┐  │
              │  │ ChatModule  │  │  ← SSE 流式 + 上下文编排
              │  │ConversMod  │  │  ← 会话 CRUD + 消息持久化
              │  │ LLMModule   │  │  ← 模型调度
              │  │MemoryModule │  │  ← 长期记忆提取 + 存储
              │  │ VecMemoryMod│  │  ← 向量化 + ChromaDB 检索
              │  │ProviderMod  │  │  ← 多 Provider 管理
              │  │CharacterMod │  │  ← 角色人格管理
              │  │(Audio/Vis)  │  │  ← 未来模块
              │  └─────────────┘  │
              └────────┬──────────┘
                       │ HTTP
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  OpenAI  │ │ ChromaDB │ │  MySQL   │
    │ Compatible│ │   v2     │ │  8.0     │
    │   API    │ │ 向量检索  │ │ 关系存储  │
    └──────────┘ └──────────┘ └──────────┘
```

---

## 二、AI Companion 核心链路

```
用户输入
  │
  ▼
ChatService.sendMessageStream()
  │
  ├── resolveModelConfig()          ← 解析 Provider（providerId → default → .env）
  │
  ├── MemoryExtractor (fire-and-forget)  ← 异步提取长期记忆
  │
  ├── truncateHistory()             ← 截断到 CHAT_CONTEXT_LIMIT 条
  │
  └── PromptContextService.buildMessages()
        │
        ├── 1. system prompt        ← system.txt
        ├── 2. character prompt     ← character.txt / DB 人物设定
        ├── 3. memory context       ← MySQL 记忆 + ChromaDB 语义搜索
        ├── 4. history messages     ← 最近 N 条对话
        └── 5. current user message
  │
  ▼
ContextWindowManager.checkOverflow()
  ├── trim if needed
  │
  ▼
LLMService.chatStream()
  │
  ▼
SSE Stream → 前端渲染 → 持久化到 MySQL
```

---

## 三、前端架构 (Vue3)

### 3.1 目录结构

```
src/
├── views/              # 页面级组件
│   ├── ChatView.vue    # 主聊天界面
│   └── SettingsView.vue # 设置页（Provider + 模型配置）
├── components/         # 可复用组件
│   ├── chat/           # 聊天相关组件
│   ├── settings/       # 设置相关组件
│   │   ├── ProviderDialog.vue    # 新建/编辑 Provider
│   │   └── ProviderSettings.vue  # Provider 列表 + 详情
│   └── live2d/         # Live2D 组件（规划）
├── stores/             # Pinia 状态管理
│   ├── chat.store.ts   # 聊天状态
│   └── provider.store.ts # Provider 状态
├── services/           # API 调用层
│   ├── chat.api.ts     # SSE Chat API
│   └── provider.api.ts # Provider CRUD API
├── types/              # TypeScript 类型
│   ├── chat.types.ts
│   └── provider.types.ts
├── router/             # Vue Router
└── styles/             # 全局样式
    └── global.scss     # CSS 变量体系（light/dark theme）
```

### 3.2 状态管理

| Store | 职责 | 持久化 |
|-------|------|--------|
| `chat.store.ts` | 消息列表、流式状态、AbortController | 无（会话级） |
| `provider.store.ts` | Provider 列表、连接状态、CRUD 操作 | 服务端（MySQL） |

### 3.3 数据流（聊天场景）

```
ChatView.vue
  │ 用户输入
  ▼
chat.store.ts
  │ sendMessage(providerId, model, content, history)
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

## 四、Electron 架构

### 4.1 进程模型

```
┌────────────────────────────────────┐
│          Electron 主进程            │
│                                    │
│  main.ts                           │
│  ├── BrowserWindow                 │
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

### 4.2 window.electronAPI 接口

| 方法 | 用途 | 状态 |
|------|------|------|
| `getAppVersion()` | 获取应用版本 | ✅ 已实现 |
| `platform` | 平台信息 | ✅ 已实现 |
| `captureScreen()` | 屏幕截图 | 📋 规划中 |
| `sendNotification()` | 系统通知 | 📋 规划中 |

---

## 五、后端架构 (NestJS)

### 5.1 模块结构

```
server/src/
├── app.module.ts           # 根模块
├── app.controller.ts       # 健康检查 (/api/health)
├── main.ts                 # NestJS 入口
├── config/                 # 环境配置
├── modules/
│   ├── chat/               # 聊天模块 ✅
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts       # POST /api/chat/send
│   │   ├── chat.service.ts          # 上下文编排 + Provider 解析
│   │   ├── prompt-context.service.ts    # Prompt 上下文构建
│   │   ├── context-window.manager.ts    # Token 管理
│   │   └── dto/
│   ├── llm/                # LLM 调度模块 ✅
│   │   ├── llm.module.ts           # @Global()
│   │   ├── llm.service.ts          # 适配器缓存 + 配置
│   │   ├── llm-adapter.interface.ts
│   │   ├── llm-types.ts            # Runtime / Resolved ModelConfig
│   │   └── adapters/
│   │       └── openai.adapter.ts   # OpenAI 兼容实现
│   ├── memory/             # 长期记忆模块 ✅
│   │   ├── memory.module.ts
│   │   ├── memory.service.ts       # MySQL 持久化
│   │   ├── memory-extractor.service.ts  # LLM 自动提取
│   │   └── entities/
│   │       └── memory-entry.entity.ts
│   ├── vector-memory/      # 向量记忆模块 ✅
│   │   ├── vector-memory.module.ts
│   │   ├── vector-memory.service.ts     # 语义搜索编排
│   │   ├── chroma/
│   │   │   └── chroma.service.ts        # ChromaDB v2 REST 客户端
│   │   └── embedding/
│   │       ├── embedding.service.ts     # Embedding API 调用
│   │       └── embedding.interface.ts
│   ├── provider/           # Provider 管理模块 ✅
│   │   ├── provider.module.ts
│   │   ├── provider.service.ts      # CRUD + 连接测试
│   │   ├── provider.controller.ts   # REST API
│   │   ├── entities/
│   │   │   ├── model-provider.entity.ts
│   │   │   └── provider-model.entity.ts
│   │   └── dto/
│   ├── character/          # 角色模块 ✅
│   │   ├── character.module.ts
│   │   └── character.service.ts
│   ├── conversation/       # 会话管理模块 ✅
│   │   ├── conversation.module.ts
│   │   ├── conversation.service.ts      # 会话 CRUD + 消息持久化
│   │   ├── conversation.controller.ts   # REST API
│   │   └── dto/
│   ├── vision/             # 视觉模块（规划中）
│   ├── audio/              # 语音模块（规划中）
│   └── agent/              # Agent 模块（规划中）
└── prompts/                # Prompt 模板
    ├── system.txt          # 系统指令
    ├── character.txt       # 角色人格
    ├── memory-extraction.txt  # 记忆提取
    └── screen-analysis.txt    # 屏幕分析
```

### 5.2 模块边界原则

```
ChatModule          → 编排层，不实现具体功能
  依赖 ↓
ConversationModule  → 会话生命周期 + 消息持久化 + 历史分页
LLMModule           → 模型调用，不关心 Prompt 内容
ProviderModule      → Provider 管理，不关心聊天流程
CharacterModule     → 角色管理，不关心记忆
MemoryModule        → 长期记忆（MemoryEntry + MemoryExtractor）
VectorMemoryModule  → 向量检索，不关心记忆提取
```

**说明：** ConversationModule 与 MemoryModule 职责分离 —
- ConversationModule 负责会话 CRUD、消息持久化、历史分页、会话元数据
- MemoryModule 负责长期记忆（MemoryEntry 结构化存储 + MemoryExtractor 提取）

**红线：**
- ChatService 不膨胀 — 新功能必须独立 Module
- 模块间通过 Service 接口通信，不直接访问内部实现
- 可选模块（Audio/Vision/Vector 等）失败不影响核心对话

---

### 5.3 Provider 优先级链

```
前端传 providerId
  │ 有 → ProviderService.findProviderById(id)  ← 最优先
  │
  └─ 无 → ProviderService.getDefaultProvider()
        │ 有 → 使用 is_default=true 的 Provider
        │
        └─ 无 → 回退 .env (LEGACY: API_KEY, BASE_URL, MODEL_NAME)

ResolvedModelConfig {
  model, baseURL, apiKey,  ← 从 DB 获取完整 Key
  temperature, maxTokens, topP, stream, timeout,
  customHeaders, customBody
}
```

---

## 六、AI 调用流程（含记忆）

```
1. 用户输入消息
     │
2. ChatView → chat.store → chat.api.ts
     │ POST /api/chat/send { content, history, providerId?, characterId? }
     │
3. ChatService.sendMessageStream()
   ├── resolveModelConfig(providerId)  → 解析 Provider 完整配置
   ├── MemoryExtractor (fire-and-forget)  → 异步提取长期记忆（不阻塞）
   ├── truncateHistory(history)  → CHAT_CONTEXT_LIMIT 截断
   │
   ├── PromptContextService.buildMessages()
   │   ├── 1. loadPrompt('system.txt')
   │   ├── 2. buildCharacterPrompt(characterId)
   │   ├── 3. loadMemories(userMessage)
   │   │       ├── VectorMemoryService.search()
   │   │       │   ├── EmbeddingService.embed()  → 文本向量化
   │   │       │   └── ChromaService.searchSimilar()  → 语义搜索
   │   │       └── MemoryService.searchMemories()  → MySQL 回退
   │   ├── 4. history.slice(-contextLimit)
   │   └── 5. { role: 'user', content: userMessage }
   │
   ├── ContextWindowManager.checkOverflow()  → Token 溢出检查
   │
   ├── LLMService.chatStream(messages, resolvedConfig)
   │   ├── getAdapter(baseURL, apiKey)  → 适配器缓存
   │   └── adapter.chatStream()
   │
4. OpenAIAdapter
   ├── POST {baseURL}/chat/completions
   └── stream: true
     │
5. SSE 逐块返回 → 前端渲染
     │
6. ChatController（SSE 完成后异步）
   └── ConversationService.saveCurrentMessages()
       ├── 保存用户消息 + AI 回复
       ├── message_count += 2（increment 累加）
       └── 首次消息自动生成标题（空标题时）
```

---

## 七、模块通信方式

| 通信路径 | 方式 | 说明 |
|----------|------|------|
| Vue3 ↔ NestJS | HTTP + SSE | REST API + Server-Sent Events 流式 |
| Vue3 ↔ Electron | contextBridge IPC | 安全暴露原生 API |
| NestJS ↔ LLM API | HTTPS | OpenAI 兼容协议 |
| NestJS ↔ ChromaDB | HTTP | REST API v2（tenant/database 路径） |
| NestJS ↔ MySQL | TCP | TypeORM 连接池 |

---

## 八、Prompts 模板管理

所有 Prompt 模板存放在 `server/src/prompts/`（NestJS assets 配置自动复制到 `dist/prompts/`）：

| 文件 | 用途 | 使用模块 |
|------|------|---------|
| `system.txt` | 系统级对话规则 | PromptContextService |
| `character.txt` | 角色人格设定（默认艾莉） | PromptContextService |
| `memory-extraction.txt` | 长期记忆提取 Prompt | MemoryExtractorService |
| `screen-analysis.txt` | 屏幕分析 Prompt | Vision（规划中） |

**管理规则：**
- Prompt 不硬编码 — 统一从文件加载
- 使用 `nest-cli.json` assets 确保构建后可用
- 开发和生产环境路径自动适配

---

## 九、部署架构

开发阶段（当前）：
- Vite Dev Server (5173) + NestJS (3000) + Electron + MySQL + ChromaDB

生产构建：
```
electron-builder
  └── dist-electron/  (Electron 主进程)
  └── dist/           (Vue3 静态资源)
  └── server/dist/    (NestJS 编译输出 + prompts)
  └── release/        (安装包 .exe / .dmg)
```
