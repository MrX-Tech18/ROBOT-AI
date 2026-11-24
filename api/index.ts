import type { Request, Response } from 'express';
import { createApp } from '../server.ts';

const app = createApp({ serveFrontend: false });

export default async function handler(req: Request, res: Response): Promise<void> {
  const requestUrl = new URL(req.url ?? '/', 'http://vercel.local');
  const route = requestUrl.searchParams.get('__route');
  if (route) {
    requestUrl.searchParams.delete('__route');
    requestUrl.pathname = `/api/${route.replace(/^\/+/, '')}`;
    req.url = `${requestUrl.pathname}${requestUrl.search}`;
  }

  (await app)(req, res);
}
