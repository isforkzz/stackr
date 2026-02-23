# @forkzz/stackr

TypeScript/JavaScript SDK for the [Stackr Host](https://stackr.lat) — manage and deploy your apps programmatically.

## Installation

```bash
npm install stackr-sdk
```

## Quick start

```ts
import { Client } from "@forkzz/stackr";

const stackr = new Client({
  token: process.env.STACKR_TOKEN, // sk_live_...
});

const apps = await stackr.apps.list();
```

> ⚠️ Generate your token at: **Dashboard → Settings → API Token**

---

## Reference

### `new Client(config)`

| Option    | Type     | Required | Description                    |
|-----------|----------|----------|-------------------------------|
| `token`   | `string` | ✅        | API Token (`sk_live_...`)      |
| `baseUrl` | `string` | ❌        | Custom base URL (optional)     |

---

### `stackr.apps`

| Method            | Route                        | Description                     |
|-------------------|------------------------------|---------------------------------|
| `list()`          | `GET /apps`                  | List all apps                   |
| `get(id)`         | `GET /apps/{id}`             | Get app details                 |
| `logs(id)`        | `GET /apps/{id}/logs`        | Get app logs                    |
| `stats(id)`       | `GET /apps/{id}/stats`       | CPU, RAM and network stats      |
| `upload(options)` | `POST /apps/upload`          | Deploy app via .zip             |
| `start(id)`       | `POST /apps/{id}/start`      | Start app                       |
| `stop(id)`        | `POST /apps/{id}/stop`       | Stop app                        |
| `restart(id)`     | `POST /apps/{id}/restart`    | Restart app                     |
| `rebuild(id)`     | `POST /apps/{id}/rebuild`    | Rebuild container               |
| `delete(id)`      | `POST /apps/{id}/delete`     | ⚠️ Permanently delete app       |

---

## Examples

### Deploy an app
```ts
import { readFileSync } from "fs";

const buffer = readFileSync("./my-app.zip");
const file = new Blob([buffer], { type: "application/zip" });

const app = await stackr.apps.upload({ file, name: "my-api" });
console.log("App ID:", app.id);
```

### Monitor stats
```ts
const stats = await stackr.apps.stats(appId);
console.log(`CPU: ${stats.cpu}% | RAM: ${stats.memory}MB`);
```

### Control your app
```ts
await stackr.apps.stop(appId);
await stackr.apps.start(appId);
await stackr.apps.restart(appId);
await stackr.apps.rebuild(appId);
```

### Error handling
```ts
import { StackrError } from "stackr-sdk";

try {
  await stackr.apps.get("invalid-id");
} catch (err) {
  if (err instanceof StackrError) {
    console.error(`Error ${err.status}:`, err.message);
    console.error("Body:", err.body);
  }
}
```

---

## Build

```bash
npm run build   # outputs CJS, ESM and .d.ts to /dist
npm run dev     # watch mode
npm run lint    # type check
```

## License

GPL-3.0
