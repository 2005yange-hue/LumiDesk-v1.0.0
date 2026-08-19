# API 接口规范

> 基础 URL: `http://localhost:3000/api`

---

## API 分类

| 分类 | 路径前缀 | 状态 |
|------|----------|------|
| Chat API | `/chat` | ✅ 已实现 |
| Provider API | `/provider` | ✅ 已实现 |
| Character API | `/character` | ✅ 已实现 |
| Character State API | `/character-state` | ✅ 已实现 |
| Relationship API | `/relationship` | ✅ 已实现 |
| Conversation API | `/conversations` | ✅ 已实现 |
| Health API | `/health` | ✅ 已实现 |
| Memory API | `/memory` | ✅ 已实现 |
| Notification API | `/notifications` | ✅ 已实现 |
| Vision API | — | 📋 规划中 |
| Audio API | `/audio` | ✅ 已实现 |
| Agent API | — | 📋 规划中 |

---

## Audio API

语音 Provider 独立于聊天 Provider，API Key 只由服务端保存和使用。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/audio/providers` | 获取脱敏后的语音 Provider |
| POST | `/audio/providers` | 创建语音 Provider |
| PUT | `/audio/providers/:id` | 更新语音 Provider |
| DELETE | `/audio/providers/:id` | 删除语音 Provider |
| GET | `/audio/providers/active` | 获取当前语音 Provider |
| POST | `/audio/providers/:id/test` | 测试 TTS/STT Provider |
| POST | `/audio/tts` | 返回临时音频流，不保存音频 |
| POST | `/audio/stt` | 接收临时录音并返回转写文本 |

STT 单次录音限制为 30 秒、10MB；录音不写入消息、记忆、情绪、关系或通知数据。

---

## 一、Chat API

### POST /api/chat/send

**功能：** 发送聊天消息，通过 SSE 流式返回 AI 回复。

**请求体：**
```json
{
  "content": "最近学习压力很大。",
  "history": [
    { "role": "user", "content": "你好" },
    { "role": "assistant", "content": "你好！今天过得怎么样？" }
  ],
  "modelConfig": {
    "providerId": 1,
    "model": "deepseek-chat",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "characterId": "char-xxx",
  "conversationId": "uuid"
}
```

**请求参数说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | ✅ | 用户消息内容 |
| `history` | HistoryMessageDto[] | ❌ | 历史消息数组 |
| `modelConfig` | object | ❌ | 运行时模型配置（不传则回退 default Provider / .env） |
| `modelConfig.providerId` | number | ❌ | 指定 Provider ID（不传则使用 default Provider） |
| `modelConfig.model` | string | ❌ | 覆盖 Provider 的模型名称 |
| `modelConfig.temperature` | number | ❌ | 温度（0-2） |
| `modelConfig.maxTokens` | number | ❌ | 最大 Token 数（128-8192） |
| `characterId` | string | ❌ | 指定角色 ID（不传则使用默认角色艾莉） |
| `conversationId` | string | ❌ | 当前会话 ID，用于将本轮消息持久化到用户选中的会话 |

**SSE 响应格式：**

```
data: {"content":"学","fullContent":"学","done":false}
data: {"content":"习","fullContent":"学习","done":false}
...
data: {"content":"","fullContent":"完整回复内容","done":true,"id":"msg-uuid"}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | string | 当前增量 Token |
| `fullContent` | string | 完整累积内容 |
| `done` | boolean | 是否生成完毕 |
| `id` | string | 消息 ID（done 时返回） |
| `error` | string | 错误信息（仅出错时） |

**错误情况：**

| 场景 | error 字段 |
|------|-----------|
| 无可用 Provider | `"LLM_API_KEY not configured..."` |
| API Key 无效 | `"API Key 无效..."` |
| API 配额不足 | `"API 配额不足..."` |
| 网络连接失败 | `"无法连接到模型服务..."` |

**请求校验：**

- `content` 必须为非空字符串，长度不超过 5000 个字符。
- `history`、`modelConfig` 必须为合法对象结构；历史消息的 `role` 仅支持 `system`、`user`、`assistant`。
- `modelConfig.temperature` 范围为 0-2，`modelConfig.maxTokens` 范围为 128-8192，`providerId` 必须为正整数。
- `characterId` 与 `conversationId` 为可选字符串，长度不超过 128 个字符。
- 请求校验失败时返回 HTTP 400，不会建立 SSE 流，也不会调用模型服务。

---

## 二、Provider API

### GET /api/provider

**功能：** 获取当前用户的所有 Provider 配置。

**响应：**
```json
[
  {
    "id": 1,
    "name": "我的 DeepSeek",
    "provider": "deepseek",
    "provider_type": "openai-compatible",
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-1****b4c",
    "model": "deepseek-chat",
    "enabled": true,
    "is_default": true,
    "temperature": 0.7,
    "max_tokens": 4096,
    "top_p": 1.0,
    "stream": true,
    "timeout": 30000,
    "custom_headers": null,
    "custom_body": null
  }
]
```

> 注意：`api_key` 返回时已脱敏（`****`），前端无法获取完整 Key。

---

### GET /api/provider/active

**功能：** 获取当前启用的 Provider（`enabled=true`）。

---

### GET /api/provider/default

**功能：** 获取标记为默认的 Provider（`is_default=true`）。

---

### POST /api/provider

**功能：** 创建新的 Provider 配置。

**请求体：**
```json
{
  "name": "我的 DeepSeek",
  "provider": "deepseek",
  "provider_type": "openai-compatible",
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxx",
  "model": "deepseek-chat",
  "is_default": true,
  "temperature": 0.7,
  "max_tokens": 4096,
  "top_p": 1.0,
  "stream": true,
  "timeout": 30000
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | string | ✅ | — | 配置名称 |
| `provider` | string | ✅ | — | 服务商标识 |
| `provider_type` | string | ❌ | — | openai / deepseek / gemini / claude / openrouter |
| `base_url` | string | ✅ | — | API 地址 |
| `api_key` | string | ✅ | — | API 密钥 |
| `model` | string | ✅ | — | 模型名称 |
| `is_default` | boolean | ❌ | false | 是否默认 |
| `temperature` | number | ❌ | 0.7 | 0-2 |
| `max_tokens` | number | ❌ | 4096 | 1-131072 |
| `top_p` | number | ❌ | 1.0 | 0-1 |
| `stream` | boolean | ❌ | true | 是否流式 |
| `timeout` | number | ❌ | 30000 | 请求超时（ms） |
| `custom_headers` | string | ❌ | null | 自定义请求头（JSON） |
| `custom_body` | string | ❌ | null | 自定义请求体（JSON） |

---

### PUT /api/provider/:id

**功能：** 更新 Provider 配置。参数同 POST。

> 注意：如果 `api_key` 为脱敏值（含 `****`），后端会自动跳过更新。

---

### DELETE /api/provider/:id

**功能：** 删除 Provider 及其关联的模型记录。

---

### POST /api/provider/test

**功能：** 测试 API 连接（不保存）。

**请求体：**
```json
{
  "base_url": "https://api.deepseek.com/v1",
  "api_key": "sk-xxx",
  "model": "deepseek-chat"
}
```

**响应：**
```json
{
  "success": true,
  "latency": 843,
  "model": "deepseek-chat",
  "tokens": 15,
  "response": "你好！有什么可以帮你的？"
}
```

失败时 `success=false`，`message` 包含分类错误（401 认证失败 / 403 权限不足 / 404 模型不存在 / 429 频率限制 / 网络错误）。

---

### POST /api/provider/models

**功能：** 获取远程模型列表（不保存）。

**请求体：** 同 test 接口。

**响应：**
```json
[
  { "id": "deepseek-chat", "owned_by": "deepseek" },
  { "id": "deepseek-reasoner", "owned_by": "deepseek" }
]
```

---

### GET /api/provider/:id/models

**功能：** 获取指定 Provider 的远程模型列表。

---

### POST /api/provider/:id/models

**功能：** 添加模型到 Provider 的本地记录。

**请求体：**
```json
{ "model_name": "deepseek-chat" }
```

---

### DELETE /api/provider/model/:modelId

**功能：** 删除 Provider 的本地模型记录。

---

### GET /api/provider/:id/saved-models

**功能：** 获取 Provider 的已保存本地模型列表。

---

## 三、Character API

### GET /api/character

**功能：** 获取所有角色。

**响应：**
```json
[
  {
    "id": "char-1750000000000-abc123",
    "name": "艾莉",
    "age": 20,
    "gender": "female",
    "background": "陪伴用户学习和生活的AI伙伴",
    "personality": "温柔、理性、善解人意",
    "speakingStyle": "简洁、自然",
    "likes": ["阅读", "学习", "编程"],
    "dislikes": ["嘈杂环境"],
    "createdAt": "2026-08-12T10:00:00.000Z",
    "updatedAt": "2026-08-12T10:00:00.000Z"
  }
]
```

---

### GET /api/character/:id

**功能：** 获取指定角色详情。

---

### POST /api/character

**功能：** 创建新角色。

**请求体：**
```json
{
  "name": "自定义角色",
  "age": 25,
  "gender": "male",
  "background": "...",
  "personality": "...",
  "speakingStyle": "...",
  "likes": ["..."],
  "dislikes": ["..."]
}
```

---

### PUT /api/character/:id

**功能：** 更新角色。参数同 POST。

---

### DELETE /api/character/:id

**功能：** 删除角色。

---

## 四、Character State API

### GET /api/character-state/:characterId

**功能：** 获取角色当前的动态运行状态。首次读取时会为存在的角色自动创建默认状态。

**响应：**
```json
{
  "id": 1,
  "character_id": "char-xxx",
  "mood": "calm",
  "energy": 100,
  "affinity": 50,
  "relationship_level": "friend",
  "initiative_level": 50,
  "interaction_count": 24,
  "shared_experience_count": 3,
  "last_interaction_at": "2026-08-16T12:00:00.000Z",
  "created_at": "2026-08-16T12:00:00.000Z",
  "updated_at": "2026-08-16T12:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `mood` | string | `happy` / `calm` / `concerned` / `tired` |
| `energy` | number | 角色精力值，范围 20–100 |
| `affinity` | number | 与用户的亲密度，范围 0–100 |
| `relationship_level` | string | `stranger` / `familiar` / `friend` / `intimate` / `special`；按 affinity 区间分别对应陌生、熟悉、朋友、亲密、特殊关系 |
| `initiative_level` | number | 角色主动互动意愿，范围 0–100；实际触发值还会乘以关系等级系数 |
| `interaction_count` | number | 成功完成 AI 回复后的累计互动次数 |
| `shared_experience_count` | number | 分享兴趣、重要事件或个人经历的累计共同经历数 |
| `last_interaction_at` | string \| null | 最近一次用户互动时间 |

> 每轮聊天由后端根据确定性关键词规则更新心情、精力和亲密度，避免客户端伪造互动状态。关系等级区间为 `[0,20)` 陌生、`[20,40)` 熟悉、`[40,70)` 朋友、`[70,90)` 亲密、`[90,100]` 特殊关系。
>
> 关系等级会影响角色称呼与语气、主动关心程度，以及长期记忆注入数量和重要度排序。

### PATCH /api/character-state/:characterId/initiative

**功能：** 设置角色的主动互动意愿；该值是用户可配置偏好，不直接改变心情、精力或关系等级。

**请求体：**
```json
{
  "initiative_level": 60
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `initiative_level` | number | ✅ | 整数，范围 0–100 |

主动提醒的有效值为 `initiative_level × relationshipMultiplier`。陌生、熟悉、朋友、亲密/特殊关系的系数依次为 `0.3`、`0.5`、`0.7`、`1.0`；有效值低于 30 时不会创建主动消息。

---

## 五、Relationship API

### GET /api/relationship/:characterId

**功能：** 获取指定角色的关系成长档案，包括当前关系状态、关系等级变化历史和已解锁里程碑。首次读取会初始化没有状态的新角色为 `stranger`（affinity=10）。

**响应 `data`：**
```json
{
  "state": {
    "character_id": "character-id",
    "affinity": 42.3,
    "relationship_level": "friend",
    "interaction_count": 124,
    "shared_experience_count": 8
  },
  "days_known": 30,
  "history": [
    {
      "id": 2,
      "old_level": "familiar",
      "new_level": "friend",
      "reason": "分享个人经历；表达感谢，关系从熟悉变化为朋友",
      "created_at": "2026-08-16T10:00:00.000Z"
    }
  ],
  "milestones": [
    {
      "id": 4,
      "code": "first_interest_shared",
      "title": "第一次分享兴趣",
      "description": "用户分享了自己的兴趣与偏好。",
      "achieved_at": "2026-08-16T10:00:00.000Z"
    }
  ]
}
```

关系评分在每次成功 AI 回复后由本地 `RelationshipEngineService` 计算：普通交流 `+0.1`、感谢 `+1`、个人经历分享 `+2`、长期未互动 `-0.5`、明确冲突 `-3`。规则不调用 LLM；只有跨越关系等级阈值时才写入历史记录。

---

## 六、Conversation API

### GET /api/conversations

**功能：** 获取当前用户的会话列表（按更新时间倒序）。

**响应：**
```json
[
  {
    "id": "uuid",
    "title": "关于游戏开发的讨论",
    "message_count": 24,
    "created_at": "2026-08-12T10:00:00.000Z",
    "updated_at": "2026-08-12T12:00:00.000Z"
  }
]
```

---

### GET /api/conversations/:id

**功能：** 获取单个会话详情。

**响应：**
```json
{
  "id": "uuid",
  "user_id": "default",
  "character_id": null,
  "title": "关于游戏开发的讨论",
  "message_count": 24,
  "created_at": "2026-08-12T10:00:00.000Z",
  "updated_at": "2026-08-12T12:00:00.000Z"
}
```

---

### GET /api/conversations/:id/messages

**功能：** 分页获取会话的历史消息。

**查询参数：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `limit` | number | 50 | 每页条数（最大 200） |

**响应：**
```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "你好",
      "token_count": null,
      "created_at": "2026-08-12T10:00:00.000Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "你好！",
      "token_count": null,
      "created_at": "2026-08-12T10:00:05.000Z"
    }
  ],
  "total": 24
}
```

**返回结构说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `messages` | array | 当前页消息列表 |
| `total` | number | 该会话消息总数 |

**消息字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 消息 ID |
| `role` | string | 角色（user/assistant/system） |
| `content` | string | 消息内容 |
| `token_count` | number \| null | Token 消耗 |
| `created_at` | string | 发送时间 |

---

### POST /api/conversations

**功能：** 创建新会话。

**请求体：**
```json
{
  "title": "新对话（可选）"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | ❌ | 会话标题，最长 200 字符 |

---

### PATCH /api/conversations/:id

**功能：** 更新会话标题。

**请求体：**
```json
{
  "title": "关于游戏开发的讨论"
}
```

---

### DELETE /api/conversations/:id

**功能：** 删除会话及其所有关联消息（事务保证原子性）。

**响应：**
```json
{ "success": true }
```

---

## 七、Health API

### GET /api/health

**功能：** 健康检查。

**响应：**
```json
{
  "status": "ok",
  "timestamp": "2026-08-12T12:00:00.000Z",
  "version": "0.5.3"
}
```

---

## 八、Memory API

Memory API 面向默认用户的当前角色记忆管理。普通 REST 响应统一包装为 `{ success, data, message, timestamp }`。

### GET /api/memory/:characterId

**功能：** 查询指定角色的全部长期记忆，包含历史全局记忆。

**响应 `data`：**
```json
[
  {
    "id": 1,
    "user_id": "default",
    "character_id": "character-id",
    "vector_id": "1",
    "type": "preference",
    "content": "用户喜欢生椰拿铁",
    "importance": 0.8,
    "confidence": 0.9,
    "status": "active",
    "replacement_memory_id": null,
    "usage_count": 4,
    "memory_score": 0.72,
    "vector_sync_status": "synced",
    "vector_sync_error": null,
    "last_used_at": null,
    "created_at": "2026-08-16T10:00:00.000Z",
    "updated_at": "2026-08-16T10:00:00.000Z"
  }
]
```

### PATCH /api/memory/:id

**功能：** 修改记忆类型、内容或重要度，并同步更新 Chroma 向量。

**请求体：**
```json
{
  "type": "preference",
  "content": "用户喜欢无糖生椰拿铁",
  "importance": 0.85
}
```

`confidence` 只读，由记忆提取流程维护。返回数据包含 `status`（active/superseded/archived）、`replacement_memory_id`、`usage_count` 与 `memory_score`，Memory 页面据此区分当前记忆与历史记忆。向量同步失败时，MySQL 记录保留最新内容并标记 `vector_sync_status=failed`。

### DELETE /api/memory/:id

**功能：** 先删除 Chroma 向量，成功后删除 MySQL 记录。

**响应 `data`：**
```json
{ "success": true }
```

Chroma 删除失败时返回 HTTP 503，MySQL 记录保留并记录失败原因，避免产生不可见的孤立向量。

---

## 九、Notification API

Notification API 管理默认用户指定角色的主动消息中心。普通 REST 响应统一包装为 `{ success, data, message, timestamp }`。

### GET /api/notifications/:characterId

**功能：** 查询角色的主动消息，按创建时间倒序返回。

**查询参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `unreadOnly` | boolean | ❌ | 传入 `true` 时仅返回未读消息 |

**响应 `data`：**
```json
[
  {
    "id": 1,
    "user_id": "default",
    "character_id": "character-id",
    "type": "event_reminder",
    "content": "你昨天提到今天有考试，希望一切顺利。",
    "memory_event_id": 3,
    "source_memory_id": 12,
    "status": "unread",
    "read_at": null,
    "created_at": "2026-08-16T01:00:00.000Z",
    "updated_at": "2026-08-16T01:00:00.000Z"
  }
]
```

`type` 支持 `event_reminder`（事件提醒）和 `wellbeing_checkin`（基于近期压力、焦虑等事件记忆的关切）。调度器不会生成无理由的日常问候。

### PATCH /api/notifications/:id/read

**功能：** 将一条主动消息标记为已读。重复调用保持幂等并返回当前通知。

---

## 十、未来 API（规划中）

### Vision API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/vision/analyze` | 分析屏幕截图（multipart/form-data） |

### Agent API

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/agent/decide` | Agent 行为决策 |

### Emotion API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/emotion/state` | 获取当前情绪状态 |

---

## 附：通用错误响应格式

```json
{
  "success": false,
  "message": "错误描述",
  "timestamp": "2026-08-12T12:00:00.000Z"
}
```

---

## v0.15.0 主动通知与控制中心

### 通知偏好

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notification-preferences/global` | 获取全局默认偏好 |
| PATCH | `/api/notification-preferences/global` | 更新全局默认偏好 |
| GET | `/api/notification-preferences/characters/:characterId` | 获取角色覆盖和最终生效值 |
| PATCH | `/api/notification-preferences/characters/:characterId` | 创建或更新角色覆盖 |
| DELETE | `/api/notification-preferences/characters/:characterId` | 删除覆盖并立即恢复继承 |

偏好字段：`enabled`、`systemEnabled`、`eventReminderEnabled`、`wellbeingCheckinEnabled`、`quietStart`、`quietEnd`、`dailyLimit`、`cooldownMinutes`。角色没有覆盖时继承全局默认值。

### 通知操作

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/notifications/unread` | 查询尚未投递到 Electron 系统通知的未读提醒 |
| GET | `/api/notifications/:id/context` | 返回通知、来源记忆、关联事件及可展示的触发原因 |
| PATCH | `/api/notifications/:id/read` | 标记已读，幂等 |
| PATCH | `/api/notifications/:id/system-delivered` | Electron 成功展示 Windows 通知后回写投递时间 |
| POST | `/api/notifications/:id/snooze` | 事件提醒稍后提醒；请求体 `{"mode":"one_hour"|"tomorrow_morning"}` |
| POST | `/api/notifications/:id/dismiss` | 事件提醒取消关联事件；关切提醒标记忽略 |

系统通知仅在 Electron 正在运行时由渲染进程轮询并经 IPC 投递；应用退出后不做常驻或系统计划任务推送。

## v0.16.0 对话体验与一致性 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/conversations/:id/messages?page=1&limit=50` | 最新页优先、页内按时间正序返回的消息分页 |
| PATCH | `/api/conversations/:id/messages/:messageId` | 编辑用户消息，截断该消息及之后历史并异步重建会话派生产物 |
| POST | `/api/conversations/:id/messages/:messageId/regenerate` | 截断目标轮次及后续历史，返回原用户内容供 SSE 重新发送 |
| DELETE | `/api/conversations/:id/messages/:messageId` | 删除当前轮次及之后历史并重建 |
| GET | `/api/conversations/:id/export?format=markdown|json` | 导出当前会话 |

消息写入时同一问答轮共享 `turn_id`。会话改写会同步清空摘要及摘要覆盖计数，并刷新 `message_count`；前端完成新的 SSE 回答后重新持久化该轮消息。

自动记忆从 v0.16 起记录 `origin=automatic`、会话与用户/助手消息来源。编辑、删除或重新生成只移除当前会话的自动来源并重新提取仍有效的用户消息；`origin=legacy` 的旧记忆不会被自动删除。


## v0.17.0 情绪智能层 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/emotion-preferences` | 查询默认用户的情绪理解开关。 |
| PATCH | `/api/emotion-preferences` | 更新 `{ "enabled": boolean }`；关闭后停止新识别与情绪上下文注入。 |
| GET | `/api/emotions/characters/:characterId?from&to&page&limit` | 查询当前角色在日期范围内的情绪记录，默认最近 30 天。 |
| GET | `/api/emotions/characters/:characterId/summary` | 查询当前角色最近 7 天的主情绪、平均强度、记录数和分布。 |
| PATCH | `/api/emotions/:id` | 手动修正 `{ emotion, intensity, reason? }`；来源改为 `manual`，自动任务不会覆盖。 |
| DELETE | `/api/emotions/:id` | 删除单条当前默认用户的情绪记录。 |
| DELETE | `/api/emotions/characters/:characterId` | 清除当前角色的全部情绪历史。 |

情绪记录仅存储分类、强度、置信度、简短原因与消息关联 ID，不保存用户原话。高风险表达不会创建普通情绪记录。
---

## v0.18.0 角色形象字段

v0.18 不新增后端 REST 路由；角色形象继续使用既有 `POST /api/character` 与 `PUT /api/character/:id` 持久化。

```json
{
  "appearance": {
    "modelId": "hiyori_free",
    "expressionSetId": "",
    "motionSetId": "",
    "backgroundId": "",
    "themeId": ""
  }
}
```

- `appearance` 为可选对象；旧角色不传该字段时保持兼容。
- 本期仅使用 `appearance.modelId`；其他字段是未来声音、主题、背景、动作与表情方案的扩展位。
- Electron 模型注册表与 `PetEventBus` 仅为桌面运行时 IPC，不暴露为 HTTP API。
