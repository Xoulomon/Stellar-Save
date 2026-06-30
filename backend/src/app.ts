import express from 'express';
import cors, { CorsOptions } from 'cors';
import { config } from './config';

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const app = express();
app.use(cors(corsOptions));

export { app, corsOptions };
