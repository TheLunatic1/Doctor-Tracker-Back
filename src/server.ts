import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB, disconnectDB } from './config/database.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    const shutdown = async (signal: string) => {
      console.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await disconnectDB();
        console.info('Server and Database connections closed. Process terminating.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
