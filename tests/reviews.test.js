const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const Toilet = require("../models/Toilet");
const User = require("../models/User");
const Review = require("../models/Review");
const { v4: uuid } = require('uuid');

jest.mock('../services/toiletAggregates.service', () => ({
    updateMongooseAggregates: jest.fn().mockResolvedValue()
}));

let userToken;
let otherUserToken;
let adminToken; 
let testToiletId;
let reviewId;
let testUserId;
let otherUserId;
let adminUserId = 'admin-id';

const testUser = {
    name: "Review User",
    email: "test.review@example.com",
    password: "123456"
};

const otherUser = {
    name: "Other User",
    email: "other.review@example.com",
    password: "123456"
};

const adminUser = {
    name: "Admin Review User",
    email: "admin.review@example.com",
    password: "123456"
};

const baseReview = {
    overallRating: 5,
    cleanlinessRating: 4,
    layoutRating: 5,
    spaciousnessRating: 4,
    amenitiesRating: 5,
    comment: "Excellent toilet, very clean.",
};

beforeAll(async () => {
    jest.setTimeout(30000);
    
    await mongoose.connection.db.dropDatabase();
    
    // 1. Δημιουργία Χρηστών
    await request(app).post("/api/auth/register").send(testUser);
    const userRes = await request(app).post("/api/auth/login").send(testUser);
    userToken = userRes.body.token;
    testUserId = userRes.body.user.userId;

    await request(app).post("/api/auth/register").send(otherUser);
    const otherUserRes = await request(app).post("/api/auth/login").send(otherUser);
    otherUserToken = otherUserRes.body.token;
    otherUserId = otherUserRes.body.user.userId;

    // Δημιουργία Admin
    const hashedPassword = await require('bcryptjs').hash(adminUser.password, 10);
    await User.create({ ...adminUser, userId: adminUserId, role: 'ADMIN', passwordHash: hashedPassword });
    const adminRes = await request(app).post("/api/auth/login").send(adminUser);
    adminToken = adminRes.body.token;
    
    await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
        await mongoose.connection.close();
    }
});

describe("Reviews API (Mongoose Mode)", () => {
    // Parent beforeEach to ensure clean slate for each test and a valid toilet
    beforeEach(async () => {
        await Review.deleteMany({});
        await Toilet.deleteMany({});
        
        const toiletData = { name: "Review Test Toilet", location: { lat: 40.0, lng: 23.0 }, createdBy: testUserId };
        const toiletRes = await request(app).post("/api/toilets").set('Authorization', `Bearer ${userToken}`).send(toiletData);
        // IMPORTANT: Set testToiletId in a reliable way for the parent scope
        testToiletId = toiletRes.body.data.toiletId;
    });

    // 1. CREATE - Happy Path (Εγγραφή 1)
    test("1. POST /create adds new review (201) and saves ID", async () => {
        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ...baseReview, toiletId: testToiletId });

        expect(res.statusCode).toBe(201);
        expect(res.body.data).toHaveProperty("reviewId");
        
        reviewId = res.body.data.reviewId;
    });
    
    // --- NEW CREATE CATCH COVERAGE (Line 54) ---
    test("1.1 POST /create returns 500 when Mongoose creation fails (Covers Line 54)", async () => {
        const findOneSpy = jest.spyOn(Review, 'findOne');
        findOneSpy.mockImplementationOnce(() => Promise.resolve(null)); 
        
        const createSpy = jest.spyOn(Review, 'create');
        createSpy.mockImplementationOnce(() => {
            throw new Error("Mongoose Create Error");
        });
        
        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${userToken}`)
            .send({ ...baseReview, toiletId: testToiletId });

        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("error", "Mongoose Create Error");
        createSpy.mockRestore();
        findOneSpy.mockRestore();
    });
    // ---------------------------------------------------

    // 2. CREATE - Unhappy Path (Missing required field)
    test("2. POST /create returns 400 for missing overallRating", async () => {
        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${userToken}`)
            .send({ toiletId: testToiletId }); 

        expect(res.statusCode).toBe(400);
        expect(res.body).toHaveProperty("message", 'toiletId and overallRating required');
    });

    // 3. CREATE - Unhappy Path (Duplicate review)
    test("3. POST /create returns 409 if user already reviewed", async () => {
        await request(app).post("/api/reviews").set('Authorization', `Bearer ${userToken}`).send({ ...baseReview, toiletId: testToiletId });

        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${userToken}`) 
            .send({ ...baseReview, overallRating: 4, toiletId: testToiletId });

        expect(res.statusCode).toBe(409);
        expect(res.body).toHaveProperty("message", 'You have already rated this toilet');
    });

    // 4. LIST - Happy Path
    test("4. GET /listByToilet returns reviews array (200)", async () => {
        await request(app).post("/api/reviews").set('Authorization', `Bearer ${otherUserToken}`).send({ ...baseReview, toiletId: testToiletId });

        const res = await request(app).get(`/api/reviews/toilet/${testToiletId}`);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBe(1); 
    });

    // --- NEW LIST CATCH COVERAGE (Line 148) ---
    test("4.1 GET /listByToilet returns 500 when Mongoose query fails (Covers Line 148)", async () => {
        const findSpy = jest.spyOn(Review, 'find');
        findSpy.mockImplementationOnce(() => {
            throw new Error("Mongoose Find Error");
        });

        const res = await request(app).get(`/api/reviews/toilet/${testToiletId}`);
        
        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("error", "Mongoose Find Error");
        findSpy.mockRestore();
    });
    // ---------------------------------------------------

    // 5. UPDATE - Happy Path (Creator)
    test("5. PUT /update by creator succeeds (200)", async () => {
        const resCreate = await request(app).post("/api/reviews").set('Authorization', `Bearer ${userToken}`).send({ ...baseReview, toiletId: testToiletId });
        const liveReviewId = resCreate.body.data.reviewId;

        const updatedComment = "I changed my mind, it's perfect!";
        const res = await request(app)
            .put(`/api/reviews/${liveReviewId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ comment: updatedComment, overallRating: 5 });

        expect(res.statusCode).toBe(200);
        expect(res.body.data.comment).toBe(updatedComment);
    });

    // --- NEW UPDATE CATCH/FORBIDDEN COVERAGE (Lines 161, 166) ---
    test("5.1 PUT /update returns 403 for non-creator/non-admin (Mongoose) (Covers Line 161)", async () => {
        const resCreate = await request(app).post("/api/reviews").set('Authorization', `Bearer ${userToken}`).send({ ...baseReview, toiletId: testToiletId });
        const liveReviewId = resCreate.body.data.reviewId;
        
        const res = await request(app)
            .put(`/api/reviews/${liveReviewId}`)
            .set('Authorization', `Bearer ${otherUserToken}`) 
            .send({ overallRating: 1 });

        expect(res.statusCode).toBe(403);
        expect(res.body).toHaveProperty("message", 'Forbidden');
    });

    // FIX: Simplified the mock setup to avoid issues with updateMongooseAggregates helper
    test("5.2 PUT /update returns 500 when Mongoose save fails (Covers Line 166)", async () => {
        const resCreate = await request(app).post("/api/reviews").set('Authorization', `Bearer ${userToken}`).send({ ...baseReview, toiletId: testToiletId });
        const liveReviewId = resCreate.body.data.reviewId;

        // Mock the document returned by findOne
        const reviewDoc = {
            reviewId: liveReviewId, 
            userId: testUserId, 
            toiletId: testToiletId, 
            // Mock save() to throw the error
            save: jest.fn(() => { throw new Error("Mongoose Save Error"); })
        };
        const findOneSpy = jest.spyOn(Review, 'findOne');
        findOneSpy.mockImplementationOnce(() => Promise.resolve(reviewDoc)); 
        
        const res = await request(app)
            .put(`/api/reviews/${liveReviewId}`)
            .set('Authorization', `Bearer ${userToken}`) 
            .send({ comment: "Updated Comment" });

        expect(res.statusCode).toBe(500);
        expect(res.body).toHaveProperty("error", "Mongoose Save Error");
        findOneSpy.mockRestore();
    });
    // ---------------------------------------------------

    // 7. REMOVE - Happy Path (Creator)
    test("7. DELETE /remove by creator succeeds (200)", async () => {
        const resCreate = await request(app).post("/api/reviews").set('Authorization', `Bearer ${userToken}`).send({ ...baseReview, toiletId: testToiletId });
        const liveReviewId = resCreate.body.data.reviewId;

        const res = await request(app)
            .delete(`/api/reviews/${liveReviewId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveProperty("message", 'Deleted');

        const deletedReview = await Review.findOne({ reviewId: liveReviewId });
        expect(deletedReview.isDeleted).toBe(true); 
    });
    
    // 8. REMOVE - Unhappy Path (Not found)
    test("8. DELETE /remove returns 404 for non-existent ID", async () => {
        const nonExistentId = 'non-existent-review-id-123';
        const res = await request(app)
            .delete(`/api/reviews/${nonExistentId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.statusCode).toBe(404);
        expect(res.body).toHaveProperty("message", 'Not found');
    });

    // ******************************************************
    // LIKE/DISLIKE API
    // ******************************************************

    describe("LIKE/DISLIKE API", () => {
        let liveReviewId;
        
        // FIX: Recreate review here, inside the nested describe, but use beforeEach for clean context
        beforeEach(async () => {
            await Review.deleteMany({});
            
            const res = await request(app)
                .post("/api/reviews")
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ ...baseReview, toiletId: testToiletId, overallRating: 4, comment: "Live for likes" });
            liveReviewId = res.body.data.reviewId;
        });

        // 9. LIKE - Happy Path
        test("9. POST /like adds like and updates count (200)", async () => {
            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(1);
            expect(res.body.data.dislikes).toBe(0);
        });
        
        // --- NEW LIKE ALREADY LIKED COVERAGE (Line 231) ---
        test("9.1 POST /like does not increment like count if already liked (Covers Line 231)", async () => {
            // Pre-like it once
            await request(app).post(`/api/reviews/${liveReviewId}/like`).set('Authorization', `Bearer ${userToken}`);
            
            // Re-run like action
            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(1); // Should remain 1
        });
        // ---------------------------------------------------

        // 10. DISLIKE - Happy Path (αντικαθιστά το Like)
        test("10. POST /dislike replaces like and updates count (200)", async () => {
            // Pre-like it once
            await request(app).post(`/api/reviews/${liveReviewId}/like`).set('Authorization', `Bearer ${userToken}`);
            
            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/dislike`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(0);
            expect(res.body.data.dislikes).toBe(1);
        });

        // 11. LIKE - Αντίστροφη Δράση (αντικαθιστά το Dislike)
        test("11. POST /like replaces dislike successfully (200)", async () => {
            // Pre-dislike it once
            await request(app).post(`/api/reviews/${liveReviewId}/dislike`).set('Authorization', `Bearer ${userToken}`);

            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(1);
            expect(res.body.data.dislikes).toBe(0);
        });
        
        // --- NEW LIKE/DISLIKE CATCH COVERAGE (Lines 286, 339) ---
        test("11.1 POST /like returns 500 when Mongoose save fails (Covers Line 286)", async () => {
            // Mock the document returned by findOne
            const reviewDoc = {
                reviewId: liveReviewId, 
                userId: adminUserId, likedBy: [], dislikedBy: [], likes: 0, dislikes: 0, 
                // Ensure arrays are initialized for filter/push logic in controller
                save: jest.fn(() => { throw new Error("Like Save Error"); })
            };
            const findOneSpy = jest.spyOn(Review, 'findOne');
            findOneSpy.mockImplementationOnce(() => Promise.resolve(reviewDoc)); 
            
            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/like`)
                .set('Authorization', `Bearer ${userToken}`); 

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty("error", "Like Save Error");
            findOneSpy.mockRestore();
        });

        test("11.2 POST /dislike returns 500 when Mongoose save fails (Covers Line 339)", async () => {
            // Mock the document returned by findOne
            const reviewDoc = {
                reviewId: liveReviewId, 
                userId: adminUserId, likedBy: [], dislikedBy: [], likes: 0, dislikes: 0, 
                // Ensure arrays are initialized for filter/push logic in controller
                save: jest.fn(() => { throw new Error("Dislike Save Error"); })
            };
            const findOneSpy = jest.spyOn(Review, 'findOne');
            findOneSpy.mockImplementationOnce(() => Promise.resolve(reviewDoc)); 
            
            const res = await request(app)
                .post(`/api/reviews/${liveReviewId}/dislike`)
                .set('Authorization', `Bearer ${userToken}`); 

            expect(res.statusCode).toBe(500);
            expect(res.body).toHaveProperty("error", "Dislike Save Error");
            findOneSpy.mockRestore();
        });
        // ---------------------------------------------------

        // 12. DISLIKE - Unhappy Path (Not found)
        test("12. POST /dislike returns 404 for non-existent ID", async () => {
            const res = await request(app)
                .post(`/api/reviews/non-existent-id/dislike`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty("message", 'Not found');
        });

        // 13. LIKE - Unhappy Path (Not found)
        test("13. POST /like returns 404 for non-existent ID", async () => {
            const res = await request(app)
                .post(`/api/reviews/non-existent-id/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty("message", 'Not found');
        });
    });
});


// --- MOCK COVERAGE BLOCK FOR AGGREGATES ---
// This block relies on its own setup to force Mock Mode.

describe("Reviews API (Mock Aggregates Coverage)", () => {
    let mockToiletId;
    let mockReviewId1;
    let mockReviewId2;
    let originalMongoURI;

    global.MOCK = {
        users: [],
        toilets: [],
        reviews: []
    };

    const mockReviews = [];
    const mockToilet = {
        toiletId: uuid(),
        name: "Aggregate Test Toilet",
        location: { lat: 41.0, lng: 24.0 },
        isActive: true,
        reviewCount: 0, averageRating: 0, cleanlinessRating: 0, layoutRating: 0, spaciousnessRating: 0, amenitiesRating: 0,
    };

    beforeAll(() => {
        // 1. Force Mock Mode
        originalMongoURI = process.env.MONGODB_URI;
        delete process.env.MONGODB_URI;
        
        // 2. Set up global MOCK data for the tests
        global.MOCK.reviews = mockReviews;
        global.MOCK.toilets.push(mockToilet);
        mockToiletId = mockToilet.toiletId;

        // 3. Mock Users for Authorization checks in Mock Mode
        global.MOCK.users.push({
            userId: adminUserId, 
            email: adminUser.email,
            role: adminUser.role 
        });
        global.MOCK.users.push({
            userId: testUserId, 
            email: testUser.email,
            role: testUser.role 
        });
        global.MOCK.users.push({
            userId: otherUserId, // Added other user for permission testing
            email: otherUser.email,
            role: otherUser.role 
        });
    });

    afterAll(() => {
        // Restore environment
        process.env.MONGODB_URI = originalMongoURI;
        // Clean up mock toilet
        global.MOCK.toilets.pop();
        global.MOCK.reviews = [];
        global.MOCK.users = [];
    });

    // Test 14: CREATE first review (should calculate averages for the first time)
    test("14. POST /create in MOCK should calculate and set initial aggregates", async () => {
        const reviewData1 = { 
            toiletId: mockToiletId, 
            overallRating: 5, cleanlinessRating: 5, layoutRating: 5, spaciousnessRating: 5, amenitiesRating: 5
        };

        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${adminToken}`) 
            .send(reviewData1);
        
        expect(res.statusCode).toBe(201);
        expect(mockToilet.reviewCount).toBe(1);
        expect(mockToilet.averageRating).toBe(5.0);
        expect(mockToilet.cleanlinessRating).toBe(5.0);
        mockReviewId1 = res.body.data.reviewId;
    });

    // Test 15: CREATE second review (should recalculate aggregates)
    test("15. POST /create second review should recalculate aggregates correctly", async () => {
        const reviewData2 = { 
            toiletId: mockToiletId, 
            overallRating: 3, cleanlinessRating: 1, layoutRating: 3, spaciousnessRating: 3, amenitiesRating: 2
        };

        const res = await request(app)
            .post("/api/reviews")
            .set('Authorization', `Bearer ${userToken}`)
            .send(reviewData2);
        
        expect(res.statusCode).toBe(201);
        expect(mockToilet.reviewCount).toBe(2);
        // Average overall rating: (5 + 3) / 2 = 4.0
        // Average cleanliness: (5 + 1) / 2 = 3.0
        expect(mockToilet.averageRating).toBe(4.0);
        expect(mockToilet.cleanlinessRating).toBe(3.0);
        mockReviewId2 = res.body.data.reviewId;
    });
    
    // Test 16: UPDATE a review (should trigger aggregate recalculation)
    test("16. PUT /update should trigger recomputing of aggregates", async () => {
        const updatedRating = 1; // Change overall rating of the first review (from 5 to 1)

        const res = await request(app)
            .put(`/api/reviews/${mockReviewId1}`)
            .set('Authorization', `Bearer ${adminToken}`) 
            .send({ overallRating: updatedRating, cleanlinessRating: 1 });
        
        expect(res.statusCode).toBe(200);
        // New Average overall rating: (1 + 3) / 2 = 2.0
        // New Average cleanliness: (1 + 1) / 2 = 1.0
        expect(mockToilet.reviewCount).toBe(2);
        expect(mockToilet.averageRating).toBe(2.0);
        expect(mockToilet.cleanlinessRating).toBe(1.0);
    });

    // Test 17: REMOVE a review (should trigger aggregate recalculation)
    test("17. DELETE /remove should trigger recomputing of aggregates", async () => {
        const res = await request(app)
            .delete(`/api/reviews/${mockReviewId2}`)
            .set('Authorization', `Bearer ${userToken}`); // User can delete their own review
        
        expect(res.statusCode).toBe(200);
        // Only review #1 (updated to rating 1) remains active
        // Remaining rating: 1.0
        expect(mockToilet.reviewCount).toBe(1); 
        expect(mockToilet.averageRating).toBe(1.0);
        expect(mockToilet.cleanlinessRating).toBe(1.0);
    });
    
    // Test 18: REMOVE last review (should reset aggregates to 0)
    test("18. DELETE /remove last review should reset aggregates to 0", async () => {
        const res = await request(app)
            .delete(`/api/reviews/${mockReviewId1}`)
            .set('Authorization', `Bearer ${adminToken}`);
        
        expect(res.statusCode).toBe(200);
        // No reviews left
        expect(mockToilet.reviewCount).toBe(0); 
        expect(mockToilet.averageRating).toBe(0);
        expect(mockToilet.cleanlinessRating).toBe(0);
    });
    
    // --- NEW MOCK UPDATE/REMOVE COVERAGE (Lines 161-165, 219, 221) ---
    describe("MOCK UPDATE/REMOVE COVERAGE (Lines 161-165)", () => {
        let mockReviewIdToUpdate;
        
        beforeAll(async () => {
            // Create a review owned by testUser for testing permission control
            const reviewData = { 
                toiletId: mockToiletId, 
                overallRating: 4, cleanlinessRating: 4, layoutRating: 4, spaciousnessRating: 4, amenitiesRating: 4
            };

            const res = await request(app)
                .post("/api/reviews")
                .set('Authorization', `Bearer ${userToken}`) // Owned by testUser
                .send(reviewData);
            
            mockReviewIdToUpdate = res.body.data.reviewId;
        });

        // Test 18.1: PUT /update returns 404 for non-existent ID (Covers Mock Line 162)
        test("18.1 PUT /update returns 404 for non-existent ID (Mock)", async () => {
            const res = await request(app)
                .put(`/api/reviews/${uuid()}`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ comment: "Should not save" });
            
            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty("message", 'Not found');
        });

        // Test 18.2: PUT /update returns 403 for non-creator/non-admin (Covers Mock Line 164)
        test("18.2 PUT /update returns 403 for non-creator/non-admin (Mock)", async () => {
            // Attempt to update the review owned by 'testUser' using 'otherUser'
            const res = await request(app)
                .put(`/api/reviews/${mockReviewIdToUpdate}`)
                .set('Authorization', `Bearer ${otherUserToken}`) // Attempt by 'otherUser'
                .send({ overallRating: 1 });
            
            expect(res.statusCode).toBe(403);
            expect(res.body).toHaveProperty("message", 'Forbidden');
        });
        
        // Note: The happy path for update in Mock Mode is covered by Test 16

        // Test 18.3: DELETE /remove returns 404 for non-existent ID (Covers Mock Line 219)
        test("18.3 DELETE /remove returns 404 for non-existent ID (Mock)", async () => {
            const res = await request(app)
                .delete(`/api/reviews/${uuid()}`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(404);
            expect(res.body).toHaveProperty("message", 'Not found');
        });

        // Test 18.4: DELETE /remove returns 403 for non-creator/non-admin (Covers Mock Line 221)
        test("18.4 DELETE /remove returns 403 for non-creator/non-admin (Mock)", async () => {
            // Attempt to delete the review owned by 'testUser' using 'otherUser'
            const res = await request(app)
                .delete(`/api/reviews/${mockReviewIdToUpdate}`)
                .set('Authorization', `Bearer ${otherUserToken}`); // Attempt by 'otherUser'
            
            expect(res.statusCode).toBe(403);
            expect(res.body).toHaveProperty("message", 'Forbidden');
        });
        // Note: The happy path for remove in Mock Mode is covered by Tests 17 and 18
    });
    // ----------------------------------------------------------------------

    
    // ******************************************************
    // LIKE/DISLIKE API (Mock Mode)
    // ******************************************************
    
    describe("LIKE/DISLIKE API (Mock Mode)", () => {
        let liveReviewIdMock;
        
        beforeAll(async () => {
            // Δημιουργούμε μια νέα κριτική για το like/dislike
            const reviewData = { 
                toiletId: mockToiletId, 
                overallRating: 4, cleanlinessRating: 4, layoutRating: 4, spaciousnessRating: 4, amenitiesRating: 4
            };

            const res = await request(app)
                .post("/api/reviews")
                .set('Authorization', `Bearer ${adminToken}`) 
                .send(reviewData);
            
            liveReviewIdMock = res.body.data.reviewId;
        });
        
        // Test 19: LIKE - Happy Path (Mock Mode)
        test("19. POST /like adds like and updates count (Mock)", async () => {
            const res = await request(app)
                .post(`/api/reviews/${liveReviewIdMock}/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(1);
        });
        
        // Test 20: DISLIKE - Replaces Like (Mock Mode)
        test("20. POST /dislike replaces existing like (Mock)", async () => {
            const res = await request(app)
                .post(`/api/reviews/${liveReviewIdMock}/dislike`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(0);
            expect(res.body.data.dislikes).toBe(1);
        });
        
        // Test 21: LIKE - Replaces Dislike (Mock Mode)
        test("21. POST /like replaces existing dislike (Mock)", async () => {
            const res = await request(app)
                .post(`/api/reviews/${liveReviewIdMock}/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.data.likes).toBe(1);
            expect(res.body.data.dislikes).toBe(0);
        });

        // Test 22: LIKE - Unhappy Path (Not found) (Mock Mode)
        test("22. POST /like returns 404 for non-existent ID (Mock)", async () => {
            const res = await request(app)
                .post(`/api/reviews/non-existent-mock-id/like`)
                .set('Authorization', `Bearer ${userToken}`);
            
            expect(res.statusCode).toBe(404);
        });
    });

});