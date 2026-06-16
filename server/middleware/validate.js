import { createError } from '../utils/error.js';

const pick = (obj, keys) =>
    keys.reduce((acc, k) => {
        if (k in obj) acc[k] = obj[k];
        return acc;
    }, {});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

const collectErrors = (rules, body) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
        const value = body[field];
        const present = value !== undefined && value !== null && value !== '';

        if (rule.required && !present) {
            errors.push(`${field} is required`);
            continue;
        }

        if (!present) continue;

        const str = String(value).trim();

        if (rule.type === 'string') {
            if (rule.minLength && str.length < rule.minLength)
                errors.push(`${field} must be at least ${rule.minLength} characters`);
            if (rule.maxLength && str.length > rule.maxLength)
                errors.push(`${field} must be at most ${rule.maxLength} characters`);
        }

        if (rule.isEmail && !EMAIL_RE.test(str))
            errors.push(`${field} must be a valid email address`);

        if (rule.isPhone && !PHONE_RE.test(str))
            errors.push(`${field} must be a valid phone number (7-15 digits, optional leading +)`);
    }

    return errors;
};

export const validateCreateClient = (req, res, next) => {
    const rules = {
        username: { required: true,  type: 'string', minLength: 2, maxLength: 50 },
        phone: { required: true,  type: 'string', isPhone: true },
        firstName: { required: false, type: 'string', minLength: 2, maxLength: 50 },
        lastName: { required: false, type: 'string', minLength: 2, maxLength: 50 },
        email: { required: false, isEmail: true },
        city: { required: false, type: 'string', maxLength: 100 },
        CNIC: { required: false, type: 'string', maxLength: 20 },
    };

    const errors = collectErrors(rules, req.body);
    if (errors.length) return next(createError(400, errors.join('; ')));

    req.body = pick(req.body, Object.keys(rules));
    next();
};

export const validateCreateEmployee = (req, res, next) => {
    const rules = {
        username: { required: true,  type: 'string', minLength: 2,  maxLength: 50 },
        phone: { required: true,  type: 'string', isPhone: true },
        password: { required: true,  type: 'string', minLength: 8,  maxLength: 128 },
        firstName: { required: true,  type: 'string', minLength: 2,  maxLength: 50 },
        lastName: { required: true,  type: 'string', minLength: 2,  maxLength: 50 },
        email: { required: false, isEmail: true },
        city: { required: false, type: 'string', maxLength: 100 },
        CNIC: { required: false, type: 'string', maxLength: 20 },
    };

    const errors = collectErrors(rules, req.body);
    if (errors.length) return next(createError(400, errors.join('; ')));

    req.body = pick(req.body, Object.keys(rules));
    next();
};

export const validateUpdateUser = (req, res, next) => {
    const rules = {
        username: { required: false, type: 'string', minLength: 2,  maxLength: 50 },
        phone: { required: false, type: 'string', isPhone: true },
        firstName: { required: false, type: 'string', minLength: 2,  maxLength: 50 },
        lastName: { required: false, type: 'string', minLength: 2,  maxLength: 50 },
        email: { required: false, isEmail: true },
        city: { required: false, type: 'string', maxLength: 100 },
        CNIC: { required: false, type: 'string', maxLength: 20 },
    };

    const errors = collectErrors(rules, req.body);
    if (errors.length) return next(createError(400, errors.join('; ')));

    const allowed = pick(req.body, Object.keys(rules));
    if (!Object.keys(allowed).length)
        return next(createError(400, 'At least one field must be provided for update'));

    req.body = allowed;
    next();
};
