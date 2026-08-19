## v0.18.4 — Live2D 渲染修复

**日期：** 2026-08-17

### 修复
- 显式注册 `pixi-live2d-display` 的 Pixi `Ticker`，修复模型资源已加载但没有持续更新、桌宠只显示聊天气泡的问题。
- 模型加载期间保留头像降级视图，避免异步加载失败时出现只有气泡的空白桌宠窗口。
- 使用 Live2D 模型本地边界重新计算初始尺寸，降低模型尺寸测量异常导致模型移出视口或被裁切的概率。

---
## v0.18.3 — Live2D 持续表现引擎

**日期：** 2026-08-17

### 新增
- 新增 `PresentationEngine`、上下文/人格映射、表情层、动作层、动作队列、表现快照、强度曲线与最近 100 条表现生命周期 Timeline。
- 模型清单新增 `features`、`expressionProfiles`、眼神跟随和呼吸配置；注册表在启动或显式刷新时缓存清单，运行态不重复读取模型文件。
- Hiyori Free 使用参数表情 profile + Idle 动作保持 happy/concerned/tired，新增平滑眼神跟随、带确定性微扰的呼吸参数层。
- 角色形象配置新增 `appearance.presentationStyleId`，可选择 default、gentle、energetic、cold_lady 四种表现风格。
- 开发环境 `#/pet?debug=1` 新增表现调试面板，可查看层栈、参数、队列、Timeline，并通过 PresentationEngine 触发表现测试。

### 调整
- 桌宠展示链路固定为 `PetEventBus → ContextResolver + PersonalityMapper → PresentationEngine → PresentationDriver → Live2DManager → RendererAdapter`；聊天、情绪、关系和通知不直接调用 Pixi、Cubism、Motion 或参数接口。
- 角色自身 mood 与用户 emotion 分离：用户情绪仅转为角色的关怀/鼓励/庆祝回应态度，不直接覆盖角色自身状态。
- RendererAdapter 在 Cubism `beforeModelUpdate` 阶段先让 Motion/Idle 更新，再重写表情 profile，最后写眼神和呼吸专属参数；持续表情不再被 Idle Motion 覆盖。
- 一次性互动、关系动作与聊天阶段均由 MotionManager 完成回调恢复上层栈，移除旧桌宠控制器中的定时恢复逻辑；SSE 只有首个 `chat_delta` 会切换到 speaking。

---
## v0.18.2 — 桌宠表现增强

**日期：** 2026-08-17

### 调整
- 缩短模型与右键操作面板的间距，使菜单更贴近桌宠。
- 修复打开右键菜单时原生窗口先扩展、渲染端后更新导致的模型左移抽动；桌宠窗口现在始终预留透明菜单区域，打开/关闭菜单不再改变窗口边界。
- 修复 `Start.bat` 与 Vite Electron 插件重复启动桌面进程的问题；脚本现在等待 Vite 自动启动 Electron，仅在桌面进程缺失时启动恢复实例，并在失败时保留窗口显示错误。
- 新增桌宠展示控制器：聊天思考、流式说话、点击互动、周期性待机和用户消息情绪均会驱动语义动作。
- 用户表达焦虑、低落、愤怒或疲惫时，桌宠会保持关切/疲惫状态；恢复时先缓冲到平静，再回到角色基础心情或积极状态，避免表情突变。
- Hiyori Free 清单补充 thinking/speaking 语义动作映射；动作继续仅由模型清单定义，不向业务层暴露具体动作组名称。

---

## v0.18.1 — 桌宠交互修复

**日期：** 2026-08-17

### 调整
- 桌宠改为仅在 Live2D 有效命中区右键时打开纵向操作面板；模型外透明区域使用鼠标穿透，普通左键不再跳转主聊天窗口。
- 右键面板新增“对话、语音、听歌、缩放”主操作，并保留置顶、重置位置和隐藏桌宠；语音、听歌当前只显示筹备中反馈，不调用音频能力。
- 模型视口与菜单窗口外壳分离：菜单打开时扩展窗口并选择屏幕空间更充足的一侧，关闭后还原为模型视口，避免缩放时模型与操作面板被裁切。
- 头像降级视图同步采用圆形有效命中区，避免透明空白区域误触。

---

## v0.18.0 — 通用角色形象与 Live2D 桌宠框架

**日期：** 2026-08-17

### 新增
- 新增独立透明 Electron 桌宠窗口：默认置顶、自由拖动、`Ctrl + 鼠标滚轮` 缩放、位置/缩放/置顶持久化，以及聊天窗口聚焦与隐藏控制。
- 新增通用模型注册表和 `model.json` 清单：支持内置与开发者扩展模型目录、Cubism 3/4 运行时、能力描述、语义动作映射、安全路径校验与 READY/INVALID/LOADING/FAILED/DISABLED 生命周期状态。
- 新增 Live2D 核心层：`Live2DManager`、渲染适配器、语义动作解析和头像降级，不让业务模块直接依赖 Pixi/Cubism。
- 新增 `PetEventBus`：聊天流式事件、角色切换和角色状态统一经事件总线镜像给桌宠；气泡不写入聊天、记忆、情绪、关系或通知数据。
- 角色资料新增可选 `appearance` 对象；角色可绑定模型或继承全局默认模型，预留表情、动作、背景与主题配置。

### 调整
- Hiyori Free 作为首个内置测试模型移动到 `resources/live2d/hiyori_free`，保留原始许可文件；模型资源和 Cubism Core 通过 Electron Builder 运行时复制。
- 角色编辑页新增“角色形象”选择；设置页新增“桌宠形象”配置、模型状态及开发者手动添加模型说明。

---
## v0.17.0 — Emotional Intelligence

**日期：** 2026-08-17

### 新增
- 新增 `EmotionModule`：以规则兜底、结构化 LLM 识别为主的六类用户情绪智能层，支持 happy、calm、anxious、sad、angry、tired 与 1–5 强度、置信度。
- 新增独立 `/emotion` 情绪中心：展示当前角色最近 7/30 天的概览、分布和可滚动记录，支持人工修正、单条删除与一键清除。
- 新增情绪隐私开关；关闭后停止新消息识别和 Prompt 情绪上下文注入，既有记录仅在用户显式清除或 30 天到期后删除。
- 新增高风险规则：自伤/自杀相关表达只注入当轮安全陪伴指引，不写入普通情绪记录、长期记忆或主动通知。
- 会话删除或消息截断时同步清理关联情绪记录，防止已删除内容继续影响后续回复。
- Electron 默认窗口调整为居中 1180×820（最小 960×640），新增自定义最小化、最大化/还原和关闭按钮。
- 修复设置页、主动提醒、情绪中心与记忆中心的可用高度和滚动容器约束，长内容可使用鼠标滚轮完整浏览。

### 数据库变化
- 新增 `emotion_records` 与 `emotion_preferences`。

---
## 未发布 — Chat Request Validation

### 修复
- 修复 `POST /api/chat/send` 使用内联请求类型导致全局 `ValidationPipe` 不生效的问题。
- 聊天请求现在统一使用 `SendMessageDto`，校验消息内容、历史消息、模型配置、角色 ID 和会话 ID。
- 空消息或非法请求现在返回 HTTP 400，不再以 HTTP 200 SSE 错误事件响应。

---

## v0.14.0 — Relationship Evolution

**日期：** 2026-08-16

### 新增
- `RelationshipEngineService`：在成功完成 AI 回复后按本地可解释规则计算关系分变化；普通交流 +0.1、感谢 +1、个人经历 +2、长期未互动 -0.5、明确冲突 -3。
- 关系等级历史：跨越陌生、熟悉、朋友、亲密、特殊关系边界时写入 `relationship_history`。
- 关系里程碑：初次交谈、相识一周/一月、三十次交流、首次分享兴趣与重要时刻陪伴写入 `relationship_milestones`。
- 角色称呼规则：角色 JSON 新增 `addressingRules`，并按当前关系等级注入 Prompt。
- Memory 页面新增关系成长卡片，展示相识天数、累计互动、共同经历、等级变化和里程碑。
- 新增 `GET /api/relationship/:characterId`。

### 数据库变化
- `character_state` 的 affinity 升级为 FLOAT，并新增 `interaction_count`、`shared_experience_count`。
- 新增 `relationship_history`、`relationship_milestones`。

---

## v0.13.0 — Proactive Agent

**日期：** 2026-08-16

### 新增
- 新增 `ProactiveAgentModule`：将带时间表达的 `event` 记忆解析为可调度事件，应用启动时补扫并在每天凌晨扫描提醒。
- 新增 `memory_events`：记录事件时间、提醒时间和 pending/sent/cancelled/expired 生命周期。
- 新增持久化主动消息中心与 Notification API：聊天页可查看未读提醒并标记已读。
- 新增角色 `initiative_level`（0–100）设置；实际主动触发值按陌生 0.3、熟悉 0.5、朋友 0.7、亲密/特殊 1.0 的关系系数折算。
- 新增来源记忆去重与同角色 12 小时冷却，事件提醒与压力/焦虑关切均不调用 LLM，也不生成无理由日常问候。

### 数据库变化
- `character_state` 新增 `initiative_level`。
- 新增 `memory_events` 与 `notifications`，分别持久化提醒日程和主动消息状态。

---

## v0.12.0 — Memory Intelligence

**日期：** 2026-08-16

### 新增
- MemoryDeduplicationService：新记忆写入前使用向量语义搜索与文本相似度识别重复信息，阈值为 0.85，并合并内容、重要度和置信度。
- 冲突与替代检测：出现“更喜欢、不再、改为”等语义时，旧记忆标记 `superseded` 并关联新的替代记忆。
- MemoryScoringService：根据 importance、confidence、usage_count 与关系类型权重计算 `memory_score`，用于 MySQL 与向量检索排序。
- MemoryMaintenanceService：每日凌晨执行记忆衰减、低价值归档、历史重复扫描和失败向量重试。
- Memory 页面新增历史记忆区域，展示已替代/归档记录、替代关系、质量分和使用次数。

### 数据库变化
- `memory_entries` 新增 `status`、`replacement_memory_id`、`usage_count`、`memory_score`、`last_decay_at`。
- Prompt 仅注入 `status=active` 的记忆；向量检索结果会回查 MySQL，防止旧向量绕过状态过滤。

---

## v0.11.0 — Memory Management Center

**日期：** 2026-08-16

### 新增
- 新增独立 `/memory` 记忆管理页面，按关系、偏好、性格、事件和事实分组展示长期记忆。
- 新增记忆编辑能力，可修改类型、内容和重要度；置信度保持为提取器字段。
- 新增 `GET /api/memory/:characterId`、`PATCH /api/memory/:id`、`DELETE /api/memory/:id`。
- 新增 Chroma 向量更新与删除能力。

### 数据库变化
- `memory_entries` 新增 `vector_sync_status` 和 `vector_sync_error`，用于记录 MySQL 与 Chroma 的同步状态。
- 删除记忆时改为 Chroma 成功后再删除 MySQL；失败记录保留并可重试。

---

## v0.10.0 — Character Relationship System

**日期：** 2026-08-16

### 新增
- `character_state.relationship_level`：根据 affinity 区间推导陌生、熟悉、朋友、亲密、特殊关系五级关系。
- 关系等级 Prompt 规则：分别影响称呼、语气和主动关心程度，并限制无依据的亲密表达。
- 关系等级记忆策略：动态调整长期记忆注入数量、重要度权重和 relationship 类型记忆优先级。
- 聊天页状态指示器展示关系等级与亲密度。

### 数据库变化
- `character_state` 表新增 `relationship_level` 字段；服务启动时会同步已有状态记录。

---

## v0.9.0 — Chat Context Optimization

**日期：** 2026-08-16

### 新增
- `ConversationSummaryModule`：未摘要消息超过 50 条时，使用当前 Provider 将较早对话合并为摘要。
- `conversations.summary` 与 `summary_message_count`：持久化摘要及其覆盖的消息偏移量；原始 `messages` 不删除，历史浏览保持完整。
- `conversation-summary.txt`：独立摘要 Prompt，要求只归纳事实、禁止执行历史内容中的指令或编造细节。

### 修改
- Chat 请求携带 `conversationId` 进入 ChatService；Prompt 顺序扩展为 `system → character → state → memory → summary → history → user`。
- 摘要会话最多向模型提供 50 条未摘要原文；摘要生成、读取或保存失败时回退既有历史截断流程，不影响 SSE 聊天。

### 数据库变化
- `conversations` 表新增 `summary`（TEXT, NULL）与 `summary_message_count`（INT, DEFAULT 0）。

---

## v0.8.1 — Long-term Memory Upgrade

**日期：** 2026-08-16

### 新增
- `memory_entries` 增加 `character_id`、`confidence`、`last_used_at` 字段；历史记录保持可用
- 记忆分类升级为 preference / personality / event / relationship / fact
- 记忆提取 Prompt 改为文件化加载，严格输出分类、重要度和置信度
- Chroma 元数据保存角色 ID、重要度和置信度；语义检索按当前用户和角色范围过滤

### 修改
- 记忆命中后异步更新 `last_used_at`；向量失败时回退当前角色及历史兼容记忆的 MySQL 查询
- 新记忆自动绑定当前角色，Prompt 注入保留类型、相似度和置信度信息

---

## v0.8.0 — State-aware Reply Style

**日期：** 2026-08-16

### 修改
- 扩展 `CharacterStateService.formatPrompt()`，增加 `<reply_guidance>` 状态回复指令
- `concerned` 优先触发共情、少玩笑与单个开放式追问
- `tired` 或精力不高于 30 时要求简短克制，避免过度热情
- 亲密度高于 80 时允许更熟悉的称呼与语气，但只可引用已有记忆或历史，禁止编造共同经历
- 规则按“关切情感表达 → 低精力篇幅 → 高亲密度熟悉感”分层叠加，不改变状态表、接口和前端结构

---

## v0.7.0 — Character State System

**日期：** 2026-08-16

### 新增
- `CharacterStateModule`：管理角色心情、精力、亲密度与最近互动时间
- MySQL `character_state` 表；以 `character_id` 逻辑关联 JSON 角色资料
- `GET /api/character-state/:characterId` 状态读取接口，首次读取自动初始化
- 前端 `character-state.store` 与角色状态 API，聊天页展示当前状态
- Chat 上下文新增角色状态 system prompt，顺序为 system → character → state → memory → history → user

### 修改
- 每轮用户消息在构建 Prompt 前按确定性关键词规则更新状态；状态服务异常会降级，不影响聊天主流程

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

### 修复（Bug 自检）
- **会话列表启动不显示 / 新建后才延迟出现**：`conversationStore` 原先仅在 `ChatView.onMounted` 的异步链中调用 `fetchList()`，且失败时静默清空列表、无重试；同时当 `localStorage` 无保存的当前会话 ID 时不会自动选中。现改为在 `main.ts` 应用启动时调用 `conversationStore.init()` 自动加载，`fetchList()` 增加有界重试与错误日志，并新增 `reconcileSelection()` 统一调和当前会话（无保存/失效 → 选 `updated_at` 最新一条；无会话 → 置空）。

---

## v0.6.1 — Conversation Initialization Stability

**日期：** 2026-08-12

### 修复

- 修复 Electron 首次启动无法显示历史会话的问题
- ConversationStore 新增自动初始化流程
- 修复 fetchList 首次失败导致会话列表被清空的问题
- 新增有限重试机制，提高后端启动时的容错能力
- 修复 currentConversationId 无法自动恢复的问题
- 修复新建会话后历史会话延迟出现的问题

### 优化

- Conversation 初始化从 ChatView 生命周期迁移至应用启动阶段
- 增加会话选择调和逻辑：
  - 优先恢复 localStorage 保存会话
  - 会话不存在时自动选择最新会话
  - 无会话保持空状态

---

## v0.6.2 — Startup Bootstrap

**日期：** 2026-08-13

### 新增
- 初始化引导页（InitializationView）：启动后先执行初始化任务，全部成功后再进入聊天主界面
- 初始化状态管理（bootstrap.store）：后端健康检查、会话/角色/Provider 数据加载的任务编排与进度展示
- 角色数据缓存 store（character.store），ChatView 改为复用缓存，避免重复请求
- 健康检查 API 封装（health.api，`GET /api/health`）
- 路由初始化守卫：未完成初始化前强制进入 `/init`，成功后自动进入 `/`

### 修复
- 修复前端比后端先启动导致 `GET /api/conversations` 失败、进入主界面后历史会话为空的问题（由重试兜底改为显式引导页门控）

### 修改
- `conversation.store.ts` — `fetchList()/init()` 返回布尔结果以支持引导页失败检测，失败时重置 `initPromise` 允许重试
- `provider.store.ts` — `fetchProviders()/refreshActive()` 返回布尔结果
- `ChatView.vue` — 角色数据改读 character.store，移除启动时重复请求
- `main.ts` — 移除启动阶段的 `conversationStore.init()` 调用
- `router/index.ts` — 新增 `/init` 路由与全局守卫

---

## v0.6.3 — Message Persistence & Ordering Stability

**日期：** 2026-08-15

### 修复
- **进入主界面当前会话历史不自动加载**：`ChatView.onMounted` 恢复加载当前选中会话的历史消息（`bootstrapStore` 只初始化会话列表与选择，未加载消息）。
- **切换会话 A→B→A 后 A 记录消失**：聊天请求打通 `conversationId` 链路，消息正确持久化到用户选中的会话（不再落到后端自动创建的临时会话）。
- **assistant 回复偶发排在 user 提问之前**：`saveMessages` 让 assistant 的 `created_at` 比 user 晚 1ms，避免同毫秒时间戳导致 `ORDER BY created_at ASC` 排序不稳定。

### 修改
- `src/views/ChatView.vue` — `onMounted` 恢复当前会话历史加载
- `src/services/chat.api.ts` — 请求体携带 `conversationId`
- `src/stores/chat.store.ts` — 发送时传递 `currentConversationId`
- `server/src/modules/chat/chat.controller.ts` — 接收并透传 `conversationId`
- `server/src/modules/conversation/conversation.service.ts` — `saveCurrentMessages` 支持指定会话 ID；`saveMessages` 保证消息时间戳严格有序

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

---

## [0.16.0] - 2026-08-17

### Added
- 聊天历史最近 50 条初始加载、向上分页加载与滚动锚点保持。
- 消息复制、编辑、重新生成、删除确认，以及 Markdown / JSON 会话导出。
- 消息 `turn_id`、自动记忆 `memory_sources` 来源表和关系 `relationship_interactions` 互动账本。
- 角色可维护 `openingMessage`，空会话欢迎区展示但不持久化为消息。

### Changed
- 编辑、重新生成和删除会截断会话尾部、重置摘要并异步重建当前会话自动记忆、事件/通知和角色关系派生产物。
- 自动记忆改为在消息真实持久化后提取，记录用户与助手消息来源；旧记忆标记为 `legacy` 并保留。

### Fixed
- 向量删除失败时保留 MySQL 自动记忆并标记 `deletion_pending`，每日维护任务会优先重试删除，避免误重建孤立向量。

## [0.15.0] - 2026-08-17

### Added
- 全局默认与角色覆盖的主动通知偏好、静默时段、每日上限和冷却时间。
- 通知来源解释、事件稍后提醒/取消、关切提醒忽略及 Electron Windows 系统通知安全 IPC。

### Changed
- 主动提醒改为启动补扫加每 15 分钟扫描；系统通知仅在应用运行期间投递并记录投递时间防重。


## Unreleased — 发布前运行时优化

- 桌面版默认使用 SQLite，Electron 安装包自动启动内置 NestJS 后端，普通用户不再依赖 Node.js、MySQL 或 Docker。
- 增加 TypeORM 初始 migration、生产 API 基址和本地数据目录隔离。
- Chroma 改为显式可选，未启用时不再请求本机 8000 端口。
- 修复同一聊天回复重复触发 TTS、停止播放生命周期竞态和 GPT-SoVITS 配置路径问题。
- 移除未引用的 Pixi/Nest WebSocket 依赖。
