# Changelog

本文件记录项目的所有重要变更。

---

## v0.1.0 — 项目初始化

**日期：** 2026-08-11

### 新增
- 初始化项目架构：Electron + Vue3 + NestJS
- 创建完整目录结构（electron/、src/、server/、shared/、resources/）
- 配置 Vite 构建 + Electron 打包
- 配置 ESLint + Prettier + TypeScript
- 创建开发者文档体系（docs/ 目录 7 份文档）
- NestJS 后端健康检查接口 `GET /api/health`
- Electron 无边框透明窗口 + IPC 通信框架

---

## v0.2.0 — 基础聊天功能

**日期：** 2026-08-11

### 新增
- ChatModule + ChatController：`POST /api/chat/send` SSE 流式接口
- LLM 适配器模块：`ILLMAdapter` 接口 + `OpenAIAdapter` 实现
- 支持 OpenAI / DeepSeek / Qwen 等兼容 API
- Vue3 聊天界面（ChatView）：消息气泡、自动滚动、欢迎页
- Pinia 聊天状态管理（chat.store）
- Fetch + ReadableStream 前端 SSE 解析

### 修改
- `server/src/app.module.ts` — 注册 ChatModule + LLMModule
- `server/src/modules/llm/llm.service.ts` — LLM 调度服务

---

## v0.3.0 — 模型配置与流式优化

**日期：** 2026-08-11

### 新增
- 设置页面（SettingsView）：模型预设选择 + API 配置 + 参数调节
- localStorage 配置持久化（settings.store）
- 5 个预设模型快捷切换（GPT-4o / DeepSeek / Qwen 等）
- 停止生成按钮：AbortController 中断流式请求
- Enter 键智能处理（生成中停止 / 待机中发送）
- RuntimeModelConfig 运行时模型配置（环境变量 + 前端传入合并）

### 修改
- `server/src/modules/llm/llm.service.ts` — 重写，支持运行时配置 + 适配器缓存池
- `server/src/modules/chat/chat.service.ts` — 透传 modelConfig
- `server/src/modules/chat/chat.controller.ts` — Body 接收 modelConfig
- `server/src/modules/chat/dto/send-message.dto.ts` — 新增 ModelConfigDto
- `src/services/chat.api.ts` — 重写，AbortController + modelConfig 传递
- `src/stores/chat.store.ts` — 新增 stopGeneration + 集成 settingsStore
- `src/views/ChatView.vue` — 发送/停止按钮动态切换

---


## v0.4.0 — 角色人格系统

**日期：** 2026-08-11

### 新增
- Character 模块 CRUD 接口（`GET/POST/PUT/DELETE /api/character`）
- `PersonaBuilder` 动态 Prompt 生成器（完整版/精简版）
- 角色数据 JSON 文件持久化（`server/data/characters.json`）
- 前端角色管理界面（设置页新增"角色设置"标签）
- 角色创建/删除/切换功能
- 聊天请求携 characterId 自动使用对应角色人格
- 默认角色"艾莉"自动从 `character.txt` 模板初始化

### 修改
- `server/src/app.module.ts` — 注册 CharacterModule
- `server/src/modules/chat/chat.service.ts` — 集成 CharacterService + PersonaBuilder
- `server/src/modules/chat/chat.controller.ts` — 接收 characterId 参数
- `src/stores/settings.store.ts` — 新增 activeCharacterId
- `src/services/chat.api.ts` — 新增 characterId 参数
- `src/stores/chat.store.ts` — 传递 characterId
- `src/views/SettingsView.vue` — 新增角色管理 + 创建弹窗

### 优化（架构评审 P0）
- 删除 `llm-adapter.interface.ts` 无用 import `Stream from 'openai/streaming'`
- `server/src/main.ts` 注册全局 `ValidationPipe`（whitelist + transform）
- 新增 `PromptContextService` 上下文聚合层，从 ChatService 分离消息组装逻辑，预留 Memory/Vision/Emotion 扩展点
- 修复 `ChatView.vue` 异步函数返回类型 `void` → `Promise<void>`

### 优化（架构评审 P1）
- `RuntimeModelConfig` 类型迁移至独立 `llm-types.ts`，Chat 模块不再依赖 `llm.service` 的类型导出
- 提取 `formatLLMError` 至 `server/src/common/error-formatter.ts` 共享工具类
- 全局 `ResponseInterceptor` 统一 REST API 返回格式：`{ success, data, message, timestamp }`，SSE 接口自动跳过
- `CharacterController` 错误处理改为 `throw NotFoundException`，移除 `return { error }` 模式
- 拆分 `SettingsView.vue` 为 `ModelSettings` / `CharacterSettings` / `AboutSection` 三个子组件
- `Character` 接口提升至 `shared/types/character.ts`，前端通过 `@shared` 别名重导出（服务端受 `rootDir` 限制本地保持同步定义）

---

## v0.5.0 — 记忆系统（Part 1）

**日期：** 2026-08-12

### 新增
- Memory 模块：`MemoryService` + `MemoryModule`（聊天记录持久化）
- TypeORM 实体：`Conversation`（对话表）+ `Message`（消息表）
- MySQL 数据库连接配置（`TypeOrmModule.forRootAsync`，支持 `NODE_ENV` 控制 `synchronize`）
- 聊天消息自动入库：SSE 流式完成后异步保存，失败不影响响应

### 修改
- `server/src/app.module.ts` — 注册 TypeORM + MemoryModule
- `server/src/modules/chat/chat.module.ts` — 导入 MemoryModule
- `server/src/modules/chat/chat.controller.ts` — 注入 MemoryService，流式完成后持久化

### 新增（Commit 3）
- 长期记忆系统：`MemoryEntry` 表 + `MemoryExtractorService`
- LLM 自动提取用户信息（身份/偏好/习惯/兴趣/目标）
- `PromptContextService` 注入长期记忆到对话上下文
- 记忆提取 fire-and-forget 异步流程，不阻塞 SSE 响应

### 修改
- `server/src/modules/memory/memory.service.ts` — 新增 `saveMemoryEntries` / `getMemoriesByUser`
- `server/src/modules/memory/memory.module.ts` — 注册 MemoryEntry + MemoryExtractorService
- `server/src/modules/chat/prompt-context.service.ts` — 注入 MemoryService，加载记忆到上下文
- `server/src/modules/chat/chat.controller.ts` — 注入 MemoryExtractorService，异步提取记忆
- `server/src/modules/chat/chat.service.ts` — `buildMessages` 改为 `await`

### 数据库变化
- 新增 `memory_entries` 表（id / user_id / type / content / importance / created_at / updated_at）

### 新增（Commit 4）
- 向量记忆系统：`VectorMemoryModule` + `VectorMemoryService`
- `EmbeddingProvider` 接口 + `EmbeddingService` 实现（OpenAI Embedding API）
- `ChromaClient` REST API 客户端（Collection 管理 / 向量存储 / 语义检索）
- 记忆向量化流程：MySQL 保存 → Embedding → Chroma 索引
- `PromptContextService` 集成向量语义搜索，优先检索相关记忆，失败回退 MySQL
- 错误降级机制：Embedding/Chroma 不可用时不影响正常聊天

### 修改
- `server/src/modules/vector-memory/` — 新增模块（6 个文件）
- `server/src/modules/chat/chat.controller.ts` — 注入 VectorMemoryService，记忆提取后自动向量化
- `server/src/modules/chat/chat.module.ts` — 导入 VectorMemoryModule
- `server/src/modules/chat/prompt-context.service.ts` — 注入 VectorMemoryService，语义搜索记忆
- `server/src/modules/memory/memory.service.ts` — `saveMemoryEntries` 返回已保存实体
- `server/src/app.module.ts` — 注册 VectorMemoryModule

### 环境变量
- 新增 `EMBEDDING_MODEL` / `VECTOR_COLLECTION` / `VECTOR_TOP_K`

---

## v0.5.1 — 动态 API Provider 管理系统

**日期：** 2026-08-12

### 新增
- Provider CRUD 接口（`GET/POST/PUT/DELETE /api/provider`）
- `ModelProvider` 实体 + `model_providers` 表（TypeORM + MySQL）
- Provider 优先级链：`providerId` → default Provider（`is_default=true`）→ `.env`
- 前端 Provider 管理界面（ProviderSettings + ProviderDialog），酒馆风格设计
- Provider 预设模板（OpenAI / DeepSeek / SiliconFlow / Gemini / OpenRouter / 自定义）
- 连接测试功能（`POST /api/provider/test`）+ 友好错误分类（401/403/404/429）
- 远程模型列表获取（`GET /api/provider/:id/models`）
- API Key 安全隔离：前端永远脱敏（`****`），完整 Key 仅在后端 Service 层使用
- `isMaskedApiKey()` 检测避免脱敏 Key 覆盖 DB

### 修改
- `server/src/modules/provider/` — 新增模块（controller/service/entities/dtos）
- `server/src/modules/chat/chat.service.ts` — `resolveModelConfig()` 三层优先级
- `src/components/settings/ProviderSettings.vue` — Provider 列表 + 详情面板
- `src/components/settings/ProviderDialog.vue` — 新建/编辑弹窗
- `src/stores/provider.store.ts` — Pinia Provider 状态管理
- `src/services/provider.api.ts` — Provider API 封装
- `src/types/provider.types.ts` — Provider 类型定义 + 预设常量

### 数据库变化
- 新增 `model_providers` 表（支持多 Provider 并存）
- 新增 `provider_models` 表（本地模型记录）

---

## v0.5.2 — 模型配置与高级参数

**日期：** 2026-08-12

### 新增
- `provider_type` 字段（openai / deepseek / gemini / claude / openrouter）
- 模型参数：`temperature` / `max_tokens` / `top_p`
- 高级参数：`stream` / `timeout` / `custom_headers` / `custom_body`
- 酒馆风格高级设置折叠区
- 连接测试增强：返回 `tokens` 数量、延迟、友好错误分类
- 模型列表搜索过滤

### 修改
- `server/src/modules/provider/entities/model-provider.entity.ts` — 新增 8 个字段
- `server/src/modules/provider/provider.service.ts` — 测试连接返回增强
- `server/src/modules/provider/dto/create-provider.dto.ts` — 新增高级参数字段
- `server/src/modules/provider/dto/update-provider.dto.ts` — 新增高级参数字段
- `src/components/settings/ProviderDialog.vue` — 高级设置折叠区 + 模型搜索
- `src/components/settings/ProviderSettings.vue` — 模型搜索 + 过滤计数

### 简化
- 移除"已保存模型"UI 和独立"模型配置"设置页，模型选择统一在 Dialog 中完成

---

## v0.5.3 — 系统稳定性与优化

**日期：** 2026-08-12

### 新增
- 对话上下文管理：`CHAT_CONTEXT_LIMIT` 配置（默认 20 条），自动截断历史消息
- `truncateHistory()` 智能截断：保留 system 消息 + 最近对话
- Prompt 加载成功日志（`Loaded prompt: system.txt (214 chars)`）

### 修复
- **ChromaDB v1 → v2 API 迁移**：所有 `/api/v1/collections` 改为 `/api/v2/tenants/default_tenant/databases/default_database/collections`，支持 `CHROMA_API_VERSION` 配置
- **Embedding 降级优化**：`EmbeddingService` 失败时返回 `null` 而非 `[]`，`VectorMemoryService` 检测到 null 后跳过 Chroma 调用，避免 `dimension=0` 误判成功
- **Memory Extractor Prompt 重写**：明确模块身份、强制严格 JSON 输出、多策略 `parseEntries()` 容错解析
- **Prompt 消息顺序优化**：character prompt 移到 memory context 之前，防止记忆内容覆盖角色人格
- **Prompts 资源路径修复**：`server/prompts/` → `server/src/prompts/`，配置 `nest-cli.json` assets 复制到 `dist/`，开发和生产环境均正常加载
- **模型参数 UI 简化**：Temperature / Top-P 删除冗余的 `el-slider`，统一使用 `el-input-number`
- **配置一致性修复**：新建 Provider 补齐 7 个缺失字段（temperature/max_tokens/top_p/stream/timeout/custom_headers/custom_body）；编辑弹窗切换时重置 modelList/showAdvanced；详情页增加高级参数展示；切换模型后刷新 selected 引用

### 修改
- `server/src/modules/vector-memory/chroma/chroma.service.ts` — v1 → v2 迁移
- `server/src/modules/vector-memory/embedding/embedding.interface.ts` — 返回类型改为 nullable
- `server/src/modules/vector-memory/embedding/embedding.service.ts` — 失败返回 null
- `server/src/modules/vector-memory/vector-memory.service.ts` — null 检测跳过 Chroma
- `server/src/modules/memory/memory-extractor.service.ts` — Prompt 重写 + parseEntries()
- `server/src/modules/chat/chat.service.ts` — 新增 contextLimit + truncateHistory()
- `server/src/modules/chat/prompt-context.service.ts` — 配置化 contextLimit + 消息顺序调整 + 成功日志
- `server/nest-cli.json` — 新增 assets 配置
- `server/prompts/` → `server/src/prompts/` — 资源文件迁移
- `src/components/settings/ProviderDialog.vue` — UI 简化 + 字段补齐 + 状态重置
- `src/components/settings/ProviderSettings.vue` — 高级参数展示 + selected 刷新

### 环境变量
- 新增 `CHROMA_API_VERSION`（默认 v2）
- 新增 `CHAT_CONTEXT_LIMIT`（默认 20）

---
## v0.6.0 — Conversation Management

**日期：** 2026-08-12

### 新增
- **ConversationModule** — 会话管理后端模块
- Conversation CRUD API（`GET/POST/PATCH/DELETE /api/conversations`）
- 历史消息分页加载（`GET /api/conversations/:id/messages`，支持 page/limit）
- 会话列表管理（ConversationSidebar，酒馆暗色风格）
- 多会话切换
- 会话删除 / 重命名功能
- 当前会话 localStorage 持久化（key：`conversation_current_id`）
- 自动标题生成（首条消息截断，不调用 LLM）

### 修改
- ChatController 持久化逻辑迁移到 ConversationService
- ChatView 支持 Sidebar 布局
- chat.store 新增会话加载能力（`setMessages` / `loadConversation`）
- `conversation.entity.ts` — 新增 `message_count` 字段（increment 累加，避免 COUNT 查询）

### 数据库变化
- `conversations` 表新增 `message_count` 列（INT, DEFAULT 0）

---

## 后续版本规划

### v0.7.0 — Token 与上下文优化
- Token Budget 管理
- Summary 摘要系统
- 长上下文优化

### v0.8.0 — 多模态与情绪
- Live2D 角色展示（模型加载 / 表情 / 动作）
- 情绪系统
- 视觉感知（Electron 截图采集 / VLM 分析）

### v0.9.0 — Agent 主动交互
- 行为决策引擎
- 主动提醒与通知
