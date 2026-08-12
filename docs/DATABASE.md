# 数据库设计文档

---

## 一、数据库选型

| 数据库 | 用途 | 状态 |
|--------|------|------|
| MySQL | 关系型数据存储（用户/角色/对话/记忆/Provider） | ✅ 已启用 |
| ChromaDB | 向量数据库（长期记忆语义检索） | ✅ 已启用 |
| Redis | 短期缓存（会话上下文/消息队列） | 📋 规划中 |

---

## 二、数据库设计原则

- **核心数据 MySQL** — 结构化数据（对话、消息、记忆、Provider、角色）
- **向量数据 ChromaDB** — 文本 Embedding 向量存储与语义搜索
- **文件资源独立存储** — Prompt 模板、Live2D 模型等
- **双写策略** — MemoryEntry 同时写入 MySQL（结构化）和 Chroma（向量），MySQL 为回退数据源

---

## 三、已启用数据表

### 3.1 conversations 对话会话表

**表名：** `conversations`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | NOT NULL | 所属用户 |
| `character_id` | VARCHAR(36) | NULL | 关联角色 |
| `title` | VARCHAR(255) | NULL | 对话标题 |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

---

### 3.2 messages 消息表

**表名：** `messages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `conversation_id` | VARCHAR(36) | FK → conversations.id | 所属对话 |
| `role` | VARCHAR(20) | NOT NULL | 消息角色（user/assistant/system） |
| `content` | TEXT | NOT NULL | 消息内容 |
| `token_count` | INT | NULL | Token 消耗 |
| `created_at` | TIMESTAMP | NOT NULL | 发送时间 |

---

### 3.3 memory_entries 长期记忆表

**表名：** `memory_entries`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | NOT NULL | 所属用户 |
| `vector_id` | VARCHAR(255) | NULL | Chroma 中的向量 ID |
| `type` | VARCHAR(50) | NOT NULL | 记忆类型（fact/preference/habit/interest） |
| `content` | TEXT | NOT NULL | 记忆内容 |
| `importance` | FLOAT | NOT NULL, DEFAULT 0.5 | 重要程度（0-1） |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

**索引：**
- `idx_memory_user_id` ON `user_id`
- `idx_memory_importance` ON `importance DESC`
- `idx_memory_created` ON `created_at DESC`

---

### 3.4 model_providers API 配置表

**表名：** `model_providers`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `user_id` | VARCHAR(36) | NOT NULL | 所属用户 |
| `name` | VARCHAR(100) | NOT NULL | 配置名称（如"我的 DeepSeek"） |
| `provider` | VARCHAR(50) | NOT NULL | 服务商标识 |
| `provider_type` | VARCHAR(50) | NOT NULL | 类型（openai/deepseek/gemini/claude/openrouter） |
| `base_url` | VARCHAR(500) | NOT NULL | API 地址 |
| `api_key` | VARCHAR(500) | NOT NULL | API 密钥 |
| `model` | VARCHAR(100) | NOT NULL | 模型名称 |
| `enabled` | BOOLEAN | DEFAULT TRUE | 是否启用 |
| `is_default` | BOOLEAN | DEFAULT FALSE | 是否默认 Provider |
| `temperature` | FLOAT | DEFAULT 0.7 | 温度参数 |
| `max_tokens` | INT | DEFAULT 4096 | 最大 Token 数 |
| `top_p` | FLOAT | DEFAULT 1.0 | Top-P 采样 |
| `stream` | BOOLEAN | DEFAULT TRUE | 是否流式输出 |
| `timeout` | INT | DEFAULT 30000 | 请求超时（ms） |
| `custom_headers` | TEXT | NULL | 自定义请求头（JSON） |
| `custom_body` | TEXT | NULL | 自定义请求体（JSON） |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

**索引：**
- `idx_provider_user_id` ON `user_id`
- `idx_provider_enabled` ON (`user_id`, `enabled`)
- `idx_provider_default` ON (`user_id`, `is_default`)

---

### 3.5 provider_models 模型列表表

**表名：** `provider_models`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT | PK, AUTO_INCREMENT | 主键 |
| `provider_id` | INT | FK → model_providers.id | 关联 Provider |
| `model_name` | VARCHAR(100) | NOT NULL | 模型名称 |
| `enabled` | BOOLEAN | DEFAULT TRUE | 是否启用 |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |

---

### 3.6 characters 角色表

**表名：** `characters`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `name` | VARCHAR(50) | NOT NULL | 角色名称 |
| `age` | INT | NULL | 年龄 |
| `gender` | VARCHAR(10) | NULL | 性别 |
| `background` | TEXT | NULL | 角色背景故事 |
| `personality` | TEXT | NULL | 性格描述 |
| `speaking_style` | TEXT | NULL | 语言风格 |
| `prompt_template` | TEXT | NULL | 自定义 Prompt 模板 |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

---

## 四、ER 关系图（当前）

```
┌──────────────────┐       ┌──────────────────┐
│  conversations   │       │   characters      │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)           │
│ user_id          │       │ name              │
│ character_id ────┼───────│ personality       │
│ title            │       │ background        │
│ created_at       │       │ speaking_style    │
│ updated_at       │       └──────────────────┘
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
```

---

## 五、ChromaDB 向量存储

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
    "type": "fact",
    "memoryId": "mysql-uuid"
  },
  "document": "用户的记忆内容文本"
}
```

**检索流程：**
```
用户消息 → Embedding API 向量化 → Chroma query (Top-K) → 返回相似记忆 → 注入 LLM Context
```

**安全降级：**
- `EMBEDDING_API_KEY` 未配置 → EmbeddingService 返回 null → VectorMemoryService 跳过 → 不影响聊天
- `CHROMA_URL` 不可达 → 记忆回退 MySQL 查询

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
