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
              │  │CharStateMod │  │  ← 关系演化/称呼/主动性
              │  │ProactiveMod │  │  ← 事件提醒 + 主动消息 + 冷却策略
              │  │ VecMemoryMod│  │  ← 可选向量化 + ChromaDB 检索
              │  │ProviderMod  │  │  ← 多 Provider 管理
              │  │CharacterMod │  │  ← 角色人格管理
              │  │(Audio/Vis)  │  │  ← 未来模块
              │  └─────────────┘  │
              └────────┬──────────┘
                       │ HTTP
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  OpenAI  │ │ ChromaDB │ │ SQLite/MySQL │
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
  ├── MemoryExtractor (fire-and-forget)  ← 分类 / 置信度提取 → MySQL + Chroma 双写
  │
  ├── CharacterStateService.applyInteraction()  ← 规则更新角色状态（安全降级）
  │
  ├── ConversationSummaryService.getContext()   ← 超过 50 条时摘要旧对话（安全降级）
  │
  ├── truncateHistory()             ← 截断到 CHAT_CONTEXT_LIMIT 条
  │
  └── PromptContextService.buildMessages()
        │
        ├── 1. system prompt        ← system.txt
        ├── 2. character prompt     ← character.txt / DB 人物设定
        ├── 3. character state      ← mood / energy / affinity / relationship_level
        ├── 4. memory context       ← 按关系等级调整记忆数量与权重 → Chroma 搜索 → MySQL 兼容回退 → 更新 last_used_at
        ├── 5. conversation summary ← 压缩后的早期对话（如有）
        ├── 6. history messages     ← 最多 50 条未摘要对话
        └── 7. current user message
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
│   ├── ChatView.vue            # 主聊天界面
│   ├── InitializationView.vue  # 启动初始化引导页
│   ├── MemoryView.vue          # 记忆管理中心
│   └── SettingsView.vue        # 设置页（Provider + 模型 + 角色）
├── components/         # 可复用组件
│   ├── chat/
│   │   └── ConversationSidebar.vue  # 会话列表侧边栏
│   └── settings/
│       ├── ProviderDialog.vue    # 新建/编辑 Provider
│       ├── ProviderSettings.vue  # Provider 列表 + 详情
│       ├── ModelSettings.vue     # 模型参数设置
│       ├── CharacterSettings.vue # 角色管理
│       └── AboutSection.vue      # 关于信息
├── stores/             # Pinia 状态管理
│   ├── chat.store.ts        # 聊天状态
│   ├── conversation.store.ts # 会话状态
│   ├── bootstrap.store.ts   # 启动初始化编排
│   ├── character.store.ts   # 角色缓存
│   ├── provider.store.ts    # Provider 状态
│   ├── memory.store.ts      # 记忆查询、编辑、删除状态
│   ├── notification.store.ts # 主动消息查询与已读状态
│   └── settings.store.ts    # 本地设置
├── services/           # API 调用层
│   ├── chat.api.ts         # SSE Chat API
│   ├── conversation.api.ts # 会话 CRUD API
│   ├── character.api.ts    # 角色 CRUD API
│   ├── provider.api.ts     # Provider CRUD API
│   ├── memory.api.ts       # 记忆 CRUD API
│   ├── notification.api.ts  # 主动消息 API
│   └── health.api.ts       # 健康检查 API
├── types/              # TypeScript 类型
│   ├── chat.types.ts
│   ├── conversation.types.ts
│   ├── character.types.ts
│   ├── provider.types.ts
│   ├── memory.types.ts
│   └── settings.types.ts
├── router/             # Vue Router
│   └── index.ts
├── styles/             # 全局样式
│   └── global.scss     # CSS 变量体系（light/dark theme）
├── App.vue
├── env.d.ts
└── main.ts
```

### 3.2 状态管理

| Store | 职责 | 持久化 |
|-------|------|--------|
| `chat.store.ts` | 消息列表、流式状态、AbortController、历史加载 | 无（运行时，会话级） |
| `conversation.store.ts` | 会话列表、当前会话选择、消息分页加载 | localStorage（当前会话 ID） |
| `bootstrap.store.ts` | 启动初始化任务编排（健康检查 + 数据加载） | 无 |
| `character.store.ts` | 角色列表缓存 | 无（服务端 JSON 文件） |
| `provider.store.ts` | Provider 列表、连接状态、CRUD 操作 | 服务端（MySQL） |
| `settings.store.ts` | 本地设置（模型选择等） | localStorage |

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
├── app.service.ts
├── main.ts                 # NestJS 入口
├── common/                 # 公共工具
│   ├── interceptors/
│   │   └── response.interceptor.ts
│   └── error-formatter.ts
├── database/
│   └── migrations/         # 数据库迁移（预留）
├── modules/
│   ├── chat/               # 聊天模块 ✅
│   │   ├── chat.module.ts
│   │   ├── chat.controller.ts       # POST /api/chat/send
│   │   ├── chat.service.ts          # 上下文编排 + Provider 解析
│   │   ├── prompt-context.service.ts    # Prompt 上下文构建
│   │   └── dto/
│   │       ├── send-message.dto.ts
│   │       └── message-response.dto.ts
│   ├── context-window/     # 上下文窗口管理 ✅
│   │   ├── context-window.module.ts
│   │   ├── context-window.manager.ts    # Token 溢出检查 + 裁剪
│   │   ├── context-window.config.ts
│   │   ├── tokenizer.interface.ts
│   │   └── tokenizers/
│   │       └── gpt-tokenizer.ts
│   ├── llm/                # LLM 调度模块 ✅
│   │   ├── llm.module.ts           # @Global()
│   │   ├── llm.service.ts          # 适配器缓存 + 配置
│   │   ├── llm-adapter.interface.ts
│   │   ├── llm-types.ts            # Runtime / Resolved ModelConfig
│   │   └── adapters/
│   │       └── openai.adapter.ts   # OpenAI 兼容实现
│   ├── memory/             # 长期记忆模块 ✅
│   │   ├── memory.module.ts
│   │   ├── memory.controller.ts    # Memory CRUD API
│   │   ├── memory.service.ts       # MySQL 持久化与同步编排
│   │   ├── memory-extractor.service.ts  # LLM 自动提取
│   │   ├── dto/
│   │   │   └── update-memory.dto.ts
│   │   └── entities/
│   │       ├── conversation.entity.ts
│   │       ├── message.entity.ts
│   │       └── memory-entry.entity.ts
│   ├── vector-memory/      # 向量记忆模块 ✅
│   │   ├── vector-memory.module.ts
│   │   ├── vector-memory.service.ts     # 语义搜索编排
│   │   ├── chroma/
│   │   │   └── chroma.service.ts        # ChromaDB v2 REST 客户端
│   │   └── embedding/
│   │       ├── embedding.service.ts     # Embedding API 调用
│   │       └── embedding.interface.ts
│   ├── proactive-agent/    # 主动智能模块 ✅
│   │   ├── agent-scheduler.service.ts # 启动补扫 + 每日维护
│   │   ├── event-memory.service.ts    # event 记忆日期解析
│   │   ├── notification.service.ts    # 通知 CRUD、去重和冷却
│   │   ├── notification.controller.ts # Notification REST API
│   │   └── entities/
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
│   │   ├── character.controller.ts
│   │   ├── character.service.ts     # JSON 文件持久化
│   │   ├── character.interface.ts
│   │   ├── persona-builder.ts
│   │   └── dto/
│   └── conversation/       # 会话管理模块 ✅
│       ├── conversation.module.ts
│       ├── conversation.service.ts      # 会话 CRUD + 消息持久化
│       ├── conversation.controller.ts   # REST API
│       └── dto/
└── prompts/                # Prompt 模板
    ├── system.txt          # 系统指令
    ├── character.txt       # 角色人格
    ├── memory-extraction.txt  # 记忆提取
    └── screen-analysis.txt    # 屏幕分析
```

> 注：基础事件提醒与主动消息中心已由 `ProactiveAgentModule` 实现；Vision、Audio 与高阶 Agent 决策仍处于规划阶段（详见 MODULES.md）。

### 5.2 模块边界原则

```
ChatModule          → 编排层，不实现具体功能
  依赖 ↓
ConversationModule  → 会话生命周期 + 消息持久化 + 历史分页
ConversationSummaryModule → 长会话摘要 + 有界原文上下文（失败降级）
LLMModule           → 模型调用，不关心 Prompt 内容
ProviderModule      → Provider 管理，不关心聊天流程
CharacterModule     → 角色管理，不关心记忆
CharacterStateModule→ 关系评分、历史、里程碑、称呼规则与主动性，不管理基础角色资料
ProactiveAgentModule→ 事件提醒、主动消息、冷却策略，不做 LLM 自主决策
MemoryModule        → 长期记忆、去重、冲突、评分与维护任务
VectorMemoryModule  → 向量检索/同步，不关心记忆提取
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

记忆管理链路：
```text
MemoryView → memory.store → memory.api
  → MemoryController → MemoryService
    → MySQL memory_entries
    → VectorMemoryService → EmbeddingService / ChromaService
```

编辑会先保存 MySQL 最新内容，再同步 Chroma；同步失败会保留记录并标记 `vector_sync_status=failed`。删除则先删除 Chroma，成功后才删除 MySQL。

主动智能链路：
```text
事件类型 MemoryEntry → EventMemoryService → memory_events
应用启动 / 每日凌晨 → AgentSchedulerService
  → 扫描待提醒事件和近期关切记忆
  → InitiativePolicyService（主动性 × 关系系数）
  → NotificationService 写入 notifications → ChatView 提醒中心
```

调度器只使用确定性文案模板；同一来源记忆去重、同一角色主动消息间隔至少 12 小时，且不会生成无理由的日常问候。

关系演化链路：
```text
成功完成 AI 回复 → ChatController → ChatService.recordCompletedInteraction
  → CharacterStateService.applyInteraction
  → RelationshipEngineService（普通交流/分享/感谢/冲突/长期未互动）
  → character_state 关系分与等级 → relationship_history / relationship_milestones
  → 下一轮 Prompt 注入称呼规则与关系记忆使用策略
```

---

## 六、AI 调用流程（含记忆）

```
1. 用户输入消息
     │
2. ChatView → chat.store → chat.api.ts
     │ POST /api/chat/send { content, history, modelConfig?, characterId?, conversationId? }
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

---

## v0.15 主动通知架构

`NotificationPreferenceService` 解析“全局默认 + 角色覆盖”的最终策略。`AgentSchedulerService` 在启动时补扫一次，此后每 15 分钟扫描；通知创建前统一检查总开关、类别开关、静默时段、每日上限、冷却时间、主动性及关系等级系数。

`NotificationService` 负责应用内通知状态、来源上下文、稍后提醒与取消。`App.vue` 在 Electron 环境每 30 秒查询未投递通知，经安全 preload IPC 调用主进程 Windows `Notification`，成功后回写 `system_notified_at`，防止重启重复弹窗。

## v0.16 会话改写与重建架构

```text
SSE 成功结束
  -> ConversationService 保存同一 turn_id 的消息对
  -> RelationshipInteractionService 写入互动账本并更新关系状态
  -> MemoryService 提取自动记忆并写入 memory_sources

编辑 / 重新生成 / 删除消息
  -> ConversationService 截断消息、重置摘要、更新消息计数
  -> ConversationRebuildService 异步移除当前会话自动来源
  -> 失去全部来源的自动记忆：先删 Chroma，再删 MySQL/事件/未发送通知
  -> 删除失败：memory_entries.deletion_pending=true，维护任务重试
  -> 对剩余用户消息重新提取自动记忆
  -> RelationshipInteractionService 重放角色全部会话互动
```

重放只重建自动派生产物，并保留角色用户手动设定的 `initiative_level`。旧版 `legacy` 记忆始终保留，避免历史数据在用户编辑对话时意外消失。


## v0.17 情绪智能架构

```text
用户消息
  -> EmotionRuleService：同步识别高风险与明显情绪
  -> PromptContextService：高风险时注入当轮安全陪伴指引；否则读取近期情绪摘要
  -> LLM SSE 回复（不等待情绪分析）
  -> ConversationService 持久化消息
  -> EmotionService 异步调用当前 Provider 的结构化分类
  -> EmotionRecordService：规则回退 / 模型结果校验 / manual 保护 / 30 天留存
  -> EmotionContextService：后续当前角色回复使用简短、非诊断性趋势摘要
```

`EmotionModule` 不写入 MemoryModule 或 Chroma，不创建 ProactiveAgent 通知，也不改写 `CharacterState.mood`。它只公开规则、记录、偏好和上下文服务；`ChatModule` 负责在消息持久化后协调异步分析。会话删除与截断由 `ConversationModule` 在同一数据库事务内删除关联情绪记录。
---

## v0.18.0 桌宠形象层

```text
Chat / Emotion / Relationship / Notification
                │ 发布标准 PetEvent
                ▼
           PetEventBus
                │ 安全 IPC 转发
                ▼
Electron PetWindow ──► Live2DManager ──► RendererAdapter (Pixi/Cubism)
                │                         │
                └── 聊天气泡               └── Model Registry / model.json
```

- 主窗口业务层只发布 `PetEvent`，不依赖 Electron、Pixi 或 Cubism。
- Electron 主进程管理模型注册表、`pet.json`、固定资源 URL、配置持久化和独立桌宠窗口；渲染层不能访问任意本地路径。
- `Character.appearance` 通过统一解析函数获得模型绑定，角色未绑定时回退桌宠全局默认模型，再回退头像。
- `Live2DManager` 只接收语义动作；清单把语义动作解析为每个模型实际动作组，因此未来可替换为 VRM 等适配器。

## v0.18.3 Live2D 持续表现引擎

桌宠展示层采用可替换的运行时边界：

```text
业务事件（聊天 / 角色状态 / 用户情绪 / 关系）
  → PetEventBus
  → ContextResolver + PersonalityMapper
  → PresentationEngine
  → PresentationIntent / 表情层 / 动作栈
  → PresentationDriver
  → Live2DPresentationAdapter（当前：Live2DManager）
  → RendererAdapter
  → Cubism / Pixi
```

- `characterMood` 始终是角色的基础状态；`userEmotion` 只推导 `responseAttitude`，避免用户低落时角色错误地显示为“自身悲伤”。
- Expression 和 Motion 是双通道：表达 profile 经 `ParameterNormalizer` 应用强度曲线与模型参数范围后，在 `beforeModelUpdate` 中覆盖 Idle/Motion；动态动作结束后由 `MotionManager` 的层栈恢复，不通过超时回退。
- 眼神跟随、呼吸属于 RendererAdapter 的独立实时参数覆盖通道，既不参与普通优先级栈，也不会逐帧写入 Timeline。
- `ModelRegistry` 是内存能力缓存：只在启动或显式刷新时读取 `model.json`；运行时只查询缓存的 features、动作映射、表情 profile 与系统参数配置。
- `PresentationDriver` 预留 VRM 等后续实现，业务层不感知 Pixi、Cubism、Three.js 或具体模型动作名。
