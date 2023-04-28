/**
 * 用于区分服务中心权限和租户中心权限的api接口
 */
export default function getUrl(platform: string, url: string) {
  const prefix = platform === 'service' ? 'cams' : 'opms';
  return `/${prefix}${url}`;
}
