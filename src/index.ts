/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           @forkzz/stackr  v1.0.0                     ║
 * ║   TypeScript SDK for the Stackr API                  ║
 * ║   https://stackr.lat  ·  https://docs.stackr.lat     ║
 * ║                                                      ║
 * ║   © forkzz — GPL-3.0 License                        ║
 * ║   https://github.com/forkzz/stackr                  ║
 * ╚══════════════════════════════════════════════════════╝
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  isAxiosError,
} from "axios";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const default_base_url = "https://api.stackr.lat/v1";
const default_timeout = 30_000;

// ─────────────────────────────────────────────────────────────────────────────
// Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientConfig {
  /**
   * Your API Token (`sk_live_...`).
   * Generate one at: Dashboard → Settings → API Token.
   */
  token: string;

  /**
   * Override the base URL.
   * @default "https://api.stackr.lat/v1"
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Enable verbose request/response logging.
   * @default false
   */
  debug?: boolean;
}

export type AppStatus =
  | "running"
  | "stopped"
  | "building"
  | "error"
  | "starting"
  | "stopping"
  | string;

export interface App {
  id: string;
  name: string;
  status: AppStatus;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface AppStats {
  cpu: number;
  memory: number;
  network: {
    in: number;
    out: number;
  };
  uptime?: number;
  [key: string]: unknown;
}

export interface AppLogs {
  logs: string;
  [key: string]: unknown;
}

export interface UploadOptions {
  /**
   * The `.zip` file of your app (File or Blob).
   */
  file: File | Blob;

  /**
   * Display name for the app (optional).
   */
  name?: string;

  /**
   * Extra fields to include in the multipart form.
   */
  [key: string]: unknown;
}

export interface DeleteResult {
  success: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Classes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base error class for all @forkzz/stackr SDK errors.
 * All errors thrown by this SDK extend this class.
 */
export class StackrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StackrError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns a non-2xx HTTP response.
 *
 * @example
 * ```ts
 * try {
 *   await client.apps.get("bad-id");
 * } catch (err) {
 *   if (err instanceof StackrApiError) {
 *     console.log(err.status); // 404
 *     console.log(err.body);   // { message: "App not found" }
 *     console.log(err.path);   // "/apps/bad-id"
 *   }
 * }
 * ```
 */
export class StackrApiError extends StackrError {
  constructor(
    message: string,
    /** HTTP status code returned by the API */
    public readonly status: number,
    /** Raw response body from the API */
    public readonly body: unknown,
    /** The request path that triggered this error */
    public readonly path: string
  ) {
    super(message);
    this.name = "StackrApiError";
  }
}

/**
 * Thrown when a request exceeds the configured timeout.
 *
 * @example
 * ```ts
 * } catch (err) {
 *   if (err instanceof StackrTimeoutError) {
 *     console.log(`Timed out after ${err.timeoutMs}ms on ${err.path}`);
 *   }
 * }
 * ```
 */
export class StackrTimeoutError extends StackrError {
  constructor(
    public readonly path: string,
    public readonly timeoutMs: number
  ) {
    super(`[@forkzz/stackr] Request to "${path}" timed out after ${timeoutMs}ms`);
    this.name = "StackrTimeoutError";
  }
}

/**
 * Thrown when a required argument is missing or invalid.
 *
 * @example
 * ```ts
 * } catch (err) {
 *   if (err instanceof StackrValidationError) {
 *     console.log(err.message); // "apps.get requires a valid app id"
 *   }
 * }
 * ```
 */
export class StackrValidationError extends StackrError {
  constructor(message: string) {
    super(`[@forkzz/stackr] ${message}`);
    this.name = "StackrValidationError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

function requireId(id: unknown, method: string): asserts id is string {
  if (!id || typeof id !== "string") {
    throw new StackrValidationError(`${method} requires a valid app id`);
  }
}

function log(debug: boolean, ...args: unknown[]): void {
  if (debug) console.log("[@forkzz/stackr]", ...args);
}

// ─────────────────────────────────────────────────────────────────────────────
// Apps Client
// ─────────────────────────────────────────────────────────────────────────────

export class AppsClient {
  constructor(
    private readonly http: AxiosInstance,
    private readonly debug: boolean
  ) {}

  private async call<T>(
    method: AxiosRequestConfig["method"],
    path: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    log(this.debug, `→ ${method?.toUpperCase()} ${path}`);

    try {
      const res: AxiosResponse<T> = await this.http.request({
        method,
        url: path,
        data,
        ...config,
      });

      log(this.debug, `← ${res.status} ${path}`);
      return res.data;
    } catch (err) {
      if (isAxiosError(err)) {
        if (err.code === "ECONNABORTED") {
          throw new StackrTimeoutError(path, err.config?.timeout ?? 0);
        }

        if (err.response) {
          const { status, data: body } = err.response;
          throw new StackrApiError(
            `[@forkzz/stackr] ${status} on ${method?.toUpperCase()} ${path}`,
            status,
            body,
            path
          );
        }
      }

      throw new StackrError(
        `[@forkzz/stackr] Network error on ${path}: ${String(err)}`
      );
    }
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /**
   * List all apps in your account.
   *
   * `GET /v1/apps`
   *
   * @example
   * ```ts
   * const apps = await client.apps.list();
   * apps.forEach(app => console.log(app.name, app.status));
   * ```
   */
  list(): Promise<App[]> {
    return this.call<App[]>("GET", "/apps");
  }

  /**
   * Get details of a specific app.
   *
   * `GET /v1/apps/{id}`
   *
   * @example
   * ```ts
   * const app = await client.apps.get("app_abc123");
   * console.log(app.status); // "running"
   * ```
   */
  get(id: string): Promise<App> {
    requireId(id, "apps.get");
    return this.call<App>("GET", `/apps/${id}`);
  }

  /**
   * Fetch the logs of an app.
   *
   * `GET /v1/apps/{id}/logs`
   *
   * @example
   * ```ts
   * const { logs } = await client.apps.logs("app_abc123");
   * console.log(logs);
   * ```
   */
  logs(id: string): Promise<AppLogs> {
    requireId(id, "apps.logs");
    return this.call<AppLogs>("GET", `/apps/${id}/logs`);
  }

  /**
   * Get real-time stats (CPU, RAM, network) for an app.
   *
   * `GET /v1/apps/{id}/stats`
   *
   * @example
   * ```ts
   * const stats = await client.apps.stats("app_abc123");
   * console.log(`CPU: ${stats.cpu}% | RAM: ${stats.memory}MB`);
   * ```
   */
  stats(id: string): Promise<AppStats> {
    requireId(id, "apps.stats");
    return this.call<AppStats>("GET", `/apps/${id}/stats`);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * Upload a `.zip` file and deploy your app.
   *
   * `POST /v1/apps/upload`
   *
   * @example
   * ```ts
   * import { readFileSync } from "fs";
   *
   * const buffer = readFileSync("./my-app.zip");
   * const file = new Blob([buffer], { type: "application/zip" });
   *
   * const app = await client.apps.upload({ file, name: "my-api" });
   * console.log("Deployed! ID:", app.id);
   * ```
   */
  upload(options: UploadOptions): Promise<App> {
    if (!options.file) {
      throw new StackrValidationError("apps.upload requires a file (.zip)");
    }

    const form = new FormData();
    form.append("file", options.file, "app.zip");
    if (options.name) form.append("name", options.name);

    for (const [key, value] of Object.entries(options)) {
      if (key !== "file" && key !== "name" && value != null) {
        form.append(key, String(value));
      }
    }

    return this.call<App>("POST", "/apps/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }

  /**
   * Start a stopped app.
   *
   * `POST /v1/apps/{id}/start`
   */
  start(id: string): Promise<App> {
    requireId(id, "apps.start");
    return this.call<App>("POST", `/apps/${id}/start`);
  }

  /**
   * Stop a running app.
   *
   * `POST /v1/apps/{id}/stop`
   */
  stop(id: string): Promise<App> {
    requireId(id, "apps.stop");
    return this.call<App>("POST", `/apps/${id}/stop`);
  }

  /**
   * Restart an app.
   *
   * `POST /v1/apps/{id}/restart`
   */
  restart(id: string): Promise<App> {
    requireId(id, "apps.restart");
    return this.call<App>("POST", `/apps/${id}/restart`);
  }

  /**
   * Rebuild the app's container from scratch.
   *
   * `POST /v1/apps/{id}/rebuild`
   */
  rebuild(id: string): Promise<App> {
    requireId(id, "apps.rebuild");
    return this.call<App>("POST", `/apps/${id}/rebuild`);
  }

  /**
   * Permanently delete an app.
   *
   * `POST /v1/apps/{id}/delete`
   *
   * > ⚠️ **This action is irreversible.** The app and all its data will be lost.
   */
  delete(id: string): Promise<DeleteResult> {
    requireId(id, "apps.delete");
    return this.call<DeleteResult>("POST", `/apps/${id}/delete`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The main @forkzz/stackr client.
 *
 * @example
 * ```ts
 * import { Client } from "@forkzz/stackr";
 *
 * const client = new Client({ token: process.env.STACKR_TOKEN });
 *
 * // List apps
 * const apps = await client.apps.list();
 *
 * // Deploy
 * const app = await client.apps.upload({ file: zipBlob });
 *
 * // Control
 * await client.apps.restart(app.id);
 * ```
 */
export class Client {
  /** Manage your apps: deploy, control, monitor. */
  public readonly apps: AppsClient;

  /** Resolved config used by this client instance. */
  public readonly config: Readonly<Required<ClientConfig>>;

  constructor(config: ClientConfig) {
    if (!config.token) {
      throw new StackrValidationError(
        "token is required. Generate one at: Dashboard → Settings → API Token"
      );
    }

    this.config = {
      token: config.token,
      baseUrl: (config.baseUrl ?? default_base_url).replace(/\/$/, ""),
      timeout: config.timeout ?? default_timeout,
      debug: config.debug ?? false,
    };

    const http = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "User-Agent": "@forkzz/stackr",
        Accept: "application/json",
      },
    });

    this.apps = new AppsClient(http, this.config.debug);
  }
}

export default Client;
