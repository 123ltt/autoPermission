import {
  getResourceTree, getMenu, getMenuDetail, updateMenu, addResource,
} from './api/menu';
import type { Menu } from './api/menu';
import { Env } from './api/login';
import { getSaasMenuData, syncDb } from './api/saasMenu';
import { logger } from '../util';

/**
 * 根据资源的url获取对应的id
 */
async function getResouceIdByApiUrl(
  apiUrl: string,
  locationPathName: string,
  platform: string,
  env: Env,
  isRetry = false,
) {
  const tree = await getResourceTree(platform, env);

  const findId = () => {
    let backupId = '';
    let backupUrl = '';
    for (const item of tree) {
      for (const el of item.resList) {
        if (el.url === apiUrl) {
          return el.id;
        }
        /**
         * 处理 路径参数的地址，如 /a/b/123 ，其中 123 是参数
         * 匹配度越高，使用优先级越高
         */
        if (apiUrl.startsWith(el.url) && backupUrl.length < el.url.length) {
          // 校验是不是数字参数
          if (/^(\/\d)+$/.test(el.url.slice(apiUrl.length))) {
            backupUrl = el.url;
            backupId = el.id;
          }
        }
      }
    }
    return backupId;
  };

  const id = findId();

  // 如果没有找到权限资源，则自动添加
  if (!id && isRetry === false) {
    try {
      const menu = await getMenuData(locationPathName, env);
      if (menu) {
        await addResource(menu.appId, apiUrl, platform, env);
        // 添加成功后，重新再资源树中找一遍
        const id2 = await getResouceIdByApiUrl(
          apiUrl,
          locationPathName,
          platform,
          env,
          true,
        ) as string;
        return id2;
      }
    } catch (err) {
      console.error(err);
    }
  }

  return id;
}

/**
 * 根据访问页面的pathname获取对应的菜单id
 */
async function getMenuData(locationPathName: string, env: Env) {
  if (!locationPathName) return null;
  const menus = await getMenu(env);

  const getId = (menusData: Menu[]) => {
    let menu: unknown;
    const find = (data: Menu | Menu[]) => {
      if (Array.isArray(data)) {
        data.some((el) => find(el));
      } else if (data.path.toLocaleLowerCase() === locationPathName.toLocaleLowerCase()) {
        menu = data;
        return true;
      } else if (Array.isArray(data.children)) {
        find(data.children);
      }
      return false;
    };

    find(menusData);

    return menu as Menu;
  };

  return getId(menus);
}

type UpdateMenuResource = {
  menuName: string;
  locationPathName: string;
  resourceUrl: string;
  platform: string;
}

/**
 * 更新菜单资源
 */
async function updateMenuResource(
  {
    menuName, locationPathName, resourceUrl, platform,
  }: UpdateMenuResource,
  env: Env = 'pre',
) {
  const resourceId = await getResouceIdByApiUrl(resourceUrl, locationPathName, platform, env);
  if (!resourceId) throw new Error(`没有找到相应的关联资源 ${resourceUrl} ，请联系后端`);

  const menu = platform === 'service'
    ? await getMenuData(locationPathName, env)
    : await getSaasMenuData(locationPathName, env);

  if (!menu) throw new Error(`没有找到相应的菜单 【${menuName}】${locationPathName}`);

  const menuDetail = await getMenuDetail(menu.id, platform, env);

  const {
    appId, alias, category, icon, id, label, name,
    parentId, parentName, path, remark, resList, sort,
  } = menuDetail;

  const ids = resList.map((el) => el.id);

  if (ids.includes(resourceId)) {
    throw new Error(`资源 ${resourceUrl} 已配置`);
  }

  const params = {
    appId,
    alias,
    category: String(category),
    icon,
    id,
    label,
    name,
    parentId,
    parentName,
    path,
    remark,
    resList: [resourceId, ...resList.map((el) => el.id)],
    sort,
  };
  const code = await updateMenu(params, platform, env);

  // if save success, then sync db
  if (code === 200 && platform === 'saas') {
    syncDb(env);
  }

  logger(menuName, locationPathName, resourceUrl, platform);
}

export default updateMenuResource;
