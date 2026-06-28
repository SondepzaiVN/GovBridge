import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';

const server = createServer(createApp());

server.listen(env.PORT, env.HOST, () => {
  console.log('Gov Bridge backend listening at http://' + env.HOST + ':' + env.PORT);
  console.log('API documentation: backend/README.md');
});

const shutdown = (signal: string): void => {
  console.log(signal + ' received, closing HTTP server...');
  server.close((error) => {
    if (error) {
      console.error('Failed to close server cleanly.', error);
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
