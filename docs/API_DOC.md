# API 接口规范

> 基础 URL: `http://localhost:3000/api`

---

## API 分类

| 分类 | 路径前缀 | 状态 |
|------|----------|------|
| Chat API | `/chat` | ✅ 已实现 |
| Provider API | `/provider` | ✅ 已实现 |
| Character API | `/character` | ✅ 已实现 |
| Conversation API | `/conversations` | ✅ 已实现 |
| Health API | `/health` | ✅ 已实现 |
| Memory API | — | 📋 规划中（当前通过 Provider API 间接使用） |
| Vision API | — | 📋 规划中 |
| Audio API | — | 📋 规划中 |
| Agent API | — | 📋 规划中 |

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
  "providerId": 1,
  "characterId": "default-elli",
  "model": "deepseek-v4-flash"
}
```

**请求参数说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | ✅ | 用户消息内容 |
| `history` | HistoryMessageDto[] | ❌ | 历史消息数组 |
| `providerId` | number | ❌ | 指定 Provider ID（不传则使用 default Provider） |
| `characterId` | string | ❌ | 指定角色 ID（不传则使用默认角色艾莉） |
| `model` | string | ❌ | 覆盖 Provider 的模型名称 |

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
    "id": "default-elli",
    "name": "艾莉",
    "age": 20,
    "gender": "female",
    "background": "陪伴用户学习和生活的AI伙伴",
    "personality": "温柔、理性、善解人意",
    "speaking_style": "简洁、自然"
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
  "speaking_style": "..."
}
```

---

### PUT /api/character/:id

**功能：** 更新角色。参数同 POST。

---

### DELETE /api/character/:id

**功能：** 删除角色。

---

## 四、Conversation API

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

## 五、Health API

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

## 五、未来 API（规划中）

### Memory API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/memory/search` | 搜索长期记忆（当前通过 ChatService 内部调用） |
| DELETE | `/memory/:id` | 删除指定记忆 |

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
