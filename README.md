# chatgpt-proxy

基于 Cloudflare Worker 的 API 反向代理。

## 路由规则

路由按以下优先级匹配：

1. 请求来源 IP 为 `124.223.56.15` 时，转发到 AIHub，上游默认为 `https://api.aihubmix.com`。
2. 其他请求的路径包含 `fulln` 时，转发到 `https://chat-gpt-fulln.vercel.app`。
3. 其余请求转发到 `https://api.openai.com`。

转发时会保留原始请求的路径、查询参数、方法、请求头和请求体。例如服务器调用：

```bash
curl https://<你的 Worker 域名>/v1/models \
  -H 'Authorization: Bearer <AIHUB_API_KEY>'
```

Cloudflare Worker 会根据 `CF-Connecting-IP` 识别来源服务器，并将请求转发到：

```text
https://api.aihubmix.com/v1/models
```

如果你所说的 AIHub 不是 AIHubMix，可在 Cloudflare Worker 中配置文本变量 `AIHUB_ORIGIN`，值必须是带协议的源站地址，例如：

```text
AIHUB_ORIGIN=https://api.example.com
```

无需把 API Key 配置在 Worker 中；客户端原有的 `Authorization` 请求头会直接转发。

## 测试

```bash
npm test
```
