const jwt = require('jsonwebtoken');
// Υποθέτουμε ότι το auth middleware διαβάζει το secret από το process.env.JWT_SECRET
// Για να περάσει το test στο CI, πρέπει να χρησιμοποιήσουμε το secret που έχει οριστεί στο CI env (test_secret)
const { auth, requireRole } = require('../middleware/auth');

// Mock next function
const mockNext = jest.fn();

// Mock response object
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

// --- ΔΙΟΡΘΩΣΗ: Χρησιμοποιούμε το secret του CI/Test Environment ---
const JWT_SECRET = 'test_secret'; 

// Test Data
const TEST_USER = { userId: 'u1', email: 'user@test.com', role: 'USER' };
const ADMIN_USER = { userId: 'a1', email: 'admin@test.com', role: 'ADMIN' };

// Tokens (Δημιουργούνται με το σωστό secret)
const validUserToken = jwt.sign(TEST_USER, JWT_SECRET);
const validAdminToken = jwt.sign(ADMIN_USER, JWT_SECRET);
// Το invalidToken χρησιμοποιεί διαφορετικό secret για να αποτύχει
const invalidToken = jwt.sign({ foo: 'bar' }, 'wrong_secret'); 
// Το expiredToken θα πρέπει να δημιουργείται on-the-fly ή να ρυθμιστεί σωστά, 
// αλλά για λόγους σταθερότητας, το αφαιρούμε από εδώ και το δημιουργούμε μέσα στο test 4.


describe('Auth Middleware', () => {

    beforeEach(() => {
        // Χρειάζεται να διασφαλίσουμε ότι το process.env.JWT_SECRET είναι ρυθμισμένο για το auth middleware
        process.env.JWT_SECRET = JWT_SECRET;
        jest.clearAllMocks(); // Καθαρίζουμε τα mock calls πριν από κάθε test
    });

    // 1. Happy Path - Εγκυρο Token
    test('auth should call next() for a valid user token', () => {
        const req = {
            headers: { authorization: `Bearer ${validUserToken}` },
        };
        auth(req, mockRes(), mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(req.user.userId).toBe(TEST_USER.userId);
    });

    // 2. Unhappy Path - Έλλειψη Header
    test('auth should return 401 if no authorization header is provided', () => {
        const res = mockRes();
        auth({ headers: {} }, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No token' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    // 3. Unhappy Path - Άκυρο Token (Wrong Secret)
    test('auth should return 401 for an invalid token (wrong secret)', () => {
        const res = mockRes();
        const req = { headers: { authorization: `Bearer ${invalidToken}` } };
        auth(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
    });
    
    // 4. Unhappy Path - Άκυρο Token (Expired)
    test('auth should return 401 for an expired token', () => {
        // --- ΔΙΟΡΘΩΣΗ: Σωστή χρήση χρονομέτρων για να λήξει το token ---
        jest.useFakeTimers();
        // Δημιουργούμε το token με expiresIn: 0, το οποίο λήγει αμέσως
        const expiredToken = jwt.sign(TEST_USER, JWT_SECRET, { expiresIn: '0s' }); 
        
        // Προχωράμε τον χρόνο για να διασφαλίσουμε ότι το token έχει λήξει
        jest.advanceTimersByTime(100); 
        
        const res = mockRes();
        const req = { headers: { authorization: `Bearer ${expiredToken}` } };
        auth(req, res, mockNext);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
        jest.useRealTimers();
    });


    // 5. Unhappy Path - Άκυρο Format (όχι "Bearer [token]")
    test('auth should return 401 for malformed header', () => {
        const res = mockRes();
        const req = { headers: { authorization: 'Basic somebase64' } };
        auth(req, res, mockNext);
        // Εδώ το header.split(' ')[1] θα δώσει σφάλμα που το try-catch θα πιάσει ως 'Invalid token'
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Invalid token' });
    });

});


describe('RequireRole Middleware', () => {
    // ... (Το requireRole middleware δεν είχε πρόβλημα, το αφήνουμε ως έχει)
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // 6. Happy Path - Απαιτείται USER, παρέχεται USER
    test('requireRole should call next() when role matches', () => {
        const req = { user: TEST_USER };
        requireRole('USER')(req, mockRes(), mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    // 7. Happy Path - Απαιτείται USER, παρέχεται ADMIN
    test('requireRole should call next() when ADMIN is provided (override)', () => {
        const req = { user: ADMIN_USER };
        requireRole('USER')(req, mockRes(), mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
    });

    // 8. Unhappy Path - Λάθος ρόλος (Forbidden)
    test('requireRole should return 403 when role does not match and is not ADMIN', () => {
        const res = mockRes();
        const req = { user: TEST_USER }; // role: USER
        requireRole('EDITOR')(req, res, mockNext); // απαιτείται EDITOR
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Forbidden' });
    });

    // 9. Unhappy Path - Έλλειψη req.user
    test('requireRole should return 401 if req.user is missing', () => {
        const res = mockRes();
        const req = {}; // λείπει req.user
        requireRole('USER')(req, res, mockNext);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No user' });
    });
});