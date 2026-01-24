module.exports = {
  apps: [
    // Backend API
    {
      name: 'sgg-backend',
      cwd: '/var/www/sgg-2025/backend',
      script: 'dist/src/main.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/sgg-2025/logs/backend-error.log',
      out_file: '/var/www/sgg-2025/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '500M',
      autorestart: true,
      watch: false,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10
    },

    // Frontend Next.js
    {
      name: 'sgg-frontend',
      cwd: '/var/www/sgg-2025/frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3010',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3010
      },
      error_file: '/var/www/sgg-2025/logs/frontend-error.log',
      out_file: '/var/www/sgg-2025/logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_memory_restart: '800M',
      autorestart: true,
      watch: false,
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10
    }
  ]
};
