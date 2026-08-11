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

## 后续版本规划

### v0.5.0 — 记忆系统
- MySQL + TypeORM 数据持久化
- 向量数据库集成（Chroma）
- 聊天记录保存
- 长期记忆提取与检索

### v0.6.0 — Live2D 角色展示
- Live2D 模型加载
- 动作/表情控制
- 情绪-动作映射

### v0.7.0 — 视觉感知
- Electron 截图采集
- VLM 多模态分析
- 环境状态识别

### v0.8.0 — Agent 主动交互
- 行为决策引擎
- 情绪系统动态变化
- 主动提醒与通知
