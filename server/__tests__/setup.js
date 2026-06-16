import jwt from 'jsonwebtoken';

export const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET || 'supersecret');

export const makeToken = (userId, role = 'employee') =>
    signToken({ _id: userId, role });
