module.exports = {
  apps: [
    {
      name: "luevora-prod-backend",
      cwd: "/home/ubuntu/luevora-project/prod/luevora-production/luevora-prod/server",
      script: "index.js",
      interpreter: "/home/ubuntu/.nvm/versions/node/v22.23.2/bin/node",
      node_args: "--max-old-space-size=512",
      max_memory_restart: "450M",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 4001
      }
    },
    {
      name: "luevora-prod-frontend",
      cwd: "/home/ubuntu/luevora-project/prod/luevora-production/luevora-prod/dashboard",
      script: "node_modules/vite/bin/vite.js",
      interpreter: "/home/ubuntu/.nvm/versions/node/v22.23.2/bin/node",
      node_args: "--max-old-space-size=384",
      max_memory_restart: "350M",
      args: "--host 0.0.0.0 --port 5174",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
