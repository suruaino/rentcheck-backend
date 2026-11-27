import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { logger } from './middleware/logger.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import propertyRoutes from './routes/propertyRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import managementRoutes from './routes/managementRoutes.js';

const app = express();

// Add security-related HTTP headers
app.use(helmet());

// Allow requests from the frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
  })
);

// 1. Read JSON bodies into req.body (this has to come before the routes)
app.use(express.json());

// 2. Log every request so we can see what is happening and how long it takes for our endpoint to be called (this has to come before the routes as well)
app.use(logger);

// 3. Health check endpoint is just to check that our server is running. It is not a route that is part of the API, so it is not in the routes folder.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 4. API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api', managementRoutes);

// 5. No route matched (must come after all routes)
app.use(notFound);

// 6. Catch all errors (must be last)
app.use(errorHandler);

export default app;