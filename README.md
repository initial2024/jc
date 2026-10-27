# dsh-relay-status-ui

这是 DSH Web 的独立界面增强插件，只负责显示，不参与 Provider、tool-call admission、工具执行或 QA 判定。

## v0.1.0

- 在 composer dock 显示“Relay 增强已启用”状态。
- 为 `web_relay_compat_feedback` 提供专用 Tool 卡片。
- 将被跳过的工具逐项显示：工具名、reason、可折叠 detail。
- 明确显示“跳过原因已反馈给模型”。
- 不替换 DSH 根节点，不读取其他插件 DOM，不修改工具执行结果。
- 删除本插件后，DSH 自动回退到原生通用工具卡片。

## 与现有插件的职责边界

- `wet`：Web Gateway / Provider。
- `ck`：tool-call 兼容、逐项校验、部分失败继续、反馈模型。
- `cs`：只读 QA preset。
- `jc`：纯 UI 展示层。

## 安全边界

本插件没有 Host 侧执行逻辑；`index.js` 的 `apply()` 为空。浏览器端仅注册 DSH 官方 slot：

- `conversation.composer.dock`
- `tool.call.toolview` / key=`web_relay_compat_feedback`

因此它不会放行被 `ck` 拒绝的调用，也不会自己执行任何工具。


## v0.2.0

新增：

- 每轮工具状态摘要：成功、执行中、失败、跳过分别显示。
- `web_relay_compat_feedback` 的跳过原因在折叠工具组之外仍保留一张 Turn Tail 摘要卡。
- 工具参数默认折叠，按需展开。
- 连接状态：读取官方 `ctx.connection.state`。
- Provider / Model：读取官方 `modelSelection` 投影。
- 上下文占用：读取官方 `contextPressure`，优先显示 projectedTokens / contextWindow；90% 以上加警示。
- 草稿状态：附件数量、提交阶段、队列数量、pending submission。
- persistent bash cwd/inode 异常识别，并在本轮卡片中明确告警。

明确不做：

- 不自行重置 persistent bash。Host 内部有 reset 能力，但当前没有公开 Client/Remote 安全接口。
- 不自动创建或切换新会话。当前仅提供上下文压力预警，避免在没有正式 handoff 协议时丢失上下文。
- 不伪造逐文件上传百分比；该内部 upload hook 没有开放给第三方 list slot。
