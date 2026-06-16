import express from 'express';
import request from 'supertest';
import { verifyToken, verifyIsSameUser } from '../middleware/auth.js';
import { makeToken } from './setup.js';
import mongoose from 'mongoose';

const buildApp = () => {
    const app = express();
    app.use(express.json());

    app.get('/test/:userId', verifyToken, verifyIsSameUser, (req, res) => {
        res.status(200).json({ success: true });
    });

    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({ message: err.message });
    });

    return app;
};

describe('verifyIsSameUser middleware', () => {
    const ownId = new mongoose.Types.ObjectId().toHexString();
    const otherId = new mongoose.Types.ObjectId().toHexString();
    let app;

    beforeAll(() => {
        app = buildApp();
    });

    test('rejects request with no token', async () => {
        const res = await request(app).get(`/test/${ownId}`);
        expect(res.status).toBe(401);
    });

    test('allows owner to access their own profile', async () => {
        const token = makeToken(ownId, 'client');
        const res = await request(app)
            .get(`/test/${ownId}`)
            .set('authtoken', token);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('blocks a regular user from accessing another user profile', async () => {
        const token = makeToken(ownId, 'employee');
        const res = await request(app)
            .get(`/test/${otherId}`)
            .set('authtoken', token);
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/access denied/i);
    });

    test('allows manager to access any profile', async () => {
        const token = makeToken(ownId, 'manager');
        const res = await request(app)
            .get(`/test/${otherId}`)
            .set('authtoken', token);
        expect(res.status).toBe(200);
    });

    test('allows super_admin to access any profile', async () => {
        const token = makeToken(ownId, 'super_admin');
        const res = await request(app)
            .get(`/test/${otherId}`)
            .set('authtoken', token);
        expect(res.status).toBe(200);
    });

    test('rejects an invalid / tampered token', async () => {
        const res = await request(app)
            .get(`/test/${ownId}`)
            .set('authtoken', 'bad.token.here');
        expect(res.status).toBe(401);
    });
});
