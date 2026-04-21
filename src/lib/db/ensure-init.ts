/**
 * 确保数据库已初始化
 * 在第一次 API 调用时自动初始化，之后跳过
 */
import { initDb } from "./index";

let initialized = false;

export async function ensureDbInit() {
  if (initialized) return;
  await initDb();
  initialized = true;
}
