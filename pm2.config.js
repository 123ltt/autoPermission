module.exports = {
  apps: [
    {
      name: 'auto-permission',
      script: './lib/app.js',
      exec_mode: 'cluster',
      instances: 1,
      // watch: true,
      // watch_delay: 1000,
      // ignore_watch: ['node_modules', 'src'],
      env: {
        PORT: 3500,
      },
    },
  ],
};
