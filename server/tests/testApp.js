import express from 'express';
import userRoutes from '../routes/user.js';

const app = express();
app.use(express.json());
app.use('/api/v1/user', userRoutes);

// Global error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: err.message, success: false });
});

export default app;
