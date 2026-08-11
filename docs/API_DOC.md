# API 接口规范

> 基础 URL: `http://localhost:3000/api`

---

## 接口总览

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/health` | 健康检查 | ✅ 已实现 |
| POST | `/chat/send` | 发送聊天消息（SSE 流式） | ✅ 已实现 |
| POST | `/character` | 创建/更新角色 | 📋 规划中 |
| GET | `/character` | 获取角色配置 | 📋 规划中 |
| GET | `/memory/search` | 搜索长期记忆 | 📋 规划中 |
| POST | `/vision/analyze` | 分析屏幕截图 | 📋 规划中 |
| POST | `/agent/decide` | Agent 行为决策 | 📋 规划中 |
| GET | `/emotion/state` | 获取情绪状态 | 📋 规划中 |

---

## 一、健康检查

### GET /api/health

**功能：** 检查服务是否正常运行。

**请求示例：**
```
GET /api/health
```

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2026-08-11T12:00:00.000Z",
  "version": "0.1.0"
}
```

**错误情况：**
| 场景 | HTTP 状态码 | 说明 |
|------|------------|------|
| 服务未启动 | - | 连接拒绝 |

---

## 二、聊天接口

### POST /api/chat/send

**功能：** 发送聊天消息，通过 SSE（Server-Sent Events）流式返回 AI 回复。

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
{
  "content": "最近学习压力很大。",
  "history": [
    {
      "role": "user",
      "content": "你好"
    },
    {
      "role": "assistant",
      "content": "你好！今天过得怎么样？"
    }
  ],
  "modelConfig": {
    "apiKey": "sk-...",
    "apiBaseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 1024
  }
}
```

**请求参数说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | ✅ | 用户消息内容，最大 5000 字符 |
| `history` | array | ❌ | 历史消息数组，最多保留 20 条 |
| `history[].role` | string | ✅ | `"user"` 或 `"assistant"` |
| `history[].content` | string | ✅ | 消息内容 |
| `modelConfig` | object | ❌ | 运行时模型配置（不传则使用 .env 默认值） |
| `modelConfig.apiKey` | string | ❌ | API Key（不传则使用环境变量） |
| `modelConfig.apiBaseUrl` | string | ❌ | API 地址（默认 `https://api.openai.com/v1`） |
| `modelConfig.model` | string | ❌ | 模型名称（默认 `gpt-4o`） |
| `modelConfig.temperature` | number | ❌ | 0-2，默认 0.7 |
| `modelConfig.maxTokens` | number | ❌ | 128-8192，默认 1024 |

**SSE 响应格式：**

每条数据以 `data: ` 开头，JSON 格式：

```json
{
  "content": "学习",
  "fullContent": "学习确实容易",
  "done": false
}
```

```json
{
  "content": "",
  "fullContent": "学习确实容易让人感到疲惫，记得适当休息哦。",
  "done": true,
  "id": "1712345678901-abc123"
}
```

**SSE 响应字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | string | 当前增量 Token 内容 |
| `fullContent` | string | 完整累积内容 |
| `done` | boolean | 是否生成完毕 |
| `id` | string | 生成完毕时返回消息 ID |
| `error` | string | 错误信息（仅出错时返回） |

**完整 SSE 流示例：**

```
data: {"content":"学","fullContent":"学","done":false}
data: {"content":"习","fullContent":"学习","done":false}
data: {"content":"确","fullContent":"学习确","done":false}
...
data: {"content":"","fullContent":"学习确实容易让人感到疲惫，记得适当休息哦。","done":true,"id":"1712345678901-abc123"}
```

**错误情况：**

| 场景 | SSE 返回的 error 字段 |
|------|----------------------|
| API Key 无效 | `"API Key 无效，请检查您的 LLM_API_KEY 配置"` |
| API 配额不足 | `"API 配额不足，请检查您的账户余额"` |
| 网络连接失败 | `"无法连接到模型服务，请检查网络或 BASE_URL 配置"` |
| 上下文过长 | `"对话内容过长，请简化您的问题或清空历史记录"` |
| API Key 未配置 | `"LLM_API_KEY not configured. 请在设置中配置 API Key"` |

---

## 三、角色接口（规划中）

### POST /api/character

**功能：** 创建或更新 AI 角色配置。

**请求体：**
```json
{
  "name": "艾莉",
  "age": 20,
  "gender": "female",
  "background": "陪伴用户学习和生活的AI伙伴",
  "personality": "温柔、理性、善解人意",
  "speakingStyle": "简洁、自然",
  "likes": ["阅读", "编程"],
  "dislikes": ["嘈杂环境"]
}
```

### GET /api/character

**功能：** 获取当前角色配置。

**响应：**
```json
{
  "name": "艾莉",
  "personality": "温柔、理性、善解人意",
  "speakingStyle": "简洁、自然"
}
```

---

## 四、记忆接口（规划中）

### GET /api/memory/search

**功能：** 搜索长期记忆。

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | ✅ | 搜索内容 |
| `type` | string | ❌ | 记忆类型：`interest`/`habit`/`goal`/`event` |
| `limit` | number | ❌ | 返回条数，默认 5 |

**响应：**
```json
{
  "memories": [
    {
      "id": "1",
      "type": "interest",
      "content": "Unity 游戏开发",
      "importance": "high",
      "createdAt": "2026-08-01T10:00:00Z"
    }
  ]
}
```

---

## 五、视觉感知接口（规划中）

### POST /api/vision/analyze

**功能：** 分析屏幕截图，返回用户当前环境和活动描述。

**请求体：** `multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `image` | file | ✅ | 屏幕截图（PNG/JPEG） |
| `maxTokens` | number | ❌ | 分析 Token 上限 |

**响应：**
```json
{
  "activeApplication": "Visual Studio Code",
  "applicationType": "IDE",
  "generalActivity": "用户正在编写 C++ 代码",
  "detailIndicators": ["代码中包含多个文件", "似乎在解决编译错误"],
  "shouldInteract": true,
  "interactReason": "用户可能遇到开发问题"
}
```

---

## 六、Agent 接口（规划中）

### POST /api/agent/decide

**功能：** 根据当前状态决策是否主动发言。

**请求体：**
```json
{
  "screenState": { "...": "视觉分析结果" },
  "userBehavior": "编程已持续 45 分钟",
  "timeOfDay": "22:30",
  "lastInteractionMinutes": 10
}
```

**响应：**
```json
{
  "shouldSpeak": true,
  "message": "已经学习很久了，要不要休息一下？",
  "emotion": "caring",
  "priority": "medium"
}
```

---

## 七、情绪接口（规划中）

### GET /api/emotion/state

**功能：** 获取当前角色情绪状态。

**响应：**
```json
{
  "happy": 0.7,
  "trust": 0.6,
  "affection": 0.5,
  "energy": 0.4,
  "currentEmotion": "happy"
}
```

---

## 附：通用错误响应格式

所有非 SSE 接口的统一错误响应：

```json
{
  "success": false,
  "message": "错误描述",
  "timestamp": "2026-08-11T12:00:00.000Z"
}
```
