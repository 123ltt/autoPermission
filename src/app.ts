import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { loginByToken } from './proxy/api/login';
import type { Env } from './proxy/api/login';
import updateMenuResource from './proxy/index';
import { cacheMenu } from './proxy/api/saasMenu';
import { logger } from './util';

cacheMenu('test');

function getPlatformAndEnv(req: IncomingMessage): { platform: string; env: Env } | null {
  if (req.headers.referer) {
    const refererUrl = new URL(req.headers.referer);

    // 本地开发模式
    if (refererUrl.hostname === 'localhost') {
      const platform = req.headers.platform as string;
      if (!platform || typeof platform !== 'string') return null;
      return { platform, env: 'test' };
    }

    let platform = '';
    let env;
    const matched = refererUrl.hostname.match(/^(dev|test|pre)-(service|saas)\./) || [];
    if (matched.length === 3) {
      platform = matched[2] as string;
      env = matched[1] as Env;
      return { platform, env };
    }
  }
  return null;
}

function notFound(res: ServerResponse) {
  res.statusCode = 404;
  res.end('Not found');
}

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, t-access, t-refresh, platform');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.end('');
    return;
  }

  if (req.method !== 'GET') {
    notFound(res);
    return;
  }

  const info = getPlatformAndEnv(req);
  if (!info) {
    notFound(res);
    return;
  }
  const { platform, env } = info;

  const url = new URL(`http://foo.xxx${req.url}`);
  if (url.pathname === '/update/permission') {
    if (!info) {
      res.statusCode = 500;
      res.end(JSON.stringify({ info: '非法来源地址' }));
      return;
    }

    const menuName = url.searchParams.get('menuName') || '';
    const locationPathName = url.searchParams.get('route') || '';
    const resourceUrl = url.searchParams.get('resourceUrl') || '';

    if (locationPathName.startsWith('/common/')) {
      res.statusCode = 500;
      console.error(`${locationPathName} 需要手动配置菜单资源 ${resourceUrl}`);
      res.end(JSON.stringify({ info: '该页面需要手动配置菜单资源' }));
      return;
    }

    try {
      await updateMenuResource({
        menuName,
        locationPathName,
        resourceUrl,
        platform,
      }, env);
      res.end('ok');
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json;charset=UTF-8');
      console.error(menuName, locationPathName, resourceUrl, err?.message || err);
      res.end(JSON.stringify({ info: `「自动配置权限资源」：${err.message}` }));
    }
  } else if (url.pathname === '/loading.gif') {
    const tokenAccess = req.headers['t-access'] as string;
    const tokenRefresh = req.headers['t-refresh'] as string;
    await loginByToken(env, tokenAccess, tokenRefresh, platform);
    res.end('');
  } else {
    notFound(res);
  }
});

const port = process.env.PORT || 3400;
server.listen(port).once('listening', () => logger('Listening on', port));
