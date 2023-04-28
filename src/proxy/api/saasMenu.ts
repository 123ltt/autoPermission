import debounce from 'lodash.debounce';
import fetch from '../fetch';
import { Env } from './login';
import { Menu } from './menu';
import { logger } from '../../util';

const store = new Map<string, { appId: string; id: string }>();
let f: any = -1;

async function getMenu(parentId: string, env: Env) {
  return fetch({
    method: 'get',
    url: '/opms/menu/list',
    params: {
      parentId,
      category: 1,
      env,
    },
  }).then((res) => res.data as Menu[])
    .catch(() => {
      logger(env, '获取菜单失败');
      return [];
    });
}

async function doCacheMenu(env: Env) {
  const recursion = async (parentId: string, e: Env) => {
    const menus = await getMenu(parentId, env);
    if (Array.isArray(menus)) {
      const p: Promise<void>[] = [];
      for (const item of menus) {
        store.set(`${e}:${item.path}`, { appId: item.appId, id: item.id });
        if (item.hasChildren) {
          p.push(recursion(item.id, e));
        }
      }
      await Promise.all(p);
    }
  };
  logger(`${env} 开始缓存菜单数据`);
  await recursion('', env);
  logger(`${env} 缓存菜单数据成功`, store.size);
}

/**
 * start fetch all menus and cache every 10m
 */
export async function cacheMenu(env: Env) {
  clearInterval(f);
  await doCacheMenu(env);
  f = setInterval(async () => {
    await doCacheMenu(env);
  }, 10 * 60 * 1000);
}

export async function getSaasMenuData(routePath: string, env: Env) {
  return store.get(`${env}:${routePath}`);
}

/**
 * batch sync ams-db
 */
export const syncDb = debounce(async (env: Env) => {
  const ids = await fetch({
    method: 'get',
    url: '/opms/tenant/db/page',
    params: {
      env,
      current: 1,
      size: 100,
      dbStatus: 'finish',
      syncStatus: 'finish',
    },
  })
    .then((res) => res.data.records.map((item: { id: string }) => item.id))
    .catch((err) => {
      console.error(err.message || err);
      return [];
    });
  if (ids.length > 0) {
    await fetch({
      method: 'post',
      url: '/opms/tenant/db/syncBatch',
      data: ids,
      params: { env },
    })
      .then((res: any) => {
        if (res.success) {
          console.info('同步db成功');
        } else {
          console.error('同步db失败', res.msg);
        }
      })
      .catch((err) => console.error('同步db失败', err.message || err));
  }
}, 10 * 1000);
