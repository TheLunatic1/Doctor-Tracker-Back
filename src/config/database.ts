import mongoose from 'mongoose';

export const connectDB = async (uri?: string): Promise<typeof mongoose> => {
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doctor_tracker';

  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.info(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.info('MongoDB Disconnected');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};
