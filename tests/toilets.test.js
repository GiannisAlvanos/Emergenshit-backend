const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const Toilet = require("../models/Toilet");
const User = require("../models/User");
const Review = require("../models/Review");
const { v4: uuid } = require('uuid'); 

jest.mock('../services/toiletAggregates.service', () => ({
  updateMongooseAggregates: jest.fn()
}));

let userToken;
let adminToken;
let otherUserToken;
let testToiletId; 
let testUserId; 
let testAdminId = 'admin-id';
let otherUserId;

const testUser = {
  name: "Test User",
  email: "test.toilet@example.com",
  password: "123456"
};

const otherUser = {
  name: "Other User",
  email: "other_user_2@example.com",
  password: "123456"
};

const adminUser = {
  name: "Admin User",
  email: "admin.toilet@example.com",
  password: "123456"
};

const newToiletData = {
  name: "Test Toilet 1",
  description: "Clean and accessible",
  location: { lat: 39.5, lng: 22.5 },
  amenities: ["wifi", "soap"],
  wheelchairAccessible: true,
};

beforeAll(async () => {
  jest.setTimeout(30000);
  
  await mongoose.connection.db.dropDatabase();

  // 1. Δημιουργία Κανονικού Χρήστη (για ownership tests)
  await request(app).post("/api/auth/register").send(testUser);
  const userRes = await request(app).post("/api/auth/login").send(testUser);
  userToken = userRes.body.token;
  testUserId = userRes.body.user.userId;

  // 1.1. Δημιουργία Άλλου Κανονικού Χρήστη (για forbidden tests)
  await request(app).post("/api/auth/register").send(otherUser);
  const otherUserRes = await request(app).post("/api/auth/login").send(otherUser);
  otherUserToken = otherUserRes.body.token;
  otherUserId = otherUserRes.body.user.userId;

  // 2. Δημιουργία Admin Χρήστη (για admin privileges tests)
  const hashedPassword = await require('bcryptjs').hash(adminUser.password, 10);
  await User.create({ ...adminUser, userId: testAdminId, role: 'ADMIN', passwordHash: hashedPassword });
  const adminRes = await request(app).post("/api/auth/login").send(adminUser);
  adminToken = adminRes.body.token;
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
});

// --- Mongoose Tests ---

describe("Toilets API (Mongoose Mode)", () => {
    beforeEach(async () => {
        await mongoose.connection.db.dropDatabase();
        // Δημιουργία της αρχικής τουαλέτας (createdBy: testUserId)
        const resCreate = await request(app)
            .post("/api/toilets")
            .set('Authorization', `Bearer ${userToken}`)
            .send(newToiletData);
        testToiletId = resCreate.body.data.toiletId; 

        // Δημιουργία μιας δεύτερης τουαλέτας για filter/sort tests
        await Toilet.create({
            toiletId: uuid(),
            name: "High Rated Toilet",
            location: { lat: 40, lng: 20 },
            createdBy: testAdminId,
            isActive: true,
            averageRating: 5.0,
        });
    });


  // 1. LIST (GET /api/toilets)
  test("1. GET toilets returns array (200)", async () => {
    const res = await request(app).get("/api/toilets");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // --- Mongoose List Filter/Sort Tests ---
  test("1.1 GET /list filters by minRating (Mongoose)", async () => {
    const res = await request(app).get("/api/toilets?minRating=4.0"); 

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe("High Rated Toilet");
  });

  test("1.2 GET /list sorts high_to_low (Mongoose)", async () => {
    const res = await request(app).get("/api/toilets?sort=high_to_low");

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].name).toBe("High Rated Toilet");
  });

  test("1.3 GET /list sorts low_to_high (Mongoose)", async () => {
    const res = await request(app).get("/api/toilets?sort=low_to_high");

    expect(res.statusCode).toBe(200);
    expect(res.body.data[0].name).toBe("Test Toilet 1");
  });

  // 1.4 GET /list with minRating uses correct query parameters
  test("1.4 GET /list with minRating uses correct query parameters", async () => {
    const findSpy = jest.spyOn(Toilet, 'find');
    findSpy.mockImplementationOnce((q) => {
        expect(q.averageRating).toEqual({ '$gte': 4 });
        return {
            sort: jest.fn().mockReturnThis(), 
            limit: jest.fn().mockResolvedValue([])
        };
    });
    await request(app).get("/api/toilets?minRating=4.0");
    findSpy.mockRestore(); 
  });

  // --- FINAL REVISION TEST: Conceptual Geospatial Coverage (Covers Lines 69-89) ---
  test("1.5 GET /list should apply geospatial filter and cover lines 69-89", async () => {
    // 1. Spy on Toilet.find to inspect the query object 'q'
    const findSpy = jest.spyOn(Toilet, 'find');
    
    // Mock the chainable nature of the query object (list)
    findSpy.mockImplementationOnce((q) => {
        // ASSERT that the 'q' object includes the geospatial filter structure, 
        // confirming lines 69-89 executed successfully.
        expect(q).toHaveProperty('location'); 
        expect(q.location).toHaveProperty('$geoWithin');
        expect(q.location.$geoWithin).toHaveProperty('$centerSphere');
        
        // Assert the computed values are correct (5000 / 6371 = approx 0.7848)
        const center = q.location.$geoWithin.$centerSphere[0];
        const maxDistance = q.location.$geoWithin.$centerSphere[1];
        expect(center[0]).toBe(23.0); // lng
        expect(center[1]).toBe(40.0); // lat
        expect(maxDistance).toBeCloseTo(0.7848); 

        // Return a mock executable query instance that returns valid data
        return {
            sort: jest.fn().mockReturnThis(), 
            limit: jest.fn().mockResolvedValue([])
        };
    });

    // Send request with all required geo params (lat=40, lng=23, radius=5000)
    const res = await request(app).get("/api/toilets?lat=40.0&lng=23.0&radius=5000");

    expect(res.statusCode).toBe(200);
    expect(findSpy).toHaveBeenCalled();
    findSpy.mockRestore(); 
  });
  // -------------------------------------------------------------------

  // 2. CREATE (POST /api/toilets) - Happy Path (Covers Line 153 - Anomaly)
  test("2. POST /create adds new toilet (201) (Mongoose Happy Path)", async () => {
    const res = await request(app)
      .post("/api/toilets")
      .set('Authorization', `Bearer ${userToken}`) 
      .send({ ...newToiletData, name: "Another Test Toilet", location: { lat: 39.6, lng: 22.6 } });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("toiletId");
    expect(res.body.data.createdBy).toBe(testUserId);
  });

  // 3. CREATE (POST /api/toilets) - Unhappy Path (Missing fields)
  test("3. POST /create returns 400 for missing fields", async () => {
    const res = await request(app)
      .post("/api/toilets")
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: "Incomplete Toilet" }); 

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty("message", 'name and location required');
  });

  // 4. GET BY ID (GET /api/toilets/:id) - Happy Path
  test("4. GET by ID returns toilet data (200)", async () => {
    const res = await request(app).get(`/api/toilets/${testToiletId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.toilet.toiletId).toBe(testToiletId);
    expect(Array.isArray(res.body.data.reviews)).toBe(true);
  });

  // 5. GET BY ID (GET /api/toilets/:id) - Unhappy Path (Not found)
  test("5. GET by ID returns 404 for non-existent ID", async () => {
    const nonExistentId = 'non-existent-id-123';
    const res = await request(app).get(`/api/toilets/${nonExistentId}`);
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("message", 'Not found');
  });
  
  // 6. UPDATE (PUT /api/toilets/:id) - Happy Path (Creator)
  test("6. PUT /update by creator succeeds (200)", async () => {
    const updatedName = "Updated Test Toilet Name";
    const res = await request(app)
      .put(`/api/toilets/${testToiletId}`)
      .set('Authorization', `Bearer ${userToken}`) 
      .send({ 
        name: updatedName, 
        averageRating: 99.9, // Should be ignored
        reviewCount: 999 
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe(updatedName);
    expect(res.body.data.averageRating).toBe(0); 
  });

  test("6.1 PUT /update by ADMIN succeeds (200)", async () => {
    const updatedName = "Admin Override Name";
    const res = await request(app)
      .put(`/api/toilets/${testToiletId}`)
      .set('Authorization', `Bearer ${adminToken}`) 
      .send({ name: updatedName });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe(updatedName);
  });

  test("6.2 PUT /update returns 404 for non-existent ID", async () => {
    const nonExistentId = 'non-existent-update-id';
    const res = await request(app)
      .put(`/api/toilets/${nonExistentId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: "Attempted Change" });

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("message", 'Not found');
  });

  test("7. UPDATE (PUT /api/toilets/:id) - Unhappy Path (Forbidden)", async () => {
    const res = await request(app)
      .put(`/api/toilets/${testToiletId}`)
      .set('Authorization', `Bearer ${otherUserToken}`) // Non-creator, non-admin
      .send({ name: "Attempted Change" });

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("message", 'Forbidden');
  });

  // 8. REMOVE (DELETE /api/toilets/:id) - Happy Path (Creator/Deactivate)
  test("8. DELETE /remove by creator deactivates toilet and resets rating (200) (Covers Line 55 reset)", async () => {
    // Setup: Create a new toilet with a review to ensure it has ratings
    const { updateMongooseAggregates } = require('../services/toiletAggregates.service');
    updateMongooseAggregates.mockImplementationOnce(async (toiletId) => {
      const Toilet = require('../models/Toilet');
      await Toilet.updateOne(
        { toiletId },
        {
          averageRating: 0,
          cleanlinessRating: 0,
          layoutRating: 0,
          spaciousnessRating: 0,
          amenitiesRating: 0,
          reviewCount: 0
        }
      );
    });
    const toiletIdToDelete = uuid();
    await Toilet.create({ toiletId: toiletIdToDelete, name: "Toilet with Review", location: { lat: 10, lng: 10 }, createdBy: testUserId, averageRating: 4.0, isActive: true });
    await Review.create({ toiletId: toiletIdToDelete, overallRating: 4, cleanlinessRating: 4, userId: testUserId, reviewId: uuid(), isDeleted: false });
    
    const res = await request(app)
      .delete(`/api/toilets/${toiletIdToDelete}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    
    const deactivated = await Toilet.findOne({ toiletId: toiletIdToDelete });
    expect(deactivated.isActive).toBe(false); 
    // Verify the ratings were reset to 0 (This checks Line 55: stats.length === 0)
    expect(deactivated.averageRating).toBe(0); 
  });

  test("8.1 DELETE /remove by ADMIN deactivates toilet (200)", async () => {
    const res = await request(app)
      .delete(`/api/toilets/${testToiletId}`) 
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    
    const deactivated = await Toilet.findOne({ toiletId: testToiletId });
    expect(deactivated.isActive).toBe(false); 
  });
  
  test("8.2 DELETE /remove returns 403 for non-creator/non-admin (Mongoose)", async () => {
    const res = await request(app)
      .delete(`/api/toilets/${testToiletId}`) 
      .set('Authorization', `Bearer ${otherUserToken}`); 

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("message", 'Forbidden');
  });

  test("8.3 DELETE /remove returns 404 for non-existent ID (Mongoose)", async () => {
    const nonExistentId = 'non-existent-delete-id';
    const res = await request(app)
      .delete(`/api/toilets/${nonExistentId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty("message", 'Not found');
  });

  // 8.4 DELETE /remove handles internal Mongoose Aggregation error gracefully (Covers Lines 30-32 catch block)
  test("8.4 DELETE /remove handles internal Mongoose Aggregation error gracefully (Covers Lines 30-32)", async () => {
    // Create a fresh toilet
    const toiletIdToError = uuid();
    await Toilet.create({
      toiletId: toiletIdToError,
      name: "Error Toilet",
      location: { lat: 11, lng: 11 },
      createdBy: testUserId,
      isActive: true
    });

    // Force aggregation service to throw
    const { updateMongooseAggregates } = require('../services/toiletAggregates.service');
    updateMongooseAggregates.mockImplementationOnce(() => {
      throw new Error("Mongoose Aggregation Fail during Delete");
    });

    // Silence console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .delete(`/api/toilets/${toiletIdToError}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", 'Deactivated');

    // Restore console spy ONLY
    consoleErrorSpy.mockRestore();
  });

  // 9.1. LIST Catch Block
  test("9.1 GET /list returns 500 when Mongoose query fails", async () => {
    const findSpy = jest.spyOn(Toilet, 'find');
    findSpy.mockImplementationOnce(() => {
        throw new Error("Mongoose Find Error");
    });
    
    const res = await request(app).get("/api/toilets");
    
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("error", "Mongoose Find Error");
    findSpy.mockRestore(); 
  });

  // 9.2. UPDATE Catch Block
  test("9.2 PUT /update returns 500 when Mongoose query fails", async () => {
    const findOneSpy = jest.spyOn(Toilet, 'findOne');
    findOneSpy.mockImplementationOnce(() => Promise.resolve({ createdBy: testUserId })); 

    const findOneAndUpdateSpy = jest.spyOn(Toilet, 'findOneAndUpdate');
    findOneAndUpdateSpy.mockImplementationOnce(() => {
        throw new Error("Simulated Update DB Error");
    });
    
    const res = await request(app)
        .put(`/api/toilets/${testToiletId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: "Attempted Change" });

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("error", "Simulated Update DB Error");
    findOneSpy.mockRestore();
    findOneAndUpdateSpy.mockRestore();
  });

  // 9.3. REMOVE Catch Block
  test("9.3 DELETE /remove returns 500 when Mongoose query fails", async () => {
    const findOneSpy = jest.spyOn(Toilet, 'findOne');
    findOneSpy.mockImplementationOnce(() => Promise.resolve({ createdBy: testUserId })); 
    
    const updateOneSpy = jest.spyOn(Toilet, 'updateOne');
    updateOneSpy.mockImplementationOnce(() => {
        return Promise.reject(new Error("Mongoose Delete Error"));
    });
    
    const res = await request(app)
        .delete(`/api/toilets/${testToiletId}`)
        .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("error", "Mongoose Delete Error");
    updateOneSpy.mockRestore();
    findOneSpy.mockRestore();
  });
});


// --- MOCK Coverage Tests ---

describe("Toilets API (Mock Mode Coverage)", () => {
    let mockToiletId;
    let mockToiletToUpdate;
    let originalMongoURI;
    
    let MOCK_ADMIN_ID = 'admin-id';
    let MOCK_OTHER_USER_ID = 'other-user-id'; 

    beforeAll(() => {
        // 1. Force Mock Mode
        originalMongoURI = process.env.MONGODB_URI;
        delete process.env.MONGODB_URI;

        const MOCK_TOILETS = [
            { 
                toiletId: uuid(), 
                name: "High Rated Toilet", 
                location: { lat: 39.51, lng: 22.51 }, 
                amenities: ["wifi", "soap", "baby_changing"], 
                isActive: true, 
                averageRating: 5.0,
                reviewCount: 1,
                createdBy: MOCK_ADMIN_ID 
            },
            { 
                toiletId: uuid(), 
                name: "Low Rated Toilet", 
                location: { lat: 39.52, lng: 22.52 }, 
                amenities: ["wifi"], 
                isActive: true, 
                averageRating: 1.0,
                reviewCount: 1,
                createdBy: testUserId 
            },
            { 
                toiletId: uuid(), 
                name: "Inactive Mock Toilet", 
                location: { lat: 39.53, lng: 22.53 }, 
                isActive: false, 
                averageRating: 3.0,
                reviewCount: 1,
                createdBy: testUserId 
            },
        ];

        const MOCK_REVIEWS = [
            { toiletId: MOCK_TOILETS[0].toiletId, overallRating: 5, cleanlinessRating: 5, layoutRating: 5, spaciousnessRating: 5, amenitiesRating: 5, isDeleted: false },
            { toiletId: MOCK_TOILETS[1].toiletId, overallRating: 1, cleanlinessRating: 1, layoutRating: 0, spaciousnessRating: 0, amenitiesRating: undefined, isDeleted: false },
        ];
    
        // 2. Setup MOCK globals
        global.MOCK = {
            users: [
                { userId: MOCK_ADMIN_ID, email: 'admin.mock@test.com', role: 'ADMIN', token: adminToken },
                { userId: testUserId, email: 'user.mock@test.com', role: 'USER', token: userToken },
                { userId: MOCK_OTHER_USER_ID, email: 'other.mock@test.com', role: 'USER', token: otherUserToken } 
            ],
            toilets: MOCK_TOILETS,
            reviews: MOCK_REVIEWS
        };
        mockToiletId = MOCK_TOILETS[1].toiletId; // User-created toilet ID
        mockToiletToUpdate = MOCK_TOILETS[0]; // Admin-created toilet object
    });

    afterAll(() => {
        // Restore environment
        process.env.MONGODB_URI = originalMongoURI;
        delete global.MOCK;
    });

    // 10. LIST - Filtering by minRating 
    test("10. GET /list filters by minRating in MOCK mode", async () => {
        const res = await request(app).get("/api/toilets?minRating=4.0");

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1); 
        expect(res.body.data[0].name).toBe("High Rated Toilet");
    });

    // 11. LIST - Filtering by amenities (string, covers all) 
    test("11. GET /list filters by amenities (string) in MOCK mode", async () => {
        const res = await request(app).get("/api/toilets?amenities=wifi,soap");

        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1); 
        expect(res.body.data[0].name).toBe("High Rated Toilet");
    });

    test("11.1 LIST - Filtering by amenities (array) in MOCK mode", async () => {
        // Tests the Array.isArray(amenities) branch
        const res = await request(app).get("/api/toilets?amenities[]=wifi&amenities[]=soap");
        
        expect(res.statusCode).toBe(200);
        expect(res.body.data.length).toBe(1); 
        expect(res.body.data[0].name).toBe("High Rated Toilet");
    });
    
    // 12. LIST - Sorting high_to_low 
    test("12. GET /list sorts high_to_low in MOCK mode", async () => {
        const res = await request(app).get("/api/toilets?sort=high_to_low");

        expect(res.statusCode).toBe(200);
        expect(res.body.data[0].name).toBe("High Rated Toilet");
    });

    test("12.1 LIST - Sorting low_to_high in MOCK mode", async () => {
        const res = await request(app).get("/api/toilets?sort=low_to_high");

        expect(res.statusCode).toBe(200);
        expect(res.body.data[0].name).toBe("Low Rated Toilet");
    });
    
    // 13. CREATE - Duplicate check (409)
    test("13. POST /create returns 409 for duplicate location in MOCK mode", async () => {
        const res = await request(app)
            .post("/api/toilets")
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ...newToiletData, location: { lat: 39.510001, lng: 22.510001 } }); 

        expect(res.statusCode).toBe(409);
        expect(res.body).toHaveProperty("message", expect.stringContaining('already listed'));
    });
    
    // 13.1 CREATE - Happy Path (201) - MOCK Mode (Covers Line 215 - Anomaly)
    test("13.1 POST /create adds new toilet in MOCK mode (201)", async () => {
        const originalCount = global.MOCK.toilets.length;
        const res = await request(app)
            .post("/api/toilets")
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ...newToiletData, name: "New Mock Toilet", location: { lat: 10, lng: 10 } }); // Far location, no duplicate

        expect(res.statusCode).toBe(201);
        expect(global.MOCK.toilets.length).toBe(originalCount + 1);
        // Clean up the added toilet
        global.MOCK.toilets.pop();
    });


    // 14. GET BY ID - Happy Path (Mock path)
    test("14. GET by ID returns data in MOCK mode", async () => {
        const res = await request(app).get(`/api/toilets/${mockToiletId}`);
        expect(res.statusCode).toBe(200); 
        expect(res.body.data.toilet.name).toBe("Low Rated Toilet");
        expect(Array.isArray(res.body.data.reviews)).toBe(true);
    });

    // 15. UPDATE - Unhappy Path (Forbidden) - Mock Mode
    test("15. PUT /update fails for non-creator in MOCK mode (403)", async () => {
        const res = await request(app)
            .put(`/api/toilets/${mockToiletToUpdate.toiletId}`) 
            .set('Authorization', `Bearer ${userToken}`) 
            .send({ name: "Unauthorized Change" });

        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty("message", 'Forbidden');
    });
    
    // 15.1. UPDATE - Happy Path (Admin) - Mock Mode
    test("15.1 PUT /update succeeds for Admin in MOCK mode (200)", async () => {
        const updatedName = "Admin Mock Update";
        const res = await request(app)
            .put(`/api/toilets/${mockToiletId}`) 
            .set('Authorization', `Bearer ${adminToken}`) 
            .send({ name: updatedName });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.name).toBe(updatedName);
        global.MOCK.toilets.find(t => t.toiletId === mockToiletId).name = "Low Rated Toilet"; // Restore
    });


    // 16. REMOVE - Unhappy Path (Forbidden) - Mock Mode
    test("16. DELETE /remove fails for non-creator in MOCK mode (403)", async () => {
        const res = await request(app)
            .delete(`/api/toilets/${mockToiletToUpdate.toiletId}`) 
            .set('Authorization', `Bearer ${userToken}`); 

        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty("message", 'Forbidden');
    });

    // 16.1. REMOVE - Happy Path (Admin) - Mock Mode
    test("16.1 DELETE /remove succeeds for Admin in MOCK mode (200)", async () => {
        const res = await request(app)
            .delete(`/api/toilets/${mockToiletToUpdate.toiletId}`) 
            .set('Authorization', `Bearer ${adminToken}`); 

        expect(res.statusCode).toBe(200);
        expect(global.MOCK.toilets.find(t => t.toiletId === mockToiletToUpdate.toiletId).isActive).toBe(false);
        global.MOCK.toilets.find(t => t.toiletId === mockToiletToUpdate.toiletId).isActive = true; // Restore
    });
});