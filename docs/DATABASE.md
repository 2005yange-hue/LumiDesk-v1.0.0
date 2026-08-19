# 数据库设计文档

---

## 一、数据库选型

| 数据库 | 用途 | 状态 |
|--------|------|------|
| SQLite | 桌面版关系型数据存储（对话/消息/记忆/Provider） | ✅ 默认 |
| MySQL | 开发/部署环境关系型数据存储 | ✅ 可选 |
| ChromaDB | 向量数据库（长期记忆语义检索） | 📋 可选 |
| Redis | 短期缓存（会话上下文/消息队列） | 📋 规划中 |
| JSON 文件 | 角色数据持久化（`server/data/characters.json`） | ✅ 已启用 |

---

## 二、数据库设计原则

- **核心数据 SQLite/MySQL** — 结构化数据（对话、消息、记忆、Provider、角色）
- **向量数据 ChromaDB** — 文本 Embedding 向量存储与语义搜索
- **文件资源独立存储** — Prompt 模板、Live2D 模型等
- **双写策略** — MemoryEntry 同时写入 MySQL（结构化）和 Chroma（向量），MySQL 为回退数据源

---

## 三、已启用数据表

> 说明：当前 MySQL 共 10 张业务表（conversations / messages / memory_entries / memory_events / notifications / model_providers / provider_models / character_state / relationship_history / relationship_milestones）。
> 角色（characters）不存 MySQL，而是持久化到 JSON 文件 `server/data/characters.json`，由 CharacterService 管理。

### 3.1 conversations 对话会话表

**表名：** `conversations`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | NOT NULL, DEFAULT 'default' | 所属用户 |
| `character_id` | VARCHAR(64) | NULL | 关联角色 |
| `title` | VARCHAR(200) | NULL | 对话标题 |
| `message_count` | INT | NOT NULL, DEFAULT 0 | 消息总数（缓存字段，increment 维护；用于 Sidebar 显示消息数量 + 后续 Summary 触发预留） |
| `summary` | TEXT | NULL | 已压缩的早期对话摘要；原始 `messages` 记录不删除，供历史浏览使用 |
| `summary_message_count` | INT | NOT NULL, DEFAULT 0 | 已被 `summary` 覆盖的消息数，用于定位未摘要原文 |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

> **摘要策略：** 未摘要消息超过 50 条时，系统将较早消息合并进 `summary`，并保留最近 20 条原文；之后最多向模型提供 50 条未摘要原文。数据库不会删除原始历史消息。

---

### 3.2 messages 消息表

**表名：** `messages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `conversation_id` | VARCHAR(36) | FK → conversations.id | 所属对话 |
| `role` | VARCHAR(16) | NOT NULL | 消息角色（user/assistant） |
| `content` | TEXT | NOT NULL | 消息内容 |
| `token_count` | INT | NULL | Token 消耗 |
| `created_at` | DATETIME(6) | NOT NULL | 发送时间 |

> **顺序保证：** 查询按 `created_at ASC` 排序。保存时让 assistant 的 `created_at` 比 user 晚 1ms，
> 避免同一毫秒内两次插入时间戳相同，导致 `ORDER BY created_at ASC` 排序不稳定（assistant 偶发排在 user 前）。

---

### 3.3 memory_entries 长期记忆表

**表名：** `memory_entries`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `user_id` | VARCHAR(36) | NOT NULL, DEFAULT 'default' | 所属用户 |
| `character_id` | VARCHAR(64) | NULL, INDEX | 所属角色；逻辑关联 JSON 角色 ID，旧记录为空以兼容历史数据 |
| `vector_id` | VARCHAR(64) | NULL | Chroma 中的向量 ID |
| `vector_sync_status` | VARCHAR(16) | NOT NULL, DEFAULT 'pending' | MySQL 记录与 Chroma 的同步状态（pending/synced/failed） |
| `vector_sync_error` | TEXT | NULL | 最近一次向量同步失败原因 |
| `status` | VARCHAR(16) | NOT NULL, DEFAULT 'active', INDEX | 记忆生命周期（active/superseded/archived） |
| `replacement_memory_id` | INT | NULL | 替代该记忆的新记忆 ID，仅 superseded 记录使用 |
| `type` | VARCHAR(32) | NOT NULL | 记忆类型（preference/personality/event/relationship/fact） |
| `content` | TEXT | NOT NULL | 记忆内容 |
| `importance` | FLOAT | NOT NULL, DEFAULT 0.5 | 重要程度（0-1） |
| `confidence` | FLOAT | NOT NULL, DEFAULT 0.5 | 提取内容的可靠度（0-1） |
| `usage_count` | INT | NOT NULL, DEFAULT 0 | 被注入 Prompt 上下文的累计次数 |
| `memory_score` | FLOAT | NOT NULL, DEFAULT 0.5 | importance、confidence、使用频率与关系权重的综合分数 |
| `last_used_at` | DATETIME | NULL | 最近一次进入 Prompt 上下文的时间 |
| `last_decay_at` | DATETIME | NULL | 最近一次衰减时间，避免每日维护重复折损 |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

**索引：**
- `idx_memory_user_id` ON `user_id`
- `idx_memory_character_id` ON `character_id`
- `idx_memory_importance` ON `importance DESC`
- `idx_memory_created` ON `created_at DESC`
- `idx_memory_status` ON `status`

**向量同步规则：** 新记忆先写入 MySQL 并标记 `pending`；Chroma 写入成功后更新为 `synced`，失败则更新为 `failed` 并保留错误信息。管理端删除时先删除 Chroma，成功后才删除 MySQL。

**智能治理规则：** 新记忆会优先与同角色 active 记忆做向量/文本去重，语义相似度达到 0.85 时合并。出现“更喜欢、不再、改为”等替代语义时，旧记忆标记为 `superseded` 并关联替代记录。每日维护任务执行 30/90 天衰减、低质量归档、重复扫描和失败向量重试。

---

### 3.4 memory_events 事件记忆表

**表名：** `memory_events`

从 `memory_entries.type=event` 的长期记忆中解析得到；每条记忆最多对应一个可提醒事件。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `memory_id` | INT | UNIQUE, NOT NULL | 来源记忆 ID；逻辑关联 `memory_entries.id` |
| `event_time` | DATETIME | NOT NULL, INDEX | 事件发生时间 |
| `remind_time` | DATETIME | NOT NULL, INDEX | 最早可发送提醒的时间 |
| `status` | VARCHAR(16) | NOT NULL, DEFAULT `pending`, INDEX | `pending` / `sent` / `cancelled` / `expired` |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

**解析与调度规则：** 支持“今天、明天、后天、下周一、YYYY 年 M 月 D 日、M 月 D 日”等时间表达。默认在事件前一天 09:00 提醒；若生成时已过该时刻，则立即进入待触发队列。编辑、替代或删除来源记忆时，关联事件同步重新解析或取消。

---

### 3.5 notifications 主动消息表

**表名：** `notifications`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `user_id` | VARCHAR(36) | NOT NULL, DEFAULT `default`, INDEX | 所属用户 |
| `character_id` | VARCHAR(64) | NOT NULL, INDEX | 发送主动消息的角色 ID |
| `type` | VARCHAR(32) | NOT NULL | `event_reminder` / `wellbeing_checkin` |
| `content` | TEXT | NOT NULL | 确定性模板生成的主动消息内容 |
| `memory_event_id` | INT | NULL, INDEX | 关联事件提醒；关切消息可为空 |
| `source_memory_id` | INT | NULL, INDEX | 关联来源记忆，用于来源去重 |
| `status` | VARCHAR(16) | NOT NULL, DEFAULT `unread`, INDEX | `unread` / `read` |
| `read_at` | DATETIME | NULL | 用户阅读时间 |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

**去重与冷却规则：** 同一来源记忆只创建一条同类型通知；同一角色任意主动消息之间至少间隔 12 小时。

---

### 3.6 model_providers API 配置表

**表名：** `model_providers`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `user_id` | VARCHAR(36) | NOT NULL, DEFAULT 'default' | 所属用户 |
| `name` | VARCHAR(64) | NOT NULL | 配置名称（如"我的 DeepSeek"） |
| `provider` | VARCHAR(32) | NOT NULL | 服务商标识 |
| `provider_type` | VARCHAR(32) | NOT NULL, DEFAULT 'openai-compatible' | 类型（openai/deepseek/gemini/claude/openrouter） |
| `base_url` | VARCHAR(512) | NOT NULL | API 地址 |
| `api_key` | VARCHAR(512) | NOT NULL | API 密钥 |
| `model` | VARCHAR(64) | NOT NULL | 模型名称 |
| `enabled` | BOOLEAN | DEFAULT TRUE | 是否启用 |
| `is_default` | BOOLEAN | DEFAULT FALSE | 是否默认 Provider |
| `temperature` | FLOAT | DEFAULT 0.7 | 温度参数 |
| `max_tokens` | INT | DEFAULT 4096 | 最大 Token 数 |
| `top_p` | FLOAT | DEFAULT 1.0 | Top-P 采样 |
| `stream` | BOOLEAN | DEFAULT TRUE | 是否流式输出 |
| `timeout` | INT | DEFAULT 30000 | 请求超时（ms） |
| `custom_headers` | TEXT | NULL | 自定义请求头（JSON） |
| `custom_body` | TEXT | NULL | 自定义请求体（JSON） |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

**索引：**
- `idx_provider_user_id` ON `user_id`
- `idx_provider_enabled` ON (`user_id`, `enabled`)
- `idx_provider_default` ON (`user_id`, `is_default`)

---

### 3.7 provider_models 模型列表表

**表名：** `provider_models`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `provider_id` | INT | FK → model_providers.id | 关联 Provider |
| `model_name` | VARCHAR(128) | NOT NULL | 模型名称 |
| `enabled` | BOOLEAN | DEFAULT TRUE | 是否启用 |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |

---

### 3.8 characters 角色（JSON 文件存储，非 MySQL 表）

角色数据当前不存 MySQL，而是持久化到 `server/data/characters.json`，由 CharacterService 管理。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 角色 ID（`char-{timestamp}-{random}`） |
| `name` | string | 角色名称 |
| `age` | number | 年龄 |
| `gender` | string | 性别 |
| `background` | string | 角色背景故事 |
| `personality` | string | 性格描述 |
| `speakingStyle` | string | 语言风格 |
| `likes` | string[] | 喜好 |
| `dislikes` | string[] | 厌恶 |
| `createdAt` | string (ISO) | 创建时间 |
| `updatedAt` | string (ISO) | 更新时间 |

### 3.9 character_state 角色动态状态表

**表名：** `character_state`

角色基础资料继续存储在 JSON 文件；该表只保存会随用户互动改变的运行态。`character_id` 逻辑关联 JSON 角色 ID，不建立 MySQL 外键。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `character_id` | VARCHAR(64) | UNIQUE, NOT NULL | JSON 角色 ID |
| `mood` | VARCHAR(16) | NOT NULL, DEFAULT 'calm' | `happy` / `calm` / `concerned` / `tired` |
| `energy` | INT | NOT NULL, DEFAULT 100 | 精力值，服务层限制为 20–100 |
| `affinity` | FLOAT | NOT NULL, DEFAULT 10 | 关系分，范围 0–100；支持 0.1 精度的关系事件评分，新角色从陌生开始 |
| `relationship_level` | VARCHAR(16) | NOT NULL, DEFAULT `stranger` | 关系等级，由 affinity 推导并同步 |
| `initiative_level` | INT | NOT NULL, DEFAULT 50 | 用户设置的主动互动意愿，范围 0–100 |
| `interaction_count` | INT | NOT NULL, DEFAULT 0 | 成功完成 AI 回复后的累计互动次数 |
| `shared_experience_count` | INT | NOT NULL, DEFAULT 0 | 兴趣、重要事件或个人经历的累计共同经历数 |
| `last_interaction_at` | DATETIME | NULL | 最近一次用户互动 |
| `created_at` | DATETIME(6) | NOT NULL | 创建时间 |
| `updated_at` | DATETIME(6) | NOT NULL | 更新时间 |

---

### 3.10 relationship_history 关系等级历史表

**表名：** `relationship_history`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `character_id` | VARCHAR(64) | NOT NULL, INDEX | JSON 角色 ID |
| `old_level` | VARCHAR(16) | NOT NULL | 变化前关系等级 |
| `new_level` | VARCHAR(16) | NOT NULL | 变化后关系等级 |
| `reason` | TEXT | NOT NULL | 评分信号与等级变化原因 |
| `created_at` | DATETIME(6) | NOT NULL | 发生时间 |

仅在关系等级跨越陌生、熟悉、朋友、亲密、特殊关系边界时写入记录。

---

### 3.11 relationship_milestones 关系里程碑表

**表名：** `relationship_milestones`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `character_id` | VARCHAR(64) | NOT NULL, INDEX | JSON 角色 ID |
| `code` | VARCHAR(48) | NOT NULL, UNIQUE WITH character_id | 里程碑唯一标识 |
| `title` | VARCHAR(80) | NOT NULL | 展示标题 |
| `description` | VARCHAR(255) | NOT NULL | 展示说明 |
| `achieved_at` | DATETIME(6) | NOT NULL | 解锁时间 |

当前内置初次交谈、相识一周/一月、三十次交流、第一次分享兴趣和重要时刻陪伴等里程碑。

> `affinity` 从 INT 升级为 FLOAT。开发环境的 `synchronize` 只适用于本地迭代；部署已有数据前必须执行备份与显式迁移，以保留既有关系分。

---

## 四、ER 关系图（当前）

```
┌──────────────────┐
│  conversations   │
├──────────────────┤
│ id (PK)          │
│ user_id          │
│ character_id     │
│ title            │
│ message_count    │
│ created_at       │
│ updated_at       │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐       ┌──────────────────┐
│   messages        │       │ memory_entries    │
├──────────────────┤       ├──────────────────┤
│ id (PK)           │       │ id (PK)           │
│ conversation_id ──┤       │ user_id           │
│ role              │       │ vector_id         │
│ content           │       │ type              │
│ token_count       │       │ content           │
│ created_at        │       │ importance        │
└──────────────────┘       └──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│ model_providers  │       │ provider_models   │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │◄──────│ provider_id (FK)  │
│ user_id          │       │ model_name        │
│ name             │       │ enabled           │
│ provider         │       └──────────────────┘
│ provider_type    │
│ base_url         │
│ api_key          │
│ model            │
│ enabled          │
│ is_default       │
│ temperature      │
│ max_tokens       │
│ top_p            │
│ stream           │
│ timeout          │
│ custom_headers   │
│ custom_body      │
└──────────────────┘

┌──────────────────┐
│ character_state  │
├──────────────────┤
│ id (PK)          │
│ character_id (UQ)│ ── 逻辑关联 server/data/characters.json
│ mood             │
│ energy           │
│ affinity         │
│ relationship_level│
│ initiative_level │
│ last_interaction │
└──────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  memory_events   │       │  notifications   │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ memory_id (UQ) ──┼───┐   │ character_id     │
│ event_time       │   └──►│ source_memory_id │
│ remind_time      │       │ memory_event_id  │
│ status           │       │ status           │
└──────────────────┘       └──────────────────┘
```

---

## 五、桌面版 SQLite 与 MySQL

桌面安装包默认使用 SQLite，数据库文件位于用户数据目录的 `lumidesk.sqlite`，首次启动自动执行 TypeORM migration。普通用户不需要安装 MySQL 或 Docker。

开发者可以设置 `DATABASE_TYPE=mysql` 使用现有 MySQL。生产环境不要开启 `DATABASE_SYNCHRONIZE`，执行 migration 前应先备份数据库。

## 六、ChromaDB 向量存储

**数据库：** ChromaDB v2 API

**Tenant / Database：** `default_tenant` / `default_database`

**Collection：** `memory_entries`

**文档结构：**
```json
{
  "id": "{uuid}",
  "embedding": [0.123, -0.456, ...],
  "metadata": {
    "userId": "default",
    "characterId": "char-xxx",
    "type": "preference",
    "importance": 0.7,
    "confidence": 0.95,
    "memoryScore": 0.72,
    "status": "active"
  },
  "document": "用户的记忆内容文本"
}
```

**检索流程：**
```
用户消息 → Embedding API 向量化 → 按 userId + characterId 查询 Chroma → 返回相似记忆 → 更新 last_used_at → 注入 LLM Context
```

> 角色范围内没有向量命中或向量服务不可用时，回退 MySQL 查询该角色和 `character_id IS NULL` 的历史兼容记忆。

**安全降级：**
- `EMBEDDING_API_KEY` 未配置 → EmbeddingService 返回 null → VectorMemoryService 跳过 → 不影响聊天
- `VECTOR_DB_PROVIDER=disabled` 或 `CHROMA_URL` 不可达 → 跳过 Chroma，记忆回退结构化数据库查询

---

## 六、未来表规划

### 6.1 emotion_logs 情绪日志表（规划）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(36) PK | UUID |
| `user_id` | VARCHAR(36) FK | 所属用户 |
| `character_id` | VARCHAR(36) FK | 关联角色 |
| `happy` | FLOAT | 开心度（-1 到 1） |
| `trust` | FLOAT | 信任度（0 到 1） |
| `affection` | FLOAT | 亲密度（0 到 1） |
| `energy` | FLOAT | 精力值（0 到 1） |
| `trigger_event` | VARCHAR(100) | 触发事件 |
| `created_at` | TIMESTAMP | 记录时间 |

### 6.2 agent_tasks Agent 任务表（规划）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(36) PK | UUID |
| `user_id` | VARCHAR(36) FK | 所属用户 |
| `type` | VARCHAR(50) | 任务类型（reminder/alert/suggestion） |
| `status` | ENUM('pending','executed','dismissed') | 状态 |
| `content` | TEXT | 任务内容 |
| `trigger_at` | TIMESTAMP | 触发时间 |
| `created_at` | TIMESTAMP | 创建时间 |

### 6.3 user_preferences 用户偏好表（规划）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(36) PK | UUID |
| `user_id` | VARCHAR(36) FK | 所属用户 |
| `key` | VARCHAR(100) | 配置键 |
| `value` | TEXT | 配置值 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 6.4 users 用户表（规划）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | VARCHAR(36) PK | UUID |
| `username` | VARCHAR(50) UNIQUE | 用户名 |
| `avatar` | VARCHAR(255) | 头像 URL |
| `created_at` | TIMESTAMP | 创建时间 |

---

## v0.15 / v0.16 新增数据结构

### `notification_preferences`

全局默认记录使用 `character_id = NULL`；角色记录为覆盖值。字段包含 `enabled`、`system_enabled`、`event_reminder_enabled`、`wellbeing_checkin_enabled`、`quiet_start`、`quiet_end`、`daily_limit`、`cooldown_minutes`。

### `notifications` 扩展

`status` 现支持 `unread`、`read`、`dismissed`；`system_notified_at` 记录 Electron 成功投递 Windows 通知的时间，用于防重。

### `messages` 扩展

`turn_id` 用于稳定标识同一用户消息和助手回复所属的轮次，编辑、重新生成和删除按照轮次截断。

### `memory_entries` 扩展

- `origin`：`legacy` 或 `automatic`。
- `source_conversation_id`、`source_message_id`、`source_assistant_message_id`：最近一次自动来源的兼容字段。
- `deletion_pending`：会话重建删除 Chroma 向量失败时设为 `true`；记录保留在 MySQL，维护任务会优先重试删除，不会重新索引。

### `memory_sources`

自动记忆来源关联表。字段：`memory_id`、`conversation_id`、`user_message_id`、`assistant_message_id`、`created_at`；`memory_id + conversation_id + user_message_id` 唯一。它支持去重合并后的单条记忆关联多个会话来源。

### `relationship_interactions`

关系互动账本。字段：`character_id`、`conversation_id`、`user_message_id`、`assistant_message_id`、`delta`、`signals`、`reasons`、`occurred_at`。`character_id + conversation_id + user_message_id` 唯一，供会话改写后重放关系状态、关系历史和里程碑。


## v0.17 新增数据结构

### `emotion_records`

按角色隔离的用户情绪记录表。字段：`user_id`、`character_id`、`conversation_id`、`user_message_id`、`emotion`、`intensity`、`confidence`、`source`、`reason`、`occurred_at`、时间戳。

- `emotion` 仅允许 `happy`、`calm`、`anxious`、`sad`、`angry`、`tired`；`intensity` 范围为 1–5。
- `source` 为 `rule`、`llm` 或 `manual`；手动修正记录不会被自动识别覆盖。
- `user_message_id` 唯一，确保每条用户消息最多保留一条当前判断；`user_id + character_id + occurred_at` 为趋势查询索引。
- 每日维护任务清理超过 30 天的记录；高风险表达不写入该表。

### `emotion_preferences`

默认用户 `default` 的情绪理解偏好表。`user_id` 唯一，`enabled` 默认 `true`；关闭仅停止后续识别与 Prompt 注入，不隐式删除历史。
