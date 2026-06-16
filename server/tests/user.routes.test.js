import request from 'supertest';
import mongoose from 'mongoose';
import app from './testApp.js';
import { makeToken } from './setup.js';

// Mock User model
jest.mock('../models/user.js', () => {
    const store = new Map();

    const mockModel = {
        findById: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        create: jest.fn(),
    };

    return { __esModule: true, default: mockModel, _store: store };
});

import User from '../models/user.js';

// Helpers
const fakeId = () => new mongoose.Types.ObjectId().toHexString();

const makeUser = (overrides = {}) => ({
    _id: overrides._id || fakeId(),
    username: 'testuser',
    phone: '+15550001111',
    email: 'test@example.com',
    role: 'client',
    toHexString: function () { return String(this._id); },
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('GET /api/v1/user/get/single/:userId', () => {
    test('200 owner accesses their own profile', async () => {
        const userId = fakeId();
        const user = makeUser({ _id: userId });
        User.findById.mockResolvedValue(user);

        const res = await request(app)
            .get(`/api/v1/user/get/single/${userId}`)
            .set('authtoken', makeToken(userId, 'client'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    test('403 employee accessing another users profile', async () => {
        const ownerId = fakeId();
        const targetId = fakeId();

        const res = await request(app)
            .get(`/api/v1/user/get/single/${targetId}`)
            .set('authtoken', makeToken(ownerId, 'employee'));

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/access denied/i);
    });

    test('200 manager accesses any user profile', async () => {
        const managerId = fakeId();
        const targetId = fakeId();
        User.findById.mockResolvedValue(makeUser({ _id: targetId }));

        const res = await request(app)
            .get(`/api/v1/user/get/single/${targetId}`)
            .set('authtoken', makeToken(managerId, 'manager'));

        expect(res.status).toBe(200);
    });

    test('200 super_admin accesses any user profile', async () => {
        const adminId = fakeId();
        const targetId = fakeId();
        User.findById.mockResolvedValue(makeUser({ _id: targetId }));

        const res = await request(app)
            .get(`/api/v1/user/get/single/${targetId}`)
            .set('authtoken', makeToken(adminId, 'super_admin'));

        expect(res.status).toBe(200);
    });

    test('401 no token provided', async () => {
        const res = await request(app).get(`/api/v1/user/get/single/${fakeId()}`);
        expect(res.status).toBe(401);
    });

    test('401 user not found in DB', async () => {
        const userId = fakeId();
        User.findById.mockResolvedValue(null);

        const res = await request(app)
            .get(`/api/v1/user/get/single/${userId}`)
            .set('authtoken', makeToken(userId, 'client'));

        expect(res.status).toBe(401);
    });
});

describe('POST /api/v1/user/create/client', () => {
    const empToken = () => makeToken(fakeId(), 'employee');

    const validPayload = { username: 'newclient', phone: '+15559998888', email: 'client@test.com' };

    test('201 creates client with valid data', async () => {
        User.findOne.mockResolvedValue(null);        // no email conflict
        User.create.mockResolvedValue({ ...validPayload, role: 'client', _id: fakeId() });

        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send(validPayload);

        expect(res.status).toBe(200);
        expect(res.body.result.role).toBe('client');
    });

    test('400 missing username', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send({ phone: '+15559998888' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/username/i);
    });

    test('400 missing phone', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send({ username: 'newclient' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('400 invalid email format', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send({ username: 'x', phone: '+15559998888', email: 'bad-email' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('400 invalid phone format', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send({ username: 'x', phone: 'abc' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('400 duplicate email (controller check)', async () => {
        User.findOne.mockResolvedValue(makeUser({ email: 'client@test.com' }));

        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send(validPayload);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });

    test('403 client role cannot create clients', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', makeToken(fakeId(), 'client'))
            .send(validPayload);

        expect(res.status).toBe(403);
    });

    test('strips unknown fields (role not forwarded)', async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockImplementation((data) =>
            Promise.resolve({ ...data, _id: fakeId() })
        );

        const res = await request(app)
            .post('/api/v1/user/create/client')
            .set('authtoken', empToken())
            .send({ ...validPayload, isAdmin: true, role: 'super_admin' });

        expect(res.status).toBe(200);
        expect(res.body.result.role).toBe('client');
        expect(res.body.result).not.toHaveProperty('isAdmin');
    });
});

describe('POST /api/v1/user/create/employee', () => {
    const managerToken = () => makeToken(fakeId(), 'manager');

    const validPayload = {
        username: 'emp_jane',
        phone: '+442079460123',
        password: 'P@ssword123',
        firstName: 'Jane',
        lastName: 'Smith',
    };

    test('200 creates employee, password is hashed', async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockImplementation((data) => Promise.resolve({ ...data, _id: fakeId() }));

        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', managerToken())
            .send(validPayload);

        expect(res.status).toBe(200);
        expect(res.body.result.role).toBe('employee');
        expect(res.body.result.password).not.toBe(validPayload.password);
    });

    test('400 missing firstName', async () => {
        const { firstName, ...rest } = validPayload;
        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', managerToken())
            .send(rest);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/firstName/i);
    });

    test('400 missing lastName', async () => {
        const { lastName, ...rest } = validPayload;
        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', managerToken())
            .send(rest);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/lastName/i);
    });

    test('400 missing password', async () => {
        const { password, ...rest } = validPayload;
        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', managerToken())
            .send(rest);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/password/i);
    });

    test('400 password shorter than 8 chars', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', managerToken())
            .send({ ...validPayload, password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/password/i);
    });

    test('403 employee role cannot create employees', async () => {
        const res = await request(app)
            .post('/api/v1/user/create/employee')
            .set('authtoken', makeToken(fakeId(), 'employee'))
            .send(validPayload);

        expect(res.status).toBe(403);
    });
});

describe('PUT /api/v1/user/update/:userId', () => {
    test('200 owner updates their city', async () => {
        const userId = fakeId();
        const user = makeUser({ _id: userId });
        User.findById.mockResolvedValue(user);
        User.findOne.mockResolvedValue(null);
        User.findByIdAndUpdate.mockResolvedValue({ ...user, city: 'Berlin' });

        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ city: 'Berlin' });

        expect(res.status).toBe(200);
        expect(res.body.result.city).toBe('Berlin');
    });

    test('400 empty body', async () => {
        const userId = fakeId();
        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least one field/i);
    });

    test('400 body contains only disallowed fields (role, uid)', async () => {
        const userId = fakeId();
        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ role: 'super_admin', uid: 'hack' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/at least one field/i);
    });

    test('role escalation is blocked, role not applied even if snuck alongside valid field', async () => {
        const userId = fakeId();
        const user = makeUser({ _id: userId, role: 'client' });
        User.findById.mockResolvedValue(user);
        User.findOne.mockResolvedValue(null);
        User.findByIdAndUpdate.mockResolvedValue({ ...user, city: 'Paris' });

        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ city: 'Paris', role: 'super_admin' });

        expect(res.status).toBe(200);
        expect(res.body.result.role).toBe('client');
    });

    test('403 different user cannot update someone else', async () => {
        const targetId = fakeId();
        const attackerId = fakeId();

        const res = await request(app)
            .put(`/api/v1/user/update/${targetId}`)
            .set('authtoken', makeToken(attackerId, 'employee'))
            .send({ city: 'Tokyo' });

        expect(res.status).toBe(403);
    });

    test('404 non-existent user', async () => {
        const userId = fakeId();
        User.findById.mockResolvedValue(null);

        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'manager'))
            .send({ city: 'Oslo' });

        expect(res.status).toBe(404);
    });

    test('400 invalid phone format', async () => {
        const userId = fakeId();
        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ phone: 'not-a-phone' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('400 duplicate phone conflict', async () => {
        const userId = fakeId();
        const user = makeUser({ _id: userId });
        User.findById.mockResolvedValue(user);
        User.findOne.mockResolvedValue(makeUser({ _id: fakeId(), phone: '+15550002222' }));

        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ phone: '+15550002222' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/phone/i);
    });

    test('400 invalid email format', async () => {
        const userId = fakeId();
        const res = await request(app)
            .put(`/api/v1/user/update/${userId}`)
            .set('authtoken', makeToken(userId, 'client'))
            .send({ email: 'not-valid' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/email/i);
    });
});
