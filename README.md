# chatgpt-proxy

基于 Cloudflare Worker 的 API 反向代理。

## 路由规则

路由按以下优先级匹配：

1. `47.121.196.163` 请求 `/apimart` 前缀下的 APIMart 图片生成白名单接口时，移除前缀并转发到 `https://api.apimart.ai`。
2. `47.121.196.163` 请求 `/packyapi` 前缀下的 PackyAPI 图片生成白名单接口时，移除前缀并转发到 `https://api-slb.packyapi.com`。
3. 请求来源 IP 为 `124.223.56.15` 时，转发到 `https://aihub.top`。
4. 其他请求的路径包含 `fulln` 时，转发到 `https://chat-gpt-fulln.vercel.app`。
5. 其余请求转发到 `https://api.openai.com`。

APIMart 路由只允许 Elemento 生产服务器访问以下接口，不提供任意目标或任意路径代理：

- `POST /apimart/v1/uploads/images`
- `POST /apimart/v1/images/generations`
- `GET /apimart/v1/tasks/<task_id>`
- `GET /apimart/v1/balance`

转发时会保留原始请求的路径、查询参数、方法、请求头和请求体。例如服务器调用：

```bash
curl https://<你的 Worker 域名>/v1/models \
  -H 'Authorization: Bearer <AIHUB_API_KEY>'
```

Cloudflare Worker 会根据 `CF-Connecting-IP` 识别来源服务器，并将请求转发到：

```text
https://aihub.top/v1/models
```

无需把 API Key 配置在 Worker 中；客户端原有的 `Authorization` 请求头会直接转发。

## 测试

```bash
npm test
```
