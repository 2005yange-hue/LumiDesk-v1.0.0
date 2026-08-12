# TODO — 待开发功能列表

---

## 已完成 ✅

### Chat 聊天
- [x] 多轮连续对话（SSE 流式输出）
- [x] 停止生成控制
- [x] 消息持久化（MySQL conversations + messages）
- [x] 上下文管理（CHAT_CONTEXT_LIMIT 自动截断）
- [x] Prompt 消息顺序优化（system → character → memory → history → user）

### Memory 记忆
- [x] MemoryExtractor 长期记忆自动提取
- [x] JSON 多策略容错解析（parseEntries）
- [x] MySQL memory_entries 结构化存储
- [x] ChromaDB v2 向量存储 + 语义检索
- [x] Embedding 安全降级（无配置时跳过）
- [x] 记忆提取 Prompt 重写（模块身份 + 严格 JSON）

### Provider 管理
- [x] Provider CRUD（多 Provider 并存）
- [x] 优先级链（providerId → is_default → .env）
- [x] provider_type 预设（OpenAI / DeepSeek / Gemini / Claude / OpenRouter）
- [x] 模型参数配置（temperature / max_tokens / top_p）
- [x] 高级参数（stream / timeout / custom_headers / custom_body）
- [x] 连接测试（延迟 / tokens / 友好错误分类）
- [x] 远程获取模型列表
- [x] API Key 安全隔离（前端脱敏 + 后端查 DB）
- [x] 酒馆风格设置 UI

### Character 角色
- [x] Character CRUD 接口
- [x] 角色"艾莉"（默认角色）
- [x] PromptContextService 动态 Prompt 生成
- [x] 角色人格 Prompt 模板（character.txt）

---

## 当前开发 📋

### 文档体系
- [x] 全面整理 docs 文档结构
- [x] 新增 MODULES.md 模块职责文档
- [x] 更新各文档反映当前实现状态

### 对话体验增强（下一阶段）
- [ ] 对话历史分页加载（只加载最近 N 条 + 滚动加载更多）
- [ ] 消息编辑与重新生成
- [ ] 消息复制/删除
- [ ] 对话导出（Markdown / JSON）
- [ ] 预设开场白（每个角色可配置欢迎语）

---

## 未来规划 📋

### Audio 语音交互
- [ ] TTS（文本转语音）— 角色语音输出
- [ ] STT（语音转文字）— 用户语音输入
- [ ] 口型同步（配合 Live2D）
- [ ] 情绪语调调节（开心/难过/生气 音色变化）

### Live2D 角色展示
- [ ] Live2D 模型加载与渲染
- [ ] 表情切换（微笑/难过/惊讶/生气）
- [ ] 动作播放（挥手/点头/思考）
- [ ] 闲置动画（呼吸/眨眼/小动作）
- [ ] 情绪-动作映射（根据 LLM 输出情绪标签驱动）

### Vision 视觉感知
- [ ] Electron 定时屏幕截图
- [ ] VLM 多模态分析（理解屏幕内容）
- [ ] 环境状态识别（用户在编码/看视频/浏览网页）
- [ ] OCR 文字识别（识别屏幕中的文字）

### Agent 主动交互
- [ ] 行为决策引擎
- [ ] 情绪系统（开心度/信任度/亲密度/精力值）
- [ ] 情绪状态持久化（MySQL emotion_logs 表）
- [ ] 主动提醒与通知（Electron Notification）
- [ ] 智能打断（用户长时间不操作时的问候）

### 系统优化
- [ ] 对话历史清理（自动删除 N 天前的旧对话）
- [ ] 记忆衰减/过期机制
- [ ] 多用户支持（user_id 隔离）
- [ ] Embedding 批量处理优化
- [ ] API 请求重试 + 健康检查

---

## 技术债务

- [ ] 后端单元测试覆盖率
- [ ] 前端 E2E 测试
- [ ] 生产环境配置分离（dev/staging/prod .env）
- [ ] Electron 自动更新（autoUpdater）
- [ ] 错误监控与日志聚合（Sentry / 自定义）
