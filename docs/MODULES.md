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
- `MemoryService` — 对话/消息持久化
- `ProviderService` — Provider 查询与配置解析
- `ConfigService` — 环境变量读取

**不负责：**
- 记忆存储与检索 → MemoryModule / VectorMemoryModule
- 角色管理 → CharacterModule
- Provider 管理 → ProviderModule
- 语音/视觉/Agent → 未来独立模块

**输入：**
```
SendMessageDto {
  content: string          // 用户消息
  history: HistoryMessageDto[]  // 历史消息
  characterId?: string     // 角色 ID
  providerId?: number      // Provider ID
  model?: string           // 模型名称
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
- MySQL 对话与消息持久化（conversations + messages 表）
- 长期记忆结构化存储（memory_entries 表）
- MemoryExtractor：从对话中提取长期记忆（LLM 调用）
- 记忆查询（按 importance 排序 + 类型过滤）

**依赖：**
- TypeORM — MySQL 操作
- `LLMService` — Memory Extractor 调用 LLM
- `PromptContextService` — 加载 memory-extraction.txt 模板

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

---

## VectorMemoryModule

**位置：** `server/src/modules/vector-memory/`

**职责：**
- 文本转向量（Embedding API）
- ChromaDB 向量存储与语义检索
- 向量记忆的完整生命周期管理
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
- 角色 CRUD（characters 表 + JSON 文件持久化）
- 默认角色初始化（艾莉）
- 角色人格 Prompt 构建

**依赖：**
- TypeORM / 文件系统

**不负责：**
- Prompt 上下文组合 → PromptContextService

**输入：**
```
characterId?: string
```

**输出：**
```
Character  { name, personality, background, speakingStyle }
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
**职责：** 行为决策引擎、情绪系统、主动交互触发
**依赖：** VisionModule（环境感知）、MemoryModule（用户画像）、ChatModule（主动发言）
**不负责：** 具体模态实现

### Live2DModule（规划）
**职责：** Live2D 模型加载、表情/动作控制、情绪映射
**依赖：** AgentModule（情绪状态）、AudioModule（口型数据）

---

## 模块间调用规范

1. **单向依赖** — 模块只向下依赖，不形成循环
2. **通过 Service 接口** — 不直接访问其他模块的内部实现
3. **禁止 ChatService 膨胀** — 新功能必须独立模块，ChatService 只做编排
4. **降级优先** — 每个可选模块（VectorMemory、Vision 等）失败时不影响核心对话流程
