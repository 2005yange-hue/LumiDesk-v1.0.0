# 模块职责文档

> 记录每个后端模块的职责边界、依赖关系和输入输出，防止功能蔓延。

---

## ChatModule

**位置：** `server/src/modules/chat/`

**职责：**
- 接收用户消息，协调各模块构建完整对话上下文
- 调用 LLM 生成回复（SSE 流式输出）
- 持久化对话和消息到 MySQL
- 触发长期记忆提取（fire-and-forget）
- 管理对话上下文窗口（Token 限制 + 截断）

**依赖：**
- `LLMService` — 模型调用
- `PromptContextService` — 上下文 Prompt 构建
- `ContextWindowManager` — Token 计数与溢出管理
- `MemoryExtractorService` — 长期记忆提取
- `MemoryService` — 长期记忆结构化存储
- `ConversationService` — 会话/消息持久化
- `ConversationSummaryService` — 长会话摘要与受控历史上下文
- `ProviderService` — Provider 查询与配置解析
- `ConfigService` — 环境变量读取

**不负责：**
- 记忆存储与检索 → MemoryModule / VectorMemoryModule
- 角色管理 → CharacterModule
- Provider 管理 → ProviderModule
- 语音/视觉/Agent → 未来独立模块

**输入：**
```
请求体 {
  content: string          // 用户消息
  history?: HistoryMessageDto[]  // 历史消息
  modelConfig?: {          // 运行时模型配置
    providerId?: number    // Provider ID
    model?: string         // 模型名称
    temperature?: number
    maxTokens?: number
  }
  characterId?: string     // 角色 ID
  conversationId?: string  // 会话 ID（本轮消息持久化目标）
}
```

**输出：**
```
SSE stream → Observable<string | MessageEndEvent>
```

---

## LLMModule

**位置：** `server/src/modules/llm/`

**职责：**
- LLM API 调用抽象层
- 多 Provider 适配（OpenAI 兼容接口）
- 支持 chat（非流式）和 chatStream（SSE 流式）
- 统一错误处理

**依赖：**
- `openai` SDK — OpenAI 兼容 API 客户端

**不负责：**
- Provider 选择与配置 → ProviderModule
- Prompt 构建 → PromptContextService
- 上下文管理 → ContextWindowManager

**输入：**
```
ResolvedModelConfig {
  model: string
  baseURL: string
  apiKey: string
  temperature?: number
  maxTokens?: number
  topP?: number
  stream?: boolean
  timeout?: number
  customHeaders?: string
  customBody?: string
}
messages: LLMMessage[]
```

**输出：**
```
Chat (非流式) → { content: string, usage?: ... }
ChatStream (流式) → Observable<string>
```

---

## MemoryModule

**位置：** `server/src/modules/memory/`

**职责：**
- 长期记忆结构化存储（memory_entries 表）
- MemoryExtractor：从对话中提取长期记忆（LLM 调用）
- 记忆分类与质量校验（type / importance / confidence）
- 按角色检索记忆，兼容未绑定角色的历史记录
- 维护 `last_used_at`，为记忆衰减与治理提供依据
- 提供记忆管理 CRUD：按角色查询、编辑类型/内容/重要度、删除记忆
- 维护 MySQL 记录与 Chroma 向量的同步状态及失败原因
- MemoryDeduplicationService：新记忆写入前执行向量/文本去重，并识别替代性冲突
- MemoryScoringService：按重要度、置信度、使用频率与关系权重计算 `memory_score`
- MemoryMaintenanceService：每日凌晨执行衰减、归档、重复扫描和失败向量重试

> 注：`conversations` / `messages` 实体定义在 `memory/entities/` 目录，但会话与消息的持久化逻辑已迁移至 ConversationModule（`conversation.service.ts`）。

**依赖：**
- TypeORM — MySQL 操作
- `LLMService` — Memory Extractor 调用 LLM
- `CharacterModule` — 解析默认角色并绑定新记忆

**不负责：**
- 向量化与语义搜索 → VectorMemoryModule
- 记忆检索时的向量匹配 → VectorMemoryService

**输入（Extractor）：**
```
content: string   // 用户消息
modelConfig: ResolvedModelConfig
```

**输出（Extractor）：**
```
MemoryEntryData[]  // 提取的记忆条目
```

**管理 API：**
```text
GET    /api/memory/:characterId
PATCH  /api/memory/:id
DELETE /api/memory/:id
```

编辑或删除操作由 MemoryService 校验默认用户归属；删除采用 Chroma 成功后再删除 MySQL 的顺序，失败时保留记录并标记 `vector_sync_status=failed`。

**智能记忆规则：** 只有 `status=active` 的记忆会参与 Prompt 注入。被新信息替代的记录保留为 `superseded` 历史，低价值旧记忆可归档为 `archived`；向量结果会回查 MySQL 最新状态，避免 Chroma 旧 metadata 将历史记忆重新注入对话。

---

## VectorMemoryModule

**位置：** `server/src/modules/vector-memory/`

**职责：**
- 文本转向量（Embedding API）
- ChromaDB 向量存储与语义检索
- 向量记忆的完整生命周期管理
- 记忆向量更新与删除
- 为去重、状态更新和维护任务提供语义搜索与 metadata 同步
- 安全降级：无配置时跳过，不影响聊天

**依赖：**
- `EmbeddingService` — 文本向量化
- `ChromaService` — ChromaDB REST API 客户端

**不负责：**
- 记忆内容提取 → MemoryExtractorService
- 结构化存储 → MemoryService

**输入（index）：**
```
memoryId: string
userId: string
content: string
metadata: Record<string, unknown>
```

**输入（search）：**
```
query: string
userId: string
topK?: number
```

**输出（search）：**
```
MemorySearchResult[]  // 相似记忆列表
```

**降级逻辑：**
```
无 EMBEDDING_API_KEY → EmbeddingService 返回 null → 跳过 → 返回空
```

---

## ConversationModule

**位置：** `server/src/modules/conversation/`

**职责：**
- 管理用户聊天会话
- 会话 CRUD（创建/查询/更新/删除）
- 历史消息分页查询
- 聊天消息持久化（用户消息 + AI 回复）
- `message_count` 缓存维护（increment 累加，避免 COUNT 查询）

**依赖：**
- TypeORM — MySQL 操作 (Conversation + Message 实体)

**不负责：**
- LLM 调用 → LLMModule
- Prompt 构建 → PromptContextService
- 长期记忆提取 → MemoryModule
- Provider 管理 → ProviderModule

**输入：**
```
用户消息 / AI 回复 / CreateConversationDto / UpdateConversationDto
```

**输出：**
```
Conversation / Message / 会话列表
```

---

## ConversationSummaryModule

**位置：** `server/src/modules/conversation-summary/`

**职责：**
- 在未摘要消息超过 50 条时，将较早消息合并为 `conversations.summary`
- 通过 `summary_message_count` 标记已压缩记录，保留数据库原始消息以支持历史浏览
- 向 ChatModule 提供「摘要 + 最多 50 条未摘要原文」的有界上下文
- 摘要生成、数据库读取或写入失败时安全回退，不阻断 SSE 聊天

**依赖：**
- TypeORM — `Conversation` / `Message` 读写
- `LLMService` — 使用当前已解析 Provider 生成非流式摘要

**不负责：**
- 会话 CRUD 与消息保存 → ConversationModule
- 最终 Prompt 组合 → PromptContextService

---

## ProviderModule

**位置：** `server/src/modules/provider/`

**职责：**
- Provider CRUD（model_providers 表）
- 提供商模型列表管理（provider_models 表）
- 连接测试（发起实际 API 请求）
- 远程模型列表获取
- Provider 优先级解析：providerId → is_default → .env
- API Key 安全：前端脱敏，后端查询完整 Key

**依赖：**
- TypeORM — MySQL 操作

**不负责：**
- 实际 LLM 调用 → LLMModule
- 模型参数在聊天中的使用 → ChatService（resolveModelConfig）

**输入（CRUD）：**
```
CreateProviderDto / UpdateProviderDto
```

**输出：**
```
ModelProvider (masked for frontend, full for backend)
```

---

## CharacterModule

**位置：** `server/src/modules/character/`

**职责：**
- 角色 CRUD（JSON 文件持久化，`server/data/characters.json`）
- 默认角色初始化（艾莉）
- 角色人格 Prompt 构建（PersonaBuilder）

**依赖：**
- 文件系统（Node.js fs）

**不负责：**
- Prompt 上下文组合 → PromptContextService

**输入：**
```
characterId?: string
```

**输出：**
```
Character  { id, name, personality, background, speakingStyle, likes, dislikes, ... }
```

---

## CharacterStateModule

**位置：** `server/src/modules/character-state/`

**职责：**
- 管理角色运行态（`character_state` 表）：心情、精力、0.1 精度关系分、关系等级、主动互动意愿、累计互动与共同经历
- 首次读取时为已存在角色创建默认状态
- 在每次成功 AI 回复后由 `RelationshipEngineService` 基于用户消息、AI 回复与互动间隔计算关系分变化
- 记录跨等级变化到 `relationship_history`，并解锁 `relationship_milestones`
- 根据关系等级和角色 `addressingRules` 生成称呼、语气、主动关心和记忆策略
- 将状态格式化为独立 system prompt，供 `PromptContextService` 注入

**依赖：**
- TypeORM — `character_state`、`relationship_history`、`relationship_milestones` 表读写
- CharacterModule — 校验角色 ID、解析默认角色与称呼规则

**不负责：**
- 角色基础资料与人格管理 → CharacterModule
- 对话编排与 LLM 调用 → ChatModule / LLMModule
- 主动消息调度与通知持久化 → ProactiveAgentModule
- 记忆内容 CRUD 与向量同步 → MemoryModule / VectorMemoryModule
- 复杂情绪推理与跨模态行为决策 → 后续 EmotionModule / AgentModule

**输入/输出：**
```
输入：characterId?、当前用户消息
输出：CharacterState { mood, energy, affinity, relationship_level, initiative_level, interaction_count, shared_experience_count, last_interaction_at }
关系查询输出：RelationshipProfile { state, days_known, history, milestones }
```

---

## ProactiveAgentModule

**位置：** `server/src/modules/proactive-agent/`

**职责：**
- 将带日期表达的 `event` 长期记忆解析为 `memory_events`，并在编辑、替代、删除时同步重排或取消。
- 应用“主动性 × 关系等级”策略决定是否可以发送消息；有效值低于 30 时不触发。
- 启动补扫并在每天凌晨扫描待提醒事件、近期压力/焦虑等关切记忆。
- 将事件提醒和关切消息持久化到 `notifications`，提供未读查询和已读标记 API。
- 对同一角色应用 12 小时冷却、按来源记忆去重；仅使用确定性文案模板，绝不调用 LLM。

**依赖：**
- TypeORM — `memory_entries`、`memory_events`、`notifications` 表读写
- CharacterStateModule — 读取关系等级和主动性
- MemoryModule — 通过公开的 EventMemoryService 接入记忆生命周期

**不负责：**
- 记忆提取、去重、冲突治理与向量同步 → MemoryModule / VectorMemoryModule
- 无理由的每日问候、模型自主决策或桌面系统通知 → 后续 AgentModule / Electron 层

**输入/输出：**
```
输入：event 类型 MemoryEntry、CharacterState、调度时间
输出：MemoryEvent、Notification
```

---

## 未来模块规划

### AudioModule（规划）
**职责：** TTS 文本转语音、STT 语音转文字、口型同步数据生成
**依赖：** ChatModule（获取 LLM 输出文本）
**不负责：** Live2D 渲染 → Live2DModule

### VisionModule（规划）
**职责：** Electron 截图采集、VLM 多模态分析、环境状态识别
**依赖：** Electron IPC
**不负责：** Agent 行为决策 → AgentModule

### AgentModule（规划）
**职责：** 高阶行为决策、情绪推理与跨模态主动交互；基础事件提醒与消息中心已由 ProactiveAgentModule 实现
**依赖：** VisionModule（环境感知）、MemoryModule（用户画像）、ProactiveAgentModule（已持久化的提醒）
**不负责：** 具体模态实现

### Live2DModule（v0.18.0）

**职责：** 通用角色形象加载、模型注册、语义动作解析、桌宠展示与降级。

**核心组件：**
- `ModelRegistry`：扫描内置/开发者模型清单，校验资源路径和状态。
- `Live2DManager` / `RendererAdapter`：加载、卸载、动作、表达、缩放与点击交互；不向业务层泄漏 Pixi/Cubism。
- `PetEventBus`：接收聊天、角色状态及未来情绪/关系/通知事件，转化为展示行为。
- `CharacterAppearance`：解析角色专属模型、全局默认模型与头像回退。

**不负责：** 聊天持久化、记忆写入、情绪记录、关系计算、通知创建或模型调用。
---

## 模块间调用规范

1. **单向依赖** — 模块只向下依赖，不形成循环
2. **通过 Service 接口** — 不直接访问其他模块的内部实现
3. **禁止 ChatService 膨胀** — 新功能必须独立模块，ChatService 只做编排
4. **降级优先** — 每个可选模块（VectorMemory、Vision 等）失败时不影响核心对话流程
5. **状态不信任前端** — CharacterState 仅由服务端互动规则更新，前端只读取展示

---

## v0.15 / v0.16 模块职责补充

- `ProactiveAgentModule`：通知偏好继承、通知上下文、稍后提醒、忽略与 15 分钟调度策略；不直接调用 LLM。
- `ConversationModule`：分页、消息轮次、编辑/重新生成/删除/导出，以及 `ConversationRebuildService` 对会话派生产物的一致性重建。
- `MemoryModule`：自动记忆来源记录（`MemorySource`）、来源删除、向量失败的待删除状态及每日维护重试。
- `CharacterStateModule`：`RelationshipInteractionService` 持久化每轮关系信号，并可通过账本重放 affinity、关系等级、历史和里程碑。
- `ChatModule`：在 SSE 完成后协调消息持久化、自动记忆来源和关系互动写入；不在流式生成开始前创建不可追溯的自动记忆。
- `electron/main.ts` / `preload.ts`：仅暴露 `sendNotification` 安全 IPC，渲染层不能访问任意 Electron API。


## EmotionModule

**位置：** `server/src/modules/emotion/`

**职责：** 按角色隔离地识别、保存、汇总和管理用户情绪；提供 30 天留存、手动纠错、高风险安全规则与 Prompt 上下文。

**核心组件：**
- `EmotionRuleService`：本地关键词规则与高风险识别，确保不依赖模型也有安全兜底。
- `EmotionService`：在 SSE 回复后非阻塞调用当前 Provider，校验结构化 JSON，并在模型失败时回退规则结果。
- `EmotionRecordService` / `EmotionPreferenceService`：情绪 CRUD、默认用户开关、趋势汇总和到期清理。
- `EmotionContextService`：只生成短小、非诊断性的近期状态提示，供 `PromptContextService` 注入。

**不负责：** 长期记忆提取与向量索引、通知调度、角色自身 `mood` 变化、心理诊断或线下干预。

## Live2D Presentation Engine（v0.18.3）

- `PresentationEngine`：消费标准桌宠事件，维护角色基础心情、用户回应态度、聊天阶段、调试快照和最近 100 条生命周期 Timeline。
- `ContextResolver` / `PersonalityMapper`：区分用户情绪与角色状态，并按 default、gentle、energetic、cold_lady 生成同一语义下的表现意图。
- `ExpressionManager`：维护带 priority/intensity/curve/source 的表达层；持续 mood 不会因 Idle Motion 自动消失。
- `MotionManager`：维护动作优先级栈、一次性动作完成回调、队列和 cancel/pause/queue/ignore 中断策略；互动结束后恢复原表现层。
- `ParameterNormalizer`：将标准 profile 值按 linear/easeIn/easeOut/soft 曲线、模型实际参数范围与 blend 策略写入最终渲染器。
- `EyeController` / `BreathingController`：提供平滑眼球追踪与带确定性微扰的非对称呼吸，不污染普通状态 Timeline。
- `PixiLive2DRendererAdapter`：唯一直接操作 Cubism 参数的模块；在 `beforeModelUpdate` 中按 Motion → Expression → System Parameters 顺序提交最终参数。
