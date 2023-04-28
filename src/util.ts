import dayjs from 'dayjs';

export function logger(...args: any[]) {
  const date = dayjs().format('YYYY-MM-DD HH:mm:ss');
  console.info(`\x1b[32m${date}\x1b[0m`, ...args);
}
