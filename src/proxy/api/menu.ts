import { logger } from '../../util';
import fetch from '../fetch';
import getUrl from '../url';
import { Env } from './login';

const store = new Map<string, { expired: number, data: any }>();

export type Menu = {
  appId: string;
  appName: string;
  /** 菜单名字 */
  name: string;
  id: string;
  path: string;
  parentId: string;
  children?: Menu[];
  hasChildren: boolean;
}

/**
 * 获取菜单
 */
export async function getMenu(env: Env) {
  const url = '/cams/menu/routes';
  const cacheData = store.get(url);
  // 缓存5分钟
  if (cacheData && Date.now() - cacheData.expired < 300 * 1000) return cacheData.data as Menu[];

  return fetch({
    method: 'get',
    url,
    params: { env },
  }).then((res) => {
    store.set(url, { expired: Date.now(), data: res.data });
    return res.data as Menu[];
  });
}

type ResItem = {
  appId: string;
  appName: string;
  id: string;
  remark: string | null;
  resName: string;
  url: string;
}

interface MenuDetail {
  alias: string;
  appId: string;
  category: number | string;
  icon: string;
  id: string;
  label: string;
  name: string;
  parentId: string;
  parentName: string;
  path: string;
  remark: string;
  sort: number;
  resList: ResItem[];
}

/**
 * 获取菜单详情
 */
export async function getMenuDetail(id: string, platform: string, env: Env) {
  return fetch({
    method: 'get',
    url: getUrl(platform, '/menu/detail'),
    params: { id, env },
  }).then((res) => res.data as MenuDetail);
}

/**
 * 新增 权限资源
 */
export async function addResource(appId: string, apiUrl: string, platform: string, env: Env) {
  return fetch({
    method: 'post',
    url: getUrl(platform, '/resource/save'),
    data: {
      appId,
      enable: 1,
      remark: '来自脚本自动添加',
      resName: apiUrl,
      url: apiUrl,
    },
    params: { env },
  }).then((res) => res.data);
}

type ResouceTree = {
  appName: string;
  id: number;
  resList: {
    id: string;
    url: string;
    resName: string;
  }[];
}

/**
 * 获取资源树
 */
export async function getResourceTree(platform: string, env: Env) {
  return fetch({
    method: 'get',
    url: getUrl(platform, '/resource/tree'),
    params: { env },
  }).then((res) => res.data as ResouceTree[]);
}

interface UpdateMenuParams extends Omit<MenuDetail, 'resList'> {
  resList: string[];
}

/**
 * 更新菜单
 */
export async function updateMenu(data: UpdateMenuParams, platform:string, env: Env) {
  return fetch({
    method: 'post',
    url: getUrl(platform, '/menu/submit'),
    data,
    params: { env },
    headers: {
      'Blade-Menu-id': '39',
    },
  }).then((res: any) => {
    logger(env, platform, '配置资源权限成功');
    return res.code as number;
  });
}
