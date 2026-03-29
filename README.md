# NapCat to WeChat Forwarder

### ✨ 特性
- **零成本运维**: 基于 Cloudflare Workers，无需服务器，即刻部署。
- **安全可靠**: 完整实现 HMAC-SHA1 签名验证，防止接口被非法调用。
- **极致体验**: 针对个人微信（企业微信插件）优化，支持文本气泡与图片超链接。
- **灵活过滤**: 内置白名单逻辑，支持按群号、QQ号过滤，且支持“机器人自身消息”自动放行。

### 🛠️ 快速部署

#### 方式一：一键部署
[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/xiaobaiweinuli/napcat-to-wechat-worker)

#### 方式二：手动部署
1. 克隆仓库。
2. 配置 `wrangler.toml` 中的 `WECHAT_ROBOT_KEY`、`NOTIFY_TOKEN` 和 `ALLOWED_IDS`。
3. 执行 `npx wrangler deploy`。

### ⚙️ 变量说明
| 变量名 | 必填 | 说明 |
| :--- | :--- | :--- |
| `WECHAT_ROBOT_KEY` | 是 | 企业微信机器人 Webhook 地址中 `key=` 后面的部分。 |
| `NOTIFY_TOKEN` | 是 | NapCat 配置页面填写的 Token，用于 HMAC-SHA1 签名校验。 |
| `ALLOWED_IDS` | 否 | 允许转发的群号或 QQ 号，多个请用英文逗号 `,` 分隔。 |
