import axios from 'axios';
import getUserInfo from './api/login';
import type { Env } from './api/login';

const fetch = axios.create();

fetch.interceptors.request.use(async (config) => {
  const { params } = config;
  const env = params.env as Env;
  delete params.env;
  const userinfo = await getUserInfo(env);

  config.baseURL = `http://${env}-cams-gateway.zehui.local`;
  Object.assign(config.headers!, {
    Authorization: 'Basic c2FiZXI6Y2Ftc19zYWJlcl9zZWNyZXQ=',
    'Blade-Auth': `bearer ${userinfo.access_token}`,
    'content-type': 'application/json',
  });
  config.params = params;
  return config;
});

fetch.interceptors.response.use((res) => res.data, (err) => {
  if (err.response) {
    console.error('=>', err.config.url, JSON.stringify(err.response.data));
  }
  throw err;
});

export default fetch;
