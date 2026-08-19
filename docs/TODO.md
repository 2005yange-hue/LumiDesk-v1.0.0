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
- [x] v0.8.1 记忆分类（preference / personality / event / relationship / fact）
- [x] 记忆质量、使用记录与角色隔离（confidence / last_used_at / character_id）

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

### Character State 角色状态
- [x] `character_state` MySQL 持久化
- [x] 状态读取与 Pinia store
- [x] Prompt 注入（personality → state → memory）
- [x] 基于关键词的轻量状态变化
- [x] 状态影响回复风格（关切 / 低精力 / 高亲密度分层规则）
- [x] v0.10.0 角色关系等级（陌生 / 熟悉 / 朋友 / 亲密 / 特殊关系）
- [x] 关系等级影响称呼、语气、主动关心和记忆权重

### Conversation 会话管理
- [x] 多会话管理
- [x] Conversation CRUD
- [x] Sidebar 会话列表
- [x] 历史消息加载
- [x] 自动标题生成
- [x] v0.9.0 长会话摘要（超过 50 条时压缩旧历史，摘要 + 有界近期原文进入 Prompt）

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

### v0.7.0 — Token 与上下文优化
- [x] Character State System（心情 / 精力 / 亲密度）
- [ ] Token Budget 管理
- [ ] Summary 摘要系统
- [ ] 长上下文优化

### v0.8.0 — 多模态与情绪
- [x] v0.18 通用 Live2D 桌宠（模型注册表 / 角色 appearance 绑定 / 动作语义映射 / 拖动缩放 / SSE 气泡 / 头像降级）
- [x] 情绪智能层（v0.17：六类用户情绪、强度/置信度、30 天留存、情绪中心、手动纠错与高风险安全兜底）
- [ ] 视觉感知（Electron 截图采集 / VLM 多模态分析 / 环境状态识别 / OCR）

### v0.8.1 — 记忆系统升级
- [x] 角色范围语义检索与 MySQL 兼容回退
- [ ] 记忆去重 / 合并策略
- [ ] 记忆衰减 / 自动归档

### v0.9.0 — 聊天上下文优化
- [x] 长会话摘要（超过 50 条时总结旧聊天）
- [x] 摘要持久化（`summary` / `summary_message_count`）
- [x] 摘要 + 最近原文上下文注入与失败降级

### v0.10.0 — 角色关系系统
- [x] `relationship_level` 持久化与 affinity 区间推导
- [x] 关系等级 Prompt 行为规则
- [x] 关系等级驱动的长期记忆检索数量与权重
- [x] 聊天页展示关系等级与亲密度

### 后续版本 — Agent 主动交互
- [ ] 行为决策引擎
- [ ] 主动提醒与通知（Electron Notification）
- [ ] 智能打断（用户长时间不操作时的问候）

### 后续规划
- [x] Audio 语音交互（TTS / STT / 口型同步 / 情绪语调）
- [ ] 对话历史清理（自动删除 N 天前的旧对话）
- [ ] 记忆衰减 / 过期机制
- [ ] 多用户支持（user_id 隔离）
- [ ] Embedding 批量处理优化
- [ ] API 请求重试 + 健康检查
- [x] 桌面版 SQLite 默认运行与 Electron 内置后端启动
- [x] Chroma 可选化与结构化记忆回退

---

## 技术债务

- [ ] 后端单元测试覆盖率
- [ ] 前端 E2E 测试
- [ ] 生产环境配置分离（dev/staging/prod .env）
- [ ] Electron 自动更新（autoUpdater）
- [ ] 错误监控与日志聚合（Sentry / 自定义）

### v0.18 后续形象能力 📋
- [ ] 普通用户导入 Live2D 模型（目录/压缩包校验、预览、删除与授权说明）
- [ ] VRM 与其他形象运行时适配器
- [ ] 语音口型同步与表情编辑方案
- [ ] 每角色声音、背景和主题方案
