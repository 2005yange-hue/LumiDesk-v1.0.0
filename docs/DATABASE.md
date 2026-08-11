# 数据库设计文档

> 当前状态：数据库尚未启用，以下为规划中的表结构设计。

---

## 一、数据库选型

| 数据库 | 用途 | 状态 |
|--------|------|------|
| MySQL | 关系型数据存储（用户/角色/消息/情绪） | 📋 规划中 |
| Chroma / Milvus | 向量数据库（长期记忆语义检索） | 📋 规划中 |
| Redis | 短期缓存（会话上下文/消息队列） | 📋 规划中 |

---

## 二、数据表设计

### 2.1 User 用户表

**表名：** `users`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `username` | VARCHAR(50) | NOT NULL, UNIQUE | 用户名 |
| `avatar` | VARCHAR(255) | NULL | 头像 URL |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 更新时间 |

**索引：**
- `idx_users_username` ON `username`

---

### 2.2 Character 角色表

**表名：** `characters`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | FK → users.id | 所属用户 |
| `name` | VARCHAR(50) | NOT NULL | 角色名称 |
| `age` | INT | NULL | 年龄 |
| `gender` | VARCHAR(10) | NULL | 性别 |
| `background` | TEXT | NULL | 角色背景故事 |
| `personality` | TEXT | NULL | 性格描述 |
| `speaking_style` | TEXT | NULL | 语言风格 |
| `likes` | JSON | NULL | 喜好列表 |
| `dislikes` | JSON | NULL | 厌恶列表 |
| `relationship_level` | INT | DEFAULT 0 | 亲密度等级 |
| `created_at` | TIMESTAMP | NOT NULL | 创建时间 |
| `updated_at` | TIMESTAMP | NOT NULL | 更新时间 |

**索引：**
- `idx_characters_user_id` ON `user_id`

---

### 2.3 Message 聊天记录表

**表名：** `messages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | FK → users.id | 所属用户 |
| `character_id` | VARCHAR(36) | FK → characters.id | 关联角色 |
| `role` | ENUM('user','assistant') | NOT NULL | 消息角色 |
| `content` | TEXT | NOT NULL | 消息内容 |
| `model` | VARCHAR(50) | NULL | 使用的模型名称 |
| `prompt_tokens` | INT | NULL | Prompt Token 消耗 |
| `completion_tokens` | INT | NULL | 回复 Token 消耗 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 发送时间 |

**索引：**
- `idx_messages_user_id` ON `user_id`
- `idx_messages_created_at` ON `created_at`
- `idx_messages_user_created` ON (`user_id`, `created_at`)

---

### 2.4 Memory 长期记忆表

**表名：** `memories`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | FK → users.id | 所属用户 |
| `type` | ENUM('interest','habit','goal','event','preference') | NOT NULL | 记忆类型 |
| `content` | TEXT | NOT NULL | 记忆内容 |
| `importance` | ENUM('high','medium','low') | NOT NULL, DEFAULT 'medium' | 重要程度 |
| `source_message_id` | VARCHAR(36) | FK → messages.id | 来源消息 |
| `access_count` | INT | DEFAULT 0 | 被检索次数 |
| `last_accessed_at` | TIMESTAMP | NULL | 最后检索时间 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |

**索引：**
- `idx_memories_user_id` ON `user_id`
- `idx_memories_type` ON `type`
- `idx_memories_importance` ON `importance`

---

### 2.5 EmotionLog 情绪日志表

**表名：** `emotion_logs`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | VARCHAR(36) | PK | UUID 主键 |
| `user_id` | VARCHAR(36) | FK → users.id | 所属用户 |
| `character_id` | VARCHAR(36) | FK → characters.id | 关联角色 |
| `happy` | FLOAT | NOT NULL, DEFAULT 0.5 | 开心度 (-1 到 1) |
| `trust` | FLOAT | NOT NULL, DEFAULT 0.5 | 信任度 (0 到 1) |
| `affection` | FLOAT | NOT NULL, DEFAULT 0.5 | 亲密度 (0 到 1) |
| `energy` | FLOAT | NOT NULL, DEFAULT 1.0 | 精力值 (0 到 1) |
| `trigger_event` | VARCHAR(100) | NULL | 触发事件描述 |
| `created_at` | TIMESTAMP | NOT NULL, DEFAULT NOW() | 记录时间 |

**索引：**
- `idx_emotion_user_id` ON `user_id`
- `idx_emotion_created_at` ON `created_at`

---

## 三、ER 关系图

```
┌──────────┐        ┌──────────────┐        ┌──────────────┐
│  users   │        │  characters  │        │  messages    │
├──────────┤        ├──────────────┤        ├──────────────┤
│ id (PK)  │◄───────│ user_id (FK) │        │ id (PK)      │
│ username │        │ id (PK)      │◄───────│ character_id  │
│ avatar   │        │ name         │        │ user_id (FK) │
│ created  │        │ personality  │        │ role         │
│ updated  │        │ background   │        │ content      │
└──────────┘        └──────────────┘        │ model        │
        │                                    │ tokens       │
        │                                    │ created_at   │
        │                                    └──────┬───────┘
        │                                           │
        │              ┌──────────────┐             │
        │              │  memories    │             │
        │              ├──────────────┤             │
        │              │ id (PK)      │             │
        ├──────────────│ user_id (FK) │             │
        │              │ type         │◄────────────│ source_message_id (FK)
        │              │ content      │             │
        │              │ importance   │             │
        │              │ access_count │             │
        │              └──────────────┘             │
        │                                           │
        │              ┌──────────────┐             │
        │              │ emotion_logs │             │
        │              ├──────────────┤             │
        ├──────────────│ user_id (FK) │             │
        │              │ id (PK)      │             │
        └──────────────│ character_id │             │
                       │ happy        │             │
                       │ trust        │             │
                       │ affection    │             │
                       │ energy       │             │
                       │ trigger_event│             │
                       │ created_at   │             │
                       └──────────────┘             │
                                                    │
        ┌───────────────────────────────────────────┘
```

---

## 四、向量数据库设计（规划）

**数据库：** Chroma（轻量级嵌入式向量库）

**Collection：** `user_memories`

**文档结构：**
```json
{
  "id": "memory-{uuid}",
  "embedding": [0.123, -0.456, ...],  // 1536 维向量
  "metadata": {
    "user_id": "uuid",
    "type": "interest",
    "content": "Unity 游戏开发",
    "importance": "high",
    "created_at": "2026-08-01T10:00:00Z"
  }
}
```

**检索流程：**
```
用户消息 → Embedding API → 向量查询 → Top-K 相似记忆 → 注入 LLM Context
```

---

## 五、当前阶段数据管理方式

由于数据库尚未启用，当前数据管理方式：

| 数据 | 存储方式 | 说明 |
|------|----------|------|
| 聊天消息 | 前端内存（Pinia Store） | 刷新即丢失 |
| 模型配置 | localStorage | 持久化于浏览器 |
| Prompt 模板 | 文件系统 (`server/prompts/`) | 启动时加载 |
