const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
    // 1. Θέτουμε το MONGODB_URI για να ενεργοποιήσουμε το Mongoose path στα controllers
    process.env.MONGODB_URI = "jest_test"; 
    
    jest.setTimeout(30000);
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    // 2. Επαναφέρουμε το MONGODB_URI
    delete process.env.MONGODB_URI;

    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) await mongoServer.stop();
}, 15000); // <-- Διατηρούμε το αυξημένο timeout

// ΤΟ afterEach ΠΑΡΑΜΕΝΕΙ ΑΦΑΙΡΕΜΕΝΟ