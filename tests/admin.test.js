const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const Toilet = require("../models/Toilet");
const User = require("../models/User");

let userToken;
let adminToken;
let pendingToiletId;

const testUser = {
    name: "Normal User",
    email: "user.admin.test@example.com",
    password: "123456"
};

const adminUser = {
    name: "Admin User",
    email: "admin.admin.test@example.com",
    password: "123456"
};

const PENDING_TOILET_DATA = {
    toiletId: require('uuid').v4(),
    name: "Pending Toilet",
    location: { lat: 40.0, lng: 23.0 },
    isActive: false, // Κρίσιμο: Πρέπει να είναι false
    createdBy: 'u1'
};

beforeAll(async () => {
    jest.setTimeout(30000);

    // 1. Δημιουργία Κανονικού Χρήστη
    await request(app).post("/api/auth/register").send(testUser);
    const userRes = await request(app).post("/api/auth/login").send(testUser);
    userToken = userRes.body.token;

    // 2. Δημιουργία Admin Χρήστη
    const hashedPassword = await require('bcryptjs').hash(adminUser.password, 10);
    await User.create({ ...adminUser, userId: 'a1', role: 'ADMIN', passwordHash: hashedPassword });
    const adminRes = await request(app).post("/api/auth/login").send(adminUser);
    adminToken = adminRes.body.token;

    await mongoose.connection.db.dropDatabase();
});

beforeEach(async () => {
    // Δημιουργία μιας νέας Pending Toilet πριν από κάθε δοκιμή (εκτός του GET list)
    const newToilet = await Toilet.create(PENDING_TOILET_DATA);
    pendingToiletId = newToilet.toiletId;
});

afterEach(async () => {
    // Καθαρισμός των toilets μετά από κάθε test
    await Toilet.deleteMany({});
});


describe("Admin API Access (Unauthorized/Forbidden)", () => {
    const adminRoutes = [
        { method: 'get', path: '/pending' },
        { method: 'put', path: `/approve/${PENDING_TOILET_DATA.toiletId}` },
        { method: 'put', path: `/reject/${PENDING_TOILET_DATA.toiletId}` },
    ];

    test.each(adminRoutes)('Unauthorized access (401) without token to $method $path', async ({ method, path }) => {
        const res = await request(app)[method](`/api/admin${path}`);
        expect(res.statusCode).toBe(401);
    });
    
    test.each(adminRoutes)('Forbidden access (403) with regular user token to $method $path', async ({ method, path }) => {
        const res = await request(app)[method](`/api/admin${path}`)
            .set('Authorization', `Bearer ${userToken}`);
        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty('message', 'Admins only');
    });
});

describe("Admin API (Success Cases)", () => {
    
    // 1. GET /pending
    test("GET /pending returns list of pending toilets (200)", async () => {
        const res = await request(app)
            .get("/api/admin/pending")
            .set('Authorization', `Bearer ${adminToken}`);
            
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.some(t => t.toiletId === pendingToiletId)).toBe(true);
    });

    // 2. PUT /approve/:id
    test("PUT /approve/:id approves toilet successfully (200)", async () => {
        const res = await request(app)
            .put(`/api/admin/approve/${pendingToiletId}`)
            .set('Authorization', `Bearer ${adminToken}`);
            
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message', 'Approved');
        
        // Επιβεβαίωση στη βάση
        const approved = await Toilet.findOne({ toiletId: pendingToiletId });
        expect(approved.isActive).toBe(true);
    });

    // 3. PUT /reject/:id (Εκτός αν έχει ήδη γίνει approve, ξανακάνουμε reject)
    test("PUT /reject/:id rejects toilet successfully (200)", async () => {
        // Επαναφέρουμε την τουαλέτα ως pending (για να ελέγξουμε το reject)
        await Toilet.updateOne({ toiletId: pendingToiletId }, { isActive: true }); 
        
        const res = await request(app)
            .put(`/api/admin/reject/${pendingToiletId}`)
            .set('Authorization', `Bearer ${adminToken}`);
            
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty('message', 'Rejected');

        // Επιβεβαίωση στη βάση
        const rejected = await Toilet.findOne({ toiletId: pendingToiletId });
        expect(rejected.isActive).toBe(false);
    });
});