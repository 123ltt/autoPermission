// 自动登录
import { createHash } from 'crypto';
import axios from 'axios';
import fetch from '../fetch';
import { cacheMenu } from './saasMenu';
import { logger } from '../../util';

export type Env = 'dev' | 'test' | 'pre';

interface UserInfo extends Record<string, any> {
  account: string;
  access_token: string;
  refresh_token: string;
  password_expired: boolean;
  expires_in: number;
  login_time: number;
}

const captcha = {
  dev: {
    'Captcha-Code': 'f4ny2',
    'Captcha-Key': '32fe90648c03b01a7c3a6c1e61b66aa7',
  },
  test: {
    'Captcha-Code': 'bmvzb',
    'Captcha-Key': 'd7f2f4067eb59fb792e1834c0f1f0914',
  },
  pre: {
    'Captcha-Code': 'rbqr4',
    'Captcha-Key': 'fc9661b7845a7366cf4bd51427a8c130',
  },
};

const time = 10 * 60 * 1000; // 刷新 token 的间隔（10分钟）
const store = new Map<Env, UserInfo>();
const errorMessage = '自动配置权限失败';

async function login(username: string, password: string, env: Env = 'pre') {
  return axios({
    url: `http://${env}-cams-gateway.zehui.local/cams-auth/oauth/token`,
    method: 'post',
    headers: {
      Authorization: 'Basic c2FiZXI6Y2Ftc19zYWJlcl9zZWNyZXQ=',
      ...captcha[env],
    },
    data: {
      username,
      password: createHash('md5').update(password).digest('hex'),
      grant_type: 'captcha',
      scope: 'all',
      type: 'account',
      fp: '4f33929f3f417fa5434e00971bdffa74',
    },
  }).then((res) => res.data as UserInfo);
}

async function getUserInfoByRefreshToken(env: Env, tokenRefresh: string, isAutoRefresh = false) {
  return fetch({
    url: '/cams-auth/oauth/token',
    method: 'post',
    params: {
      env,
      refresh_token: tokenRefresh,
      grant_type: 'refresh_token',
      scope: 'all',
    },
  }).then((res) => {
    const data: UserInfo = res as any;
    if (data.account === 'admin' && !data.tenant_id) {
      logger(`${env} ${isAutoRefresh ? '更新token' : '登陆'}成功`);
      store.set(env, Object.assign(data, { login_time: Date.now() }));
      return res.data;
    }
    logger('非超级管理员的token');
    throw new Error(errorMessage);
  }).catch((err) => {
    if (err.response && err.response.status === 401) {
      throw new Error(errorMessage);
    }
  });
}

async function refreshToken(env: Env, isAutoRefresh?: boolean) {
  // 演示环境不需要验证码
  if (env === 'pre') {
    return login('admin', 'admin', env).then((data) => {
      store.set(env, Object.assign(data, { login_time: Date.now() }));
      return data;
    });
  }

  const userinfo = store.get(env);
  if (!userinfo) {
    logger(`程序没有登陆 ${env} 环境，无法进行下一步操作`);
    throw new Error(errorMessage);
  }
  return getUserInfoByRefreshToken(env, userinfo.refresh_token, isAutoRefresh);
}

function updateAllToken(k = store.keys()) {
  const { value, done } = k.next();
  if (done === false) {
    refreshToken(value, true).finally(() => updateAllToken(k));
  }
}

setInterval(() => updateAllToken(), time);

export default async function getUserInfo(env: Env) {
  const userinfo = store.get(env);
  if (!userinfo || Date.now() - userinfo.login_time > time) {
    return refreshToken(env);
  }
  return userinfo;
}

export async function loginByToken(
  env: Env,
  tokenAccess: string,
  tokenRefresh: string,
  platform?: string,
) {
  if (typeof tokenAccess !== 'string' || typeof tokenRefresh !== 'string') {
    logger('无效的 tokenAccess 和 tokenRefresh 参数', env, platform);
    return;
  }

  const userinfo = store.get(env);
  if (userinfo && Date.now() - userinfo.login_time < time) return;

  if (!userinfo) {
    // 临时设置数据，以便在 fetch 中能拿到数据
    store.set(env, { access_token: tokenAccess, refresh_token: tokenRefresh } as UserInfo);
  }

  await getUserInfoByRefreshToken(env, tokenRefresh).then(() => {
    // userinfo 为 undefined 说明是首次登陆，此时需要缓存菜单数据
    if (!userinfo && ['dev', 'test'].includes(env)) {
      cacheMenu(env);
    }
  });
}
