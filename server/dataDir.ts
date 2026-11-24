import fs from 'node:fs';
import path from 'node:path';

const dataDir =
  process.env.ROBOT_AI_DATA_DIR ||
  (process.env.VERCEL ? '/tmp/robot-ai' : path.resolve(process.cwd(), '.data'));

export function getDataDir(): string {
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}
