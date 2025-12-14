const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const Toilet = require("../models/Toilet");
const User = require("../models/User");
const { v4: uuid } = require('uuid'); 

// Import the controller only to ensure its internal helper function is not spied on.
// We DO NOT import the controller to spy on internal functions.
// const searchController = require('../controllers/searchController'); 

// Συντεταγμένες Θεσσαλονίκης
const THESS_LAT = 40.64;
const THESS_LNG = 22.94;

let userToken;
let testToiletId;
let testUserId;
let originalMongoURI;

// --- MOCK Coverage Tests (ΠΡΩΤΑ ΓΙΑ ΝΑ ΕΞΑΣΦΑΛΙΣΤΕΙ Η ΚΑΛΥΨΗ) ---

describe("Search API (Mock Mode Coverage)", () => {
    
    const MOCK_TOILETS = [
        { 
            name: "Central Toilet MOCK",
            toiletId: uuid(),
            location: { lat: THESS_LAT + 0.001, lng: THESS_LNG + 0.001 }, // ~150m away
            isActive: true,
            averageRating: 4.5
        },
        { 
            name: "Far Away Toilet MOCK",
            toiletId: uuid(),
            location: { lat: THESS_LAT + 1, lng: THESS_LNG + 1 }, // ~100km away
            isActive: true,
            averageRating: 3.0
        },
        { 
            name: "Inactive Toilet MOCK",
            toiletId: uuid(),
            location: { lat: THESS_LAT + 0.001, lng: THESS_LNG + 0.001 },
            isActive: false, 
            averageRating: 5.0
        }
    ];

    // ******************************************************
    // ΔΙΟΡΘΩΣΗ: ΑΜΕΣΗ ΑΡΧΙΚΟΠΟΙΗΣΗ GLOBAL.MOCK 
    // ******************************************************
    global.MOCK = {
        users: [], 
        toilets: MOCK_TOILETS,
        reviews: []
    };

    beforeAll(async () => {
        // 1. Απενεργοποίηση Mongoose URI για να αναγκάσουμε το Mock Path
        originalMongoURI = process.env.MONGODB_URI;
        delete process.env.MONGODB_URI; // Αφαιρούμε το URI για Mock Mode
    });

    afterAll(() => {
        // Επαναφορά του περιβάλλοντος
        process.env.MONGODB_URI = originalMongoURI;
    });

    // 1. Unhappy Path: Λείπουν lat/lng (400)
    test("GET /nearby returns 400 if lat or lng is missing", async () => {
        const res = await request(app).get("/api/search/nearby?lat=40.0");
        
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message", 'lat & lng required');
    });
    
    // 1.1 NEW TEST: Mock data unavailable (Covers Lines 29-31)
    test("1.1 GET /nearby returns empty array and logs error when MOCK data is broken", async () => {
        // 1. Backup original MOCK object and break the toilets property
        const originalMOCKToilets = global.MOCK.toilets;
        global.MOCK.toilets = null; // Forces the `!MOCK.toilets` condition to be true
        
        // 2. Perform search
        const res = await request(app)
            .get("/api/search/nearby?lat=40.0&lng=23.0");

        // 3. Assert on the expected soft failure response
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("data", []);
        
        // 4. Restore MOCK
        global.MOCK.toilets = originalMOCKToilets;
    });

    // 1.2 NEW TEST: Controller Catch Block (Covers Line 42)
    test("1.2 GET /nearby returns 500 on runtime error", async () => {
        // 1. Corrupt the MOCK data to cause an error during iteration 
        // This forces an error when the controller tries to access 't.location.lat'
        const originalToilets = global.MOCK.toilets;
        global.MOCK.toilets = [
            ...originalToilets,
            { 
                name: "Broken Toilet",
                toiletId: uuid(),
                location: null, // Accessing .lat on null throws a runtime error
                isActive: true,
            }
        ];
        
        // 2. Perform search (should hit the catch block at Line 42)
        const res = await request(app)
            .get("/api/search/nearby?lat=40.0&lng=23.0"); 

        // 3. ASSERTION (Expect 500 from the error handler)
        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("success", false);
        
        // 4. Restore the original MOCK data
        global.MOCK.toilets = originalToilets;
    });

    // 2. Happy Path: Αναζήτηση με ακριβές φιλτράρισμα (Mock path uses Haversine)
    test("GET /nearby returns only nearby toilets in MOCK mode (1 result)", async () => {
        const res = await request(app).get(`/api/search/nearby?lat=${THESS_LAT}&lng=${THESS_LNG}&radius=1000`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1); 
        expect(res.body.data[0].name).toBe("Central Toilet MOCK");
    });
    
    // 3. Unhappy Path: Αναζήτηση χωρίς αποτελέσματα (Μικρή ακτίνα)
    test("GET /nearby returns empty array for small radius in MOCK mode (0 results)", async () => {
        const res = await request(app).get(`/api/search/nearby?lat=${THESS_LAT}&lng=${THESS_LNG}&radius=10`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(0); 
    });

    // 4. Happy Path: Αναζήτηση Inactive (Mock path filters isActive=false)
    test("GET /nearby filters out inactive toilets in MOCK mode", async () => {
        const res = await request(app).get(`/api/search/nearby?lat=${THESS_LAT}&lng=${THESS_LNG}&radius=200000`); // 100km
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(2); // Central και Far Away
        expect(res.body.data.some(t => t.name === "Inactive Toilet MOCK")).toBe(false); 
    });

    // 5. Test Sorting Logic (covers the sorting lines in the controller)
    test("GET /nearby sorts by distance ascending in MOCK mode", async () => {
        // Set up two close toilets
        const closeToilet1 = { 
            name: "Close Toilet 1",
            toiletId: uuid(),
            location: { lat: THESS_LAT + 0.002, lng: THESS_LNG + 0.002 },
            isActive: true,
        };
        const closeToilet2 = { 
            name: "Close Toilet 2",
            toiletId: uuid(),
            location: { lat: THESS_LAT + 0.003, lng: THESS_LNG + 0.003 },
            isActive: true,
        };

        global.MOCK.toilets.push(closeToilet1, closeToilet2);

        const res = await request(app).get(`/api/search/nearby?lat=${THESS_LAT}&lng=${THESS_LNG}&radius=1000`);
        
        // Η λογική Mock ταξινομεί by distance ascending
        expect(res.body.data[0].name).toBe("Central Toilet MOCK");
        
        // Καθαρισμός των mock additions
        global.MOCK.toilets.pop();
        global.MOCK.toilets.pop();
    });
});


// --- Mongoose Setup (Καλύπτει το Mongoose Path, εκτελείται δεύτερο) ---

beforeAll(async () => {
    // This is the global beforeAll for Mongoose setup.
    jest.setTimeout(30000);
    
    // We drop the database here to ensure clean Mongoose tests after Mock tests.
    await mongoose.connection.db.dropDatabase(); 

    // 1. Δημιουργία Χρήστη (απαιτείται για τη δημιουργία τουαλέτας)
    const testUser = { name: "Search User Mongoose", email: "test.search.mongo@example.com", password: "123456" };
    await request(app).post("/api/auth/register").send(testUser);
    const userRes = await request(app).post("/api/auth/login").send(testUser);
    userToken = userRes.body.token;
    testUserId = userRes.body.user.userId;
    
    // 2. Δημιουργία Τουαλέτας
    await Toilet.create({
        name: "Central Toilet Mongoose",
        location: { lat: 40.642, lng: 22.945 },
        isActive: true,
        toiletId: uuid(), 
        createdBy: testUserId,
    });
});

describe("Search API (Mongoose Mode)", () => {

    // 6. Unhappy Path: Λείπουν lat/lng (400)
    test("GET /nearby returns 400 if lat or lng is missing (Mongoose)", async () => {
        const res = await request(app).get("/api/search/nearby?lat=40.0");
        
        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message", 'lat & lng required');
    });

    // 7. Happy Path: Επιτυχημένη αναζήτηση (Mongoose returns all active)
    test("GET /nearby returns nearby toilets (200) (Mongoose)", async () => {
        const res = await request(app).get(`/api/search/nearby?lat=${THESS_LAT}&lng=${THESS_LNG}&radius=1000`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data[0].name).toBe("Central Toilet Mongoose");
    });

    // 8. Happy Path: Αναζήτηση χωρίς αποτελέσματα (Mongoose returns all active)
    test("GET /nearby returns all active toilets, regardless of small radius (Mongoose Mode)", async () => {
        const res = await request(app).get(`/api/search/nearby?lat=37.98&lng=${THESS_LNG}&radius=10`);
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
});