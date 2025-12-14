const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs'); 
const { v4: uuid } = require('uuid'); 
// Import the User model to spy on its methods
const User = require('../models/User'); 

// Shared User Data for Mongoose/Mock tests
const testUser = {
  name: "Test User",
  email: "test@example.com",
  password: "123456"
};

const errorUser = {
  name: "Error User",
  email: "error.test@example.com",
  password: "123456"
};

// Global variable to hold original URI
let originalMongoURI;

beforeAll(async () => {
  jest.setTimeout(20000);
  // Κρατάμε το dropDatabase εδώ, ώστε να ξεκινάμε καθαρά
  await mongoose.connection.db.dropDatabase(); 
});

// --- Mongoose Mode Tests (Original) ---

describe("Auth API (Mongoose Mode)", () => {

  test("Register success", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("token");
  });

    // 1. Unhappy Path: Εγγραφή με ελλιπή δεδομένα (400)
    test("Register failure (missing fields)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: testUser.email }); // λείπει name & password

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", 'name,email,password required');
    });
    
    // 2. Unhappy Path: Εγγραφή χρήστη που υπάρχει ήδη (400)
    test("Register failure (user already exists)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send(testUser); // Χρησιμοποιούμε τον ίδιο χρήστη από το "Register success"

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("message", 'Email exists');
    });

    // 2.1 NEW TEST: Register catch block (Covers Line 22)
    test("2.1 POST /register returns 500 when Mongoose creation fails (Covers Line 22)", async () => {
        // 1. Mock the findOne call to ensure it proceeds past the "user exists" check
        const findOneSpy = jest.spyOn(User, 'findOne');
        // We need to return null for the errorUser email (assuming it's new)
        findOneSpy.mockImplementationOnce(() => Promise.resolve(null)); 
        
        // 2. Mock the create call to throw an error, hitting the catch block
        const createSpy = jest.spyOn(User, 'create');
        createSpy.mockImplementationOnce(() => {
            throw new Error("Mongoose Create Error");
        });
        
        const res = await request(app)
            .post("/api/auth/register")
            .send(errorUser);

        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("error", "Mongoose Create Error");

        // Clean up mocks and restore original functions
        createSpy.mockRestore();
        findOneSpy.mockRestore();
    });

  test("Login success", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

    // 3. Unhappy Path: Λανθασμένος κωδικός (401)
    test("Login failure (wrong password)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: testUser.email,
          password: "wrongpassword" 
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty("message", 'Invalid credentials');
    });
    
    // 3.1 NEW TEST: Login catch block (Covers Line 75)
    test("3.1 POST /login returns 500 when Mongoose find fails (Covers Line 75)", async () => {
        // Mock the findOne call to throw an error, hitting the catch block
        const findOneSpy = jest.spyOn(User, 'findOne');
        findOneSpy.mockImplementationOnce(() => {
            throw new Error("Mongoose Find Error");
        });
        
        const res = await request(app)
            .post("/api/auth/login")
            .send(testUser);

        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("error", "Mongoose Find Error");
        
        // Clean up mock and restore original function
        findOneSpy.mockRestore();
    });
});

// --- MOCK Mode Tests (Covers lines 51-71, 79, 93-104 in authController.js) ---

describe("Auth API (Mock Mode Coverage)", () => {
    
    const mockTestUser = {
        name: "Mock User",
        email: "mock@example.com",
        password: "mockpassword"
    };

    beforeAll(async () => {
        // Αποθήκευση και αφαίρεση του MONGODB_URI για να ενεργοποιηθεί το Mock Mode
        originalMongoURI = process.env.MONGODB_URI;
        delete process.env.MONGODB_URI;

        // Ορισμός του global.MOCK
        const hashedPassword = await bcrypt.hash(mockTestUser.password, 10);
        global.MOCK = {
            users: [{
                userId: uuid(),
                name: mockTestUser.name,
                email: mockTestUser.email,
                passwordHash: hashedPassword,
                role: 'USER'
            }],
            toilets: [], 
            reviews: []
        };
    });

    afterAll(() => {
        // Επαναφορά του περιβάλλοντος
        process.env.MONGODB_URI = originalMongoURI;
        delete global.MOCK;
    });

    // 4. Register success (Mock path) (Covers lines 51-64)
    test("Register success in Mock Mode", async () => {
        const newUser = { name: "New Mock", email: "newmock@test.com", password: "123" };
        const res = await request(app)
            .post("/api/auth/register")
            .send(newUser);

        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty("token");
        // Check if user was added to MOCK array
        expect(global.MOCK.users.length).toBe(2);
    });

    // 5. Register failure (user already exists) (Mock path - Covers lines 54-55)
    test("Register failure (user exists) in Mock Mode", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send(mockTestUser); // mockTestUser exists from beforeAll setup

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message", 'Email exists');
    });

    // 6. Login success (Mock path - Covers lines 79-88)
    test("Login success in Mock Mode", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: mockTestUser.email,
                password: mockTestUser.password
            });

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body.user.email).toBe(mockTestUser.email);
    });

    // 7. Login failure (wrong password) (Mock path - Covers lines 85)
    test("Login failure (wrong password) in Mock Mode", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: mockTestUser.email,
                password: "wrong"
            });

        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty("message", 'Invalid credentials');
    });
    
    // 8. Login failure (user not found) (Mock path - Covers lines 81)
    test("Login failure (user not found) in Mock Mode", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: "nonexistent@test.com",
                password: mockTestUser.password
            });

        expect(res.statusCode).toBe(401);
        expect(res.body).toHaveProperty("message", 'Invalid credentials');
    });

    // 9. Unhappy Path: Login failure (missing fields) (Mock path - Covers line 75)
    test("Login failure (missing fields) in Mock Mode", async () => {
        const res = await request(app)
            .post("/api/auth/login")
            .send({
                email: mockTestUser.email,
                // missing password
            });

        // Ο έλεγχος για 'email,password required' γίνεται στην αρχή του controller
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message", 'email,password required');
    });
});

// --- FINAL FIX FOR MOCK API CHECK COVERAGE (Covers Line 112) ---

describe("Auth API (Mock API Check Coverage - FINAL FIX)", () => {
    let originalMongoURI;
    let originalMOCK;

    // Test for Mock Data unavailability (Covers Line 112)
    test("10. POST /login returns 500 if MOCK data is unavailable (Covers Line 112)", async () => {
        // 1. ISOLATE ENVIRONMENT: Backup originals
        originalMongoURI = process.env.MONGODB_URI;
        originalMOCK = global.MOCK;
        
        // 2. SET UP FAIL CONDITION: Force Mock Mode and break the MOCK global
        // This ensures the code bypasses the Mongoose block and hits the Mock block.
        delete process.env.MONGODB_URI;
        global.MOCK = { users: null }; // Condition: !MOCK || !MOCK.users is true
        
        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: 'any@test.com', password: 'password' }); // Content doesn't matter

        // 3. ASSERTION
        expect(res.statusCode).toBe(500); // Should now correctly hit 500 from Line 112
        expect(res.body).toHaveProperty("error", 'MOCK data not available');

        // 4. TEARDOWN: Restore environment
        process.env.MONGODB_URI = originalMongoURI;
        global.MOCK = originalMOCK; // Restore original MOCK object
    });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
  }
});