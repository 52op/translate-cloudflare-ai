# 翻译 API — Cloudflare Workers AI

基于 [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) 的翻译接口，模型为 `@cf/meta/m2m100-1.2b`。

## 部署

### 一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/52op/translate-cloudflare-ai)

### 手动部署

```bash
npm install
npx wrangler deploy
```

## 环境变量

在 Cloudflare Dashboard → Worker → **变量与机密** 中设置：

| 变量 | 必填 | 说明 |
|---|---|---|
| `URL_PREFIX` | 否 | 路径前缀，如 `/translate`，不设置则不限制路径 |
| `ALLOW_ORIGINS` | 否 | 允许的请求来源 Origin，逗号分隔，支持 `*` 通配。为空则不检查 Origin |
| `API_TOKEN` | 否 | Bearer Token 鉴权，需走 `Authorization: Bearer <token>` 请求头。此变量需在**机密**中设置 |

### 鉴权规则

两个检查是 **或** 关系，任一通过即放行：

1. **Origin 检查** — 浏览器跨域请求自动携带 `Origin` 头，适合前端 Pages 调用
2. **API Token 检查** — 后端服务通过 `Authorization: Bearer <token>` 调用

都不通过则返回 403。

### ALLOW_ORIGINS 示例

| 值 | 效果 |
|---|---|
| (空) | 不检查 Origin |
| `*` | 允许所有来源 |
| `https://example.com` | 仅允许该域名 |
| `https://a.com,https://b.com` | 允许多个域名 |
| `*.pages.dev` | 允许所有 Cloudflare Pages 子域名 |

## 接口

```
POST /<URL_PREFIX>
Content-Type: application/json
Authorization: Bearer <token>   (如果设置了 API_TOKEN)
```

### 请求体

```json
{
  "source_lang": "auto",
  "target_lang": "chinese",
  "text_list": ["Hello world", "How are you?"]
}
```

- `source_lang` — 源语言，`"auto"` 或留空自动检测
- `target_lang` — 目标语言，如 `"chinese"`, `"english"`, `"french"`，支持 `"zh-CN"` 自动转 `"chinese"`
- `text_list` — 待翻译文本数组

### 响应

```json
{
  "translations": [
    { "detected_source_lang": "auto", "text": "你好世界" },
    { "detected_source_lang": "auto", "text": "你好吗？" }
  ],
  "message": "ok"
}
```

## 调用示例

### cURL

```bash
curl https://你的worker域名/translate \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer 你的token' \
  -d '{"source_lang":"auto","target_lang":"chinese","text_list":["Hello world"]}'
```

### 浏览器端 (fetch)

```js
const res = await fetch('https://你的worker域名/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source_lang: 'auto',
    target_lang: 'chinese',
    text_list: ['Hello world']
  })
})
const data = await res.json()
```

### Node.js

```js
import { createHmac } from 'node:crypto'

const res = await fetch('https://你的worker域名/translate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 你的token'
  },
  body: JSON.stringify({
    source_lang: 'auto',
    target_lang: 'chinese',
    text_list: ['Hello world']
  })
})
const data = await res.json()
console.log(data)
```

### 沉浸式翻译配置

在沉浸式翻译的**自定义接口**中填写：

- **API URL**: `https://你的worker域名/translate`
- **Model**: 留空或任意值
- **API Key**: 如果设置了 `API_TOKEN` 则填写 token，否则留空

## 本地测试

```bash
node test.js
```

按提示输入接口地址和待翻译内容即可。
