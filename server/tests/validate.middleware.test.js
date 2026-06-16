import express from 'express';
import request from 'supertest';
import {
    validateCreateClient,
    validateCreateEmployee,
    validateUpdateUser,
} from '../middleware/validate.js';

const buildApp = (middleware) => {
    const app = express();
    app.use(express.json());
    app.post('/test', middleware, (req, res) => res.status(200).json({ body: req.body }));
    app.put('/test', middleware, (req, res) => res.status(200).json({ body: req.body }));
    app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message }));
    return app;
};

describe('validateCreateClient', () => {
    const app = buildApp(validateCreateClient);

    const validPayload = {
        username: 'johndoe',
        phone: '+15551234567',
    };

    test('accepts a valid minimal payload', async () => {
        const res = await request(app).post('/test').send(validPayload);
        expect(res.status).toBe(200);
    });

    test('accepts a full valid payload', async () => {
        const res = await request(app).post('/test').send({
            ...validPayload,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            city: 'New York',
            CNIC: '12345-1234567-1',
        });
        expect(res.status).toBe(200);
    });

    test('rejects missing username', async () => {
        const res = await request(app).post('/test').send({ phone: '+15551234567' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/username/i);
    });

    test('rejects missing phone', async () => {
        const res = await request(app).post('/test').send({ username: 'johndoe' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('rejects invalid email format', async () => {
        const res = await request(app).post('/test').send({ ...validPayload, email: 'not-an-email' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('rejects invalid phone format', async () => {
        const res = await request(app).post('/test').send({ username: 'johndoe', phone: 'abc' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('strips unknown fields from body', async () => {
        const res = await request(app).post('/test').send({ ...validPayload, isAdmin: true, __proto__: {} });
        expect(res.status).toBe(200);
        expect(res.body.body).not.toHaveProperty('isAdmin');
    });

    test('rejects username shorter than 2 chars', async () => {
        const res = await request(app).post('/test').send({ username: 'a', phone: '+15551234567' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/username/i);
    });
});

describe('validateCreateEmployee', () => {
    const app = buildApp(validateCreateEmployee);

    const validPayload = {
        username: 'emp_jane',
        phone: '+442071234567',
        password: 'Secure123!',
        firstName: 'Jane',
        lastName: 'Smith',
    };

    test('accepts a valid payload', async () => {
        const res = await request(app).post('/test').send(validPayload);
        expect(res.status).toBe(200);
    });

    test('rejects missing firstName', async () => {
        const { firstName, ...rest } = validPayload;
        const res = await request(app).post('/test').send(rest);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/firstName/i);
    });

    test('rejects missing lastName', async () => {
        const { lastName, ...rest } = validPayload;
        const res = await request(app).post('/test').send(rest);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/lastName/i);
    });

    test('rejects missing password', async () => {
        const { password, ...rest } = validPayload;
        const res = await request(app).post('/test').send(rest);
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/password/i);
    });

    test('rejects password shorter than 8 characters', async () => {
        const res = await request(app).post('/test').send({ ...validPayload, password: 'short' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/password/i);
    });

    test('rejects invalid email', async () => {
        const res = await request(app).post('/test').send({ ...validPayload, email: 'bad@@email' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('strips unknown fields', async () => {
        const res = await request(app).post('/test').send({ ...validPayload, role: 'super_admin' });
        expect(res.status).toBe(200);
        expect(res.body.body).not.toHaveProperty('role');
    });
});

describe('validateUpdateUser', () => {
    const app = buildApp(validateUpdateUser);

    test('accepts a single valid field', async () => {
        const res = await request(app).put('/test').send({ city: 'London' });
        expect(res.status).toBe(200);
    });

    test('rejects an empty body', async () => {
        const res = await request(app).put('/test').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least one field/i);
    });

    test('rejects a body with only unknown fields', async () => {
        const res = await request(app).put('/test').send({ role: 'super_admin', uid: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least one field/i);
    });

    test('rejects invalid email in update', async () => {
        const res = await request(app).put('/test').send({ email: 'nope' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('rejects invalid phone in update', async () => {
        const res = await request(app).put('/test').send({ phone: '123' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('strips role and uid even if provided alongside valid fields', async () => {
        const res = await request(app).put('/test').send({ city: 'Paris', role: 'super_admin', uid: 'hack' });
        expect(res.status).toBe(200);
        expect(res.body.body).not.toHaveProperty('role');
        expect(res.body.body).not.toHaveProperty('uid');
        expect(res.body.body.city).toBe('Paris');
    });
});
