const request = require('supertest');
const express = require('express');
const errorHandler = require('../middleware/errorHandler');

// Δημιουργία μιας μικρής Express εφαρμογής για δοκιμές
const app = express();

// 1. Δοκιμαστική διαδρομή που προκαλεί γενικό σφάλμα
app.get('/test/general-error', (req, res, next) => {
    // Προκαλείται σφάλμα χωρίς status (θα χρησιμοποιηθεί το 500)
    throw new Error('Something broke'); 
});

// 2. Δοκιμαστική διαδρομή που προκαλεί σφάλμα με συγκεκριμένο status
app.get('/test/specific-error', (req, res, next) => {
    const specificError = new Error('Not found');
    specificError.status = 404; // Ορίζουμε status 404
    next(specificError); // Χρησιμοποιούμε next(err) για σφάλμα
});

// ******************************************************
// ΝΕΑ ΔΙΑΔΡΟΜΗ ΓΙΑ ΤΟΝ ΕΛΕΓΧΟ ΤΟΥ FALLBACK (100% COVERAGE)
// ******************************************************
app.get('/test/fallback-error', (req, res, next) => {
    // Προκαλείται ένα σφάλμα με κενό μήνυμα και απουσία status
    const minimalError = new Error();
    minimalError.status = null; // Ή απλά μην το ορίσετε
    next(minimalError);
});


// Τελευταίο middleware: ο χειριστής σφαλμάτων
app.use(errorHandler);


describe('Error Handler Middleware', () => {
    
    // 1. Έλεγχος σφάλματος με προκαθορισμένο status (404)
    test('should return specific status and message when error has status', async () => {
        const res = await request(app).get('/test/specific-error');

        // Ελέγχουμε τη διακλάδωση `err.status || 500`
        expect(res.statusCode).toBe(404); 
        expect(res.body).toEqual({
            success: false,
            error: 'Not found',
        });
    });

    // 2. Έλεγχος γενικού σφάλματος (default 500)
    test('should return 500 and general message for internal errors', async () => {
        // Εδώ ελέγχουμε τη διακλάδωση `|| 500` και `|| 'Server Error'`
        const res = await request(app).get('/test/general-error');

        expect(res.statusCode).toBe(500); 
        expect(res.body).toEqual({
            success: false,
            error: 'Something broke', // Το message του σφάλματος
        });
    });
    
    // ******************************************************
    // 3. ΝΕΟΣ ΕΛΕΓΧΟΣ: Εξαναγκασμός του Error Handler να χρησιμοποιήσει τα Defaults
    //    (Covers: res.status(err.status || 500) & error: err.message || 'Server Error')
    // ******************************************************
    test('should return default 500 and "Server Error" for minimal/unhandled errors', async () => {
        // Mock console.error for clean output, as this route explicitly calls it
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app).get('/test/fallback-error');

        // Check if status defaults to 500
        expect(res.statusCode).toBe(500); 
        expect(res.body).toEqual({
            success: false,
            // Check if error message defaults to 'Server Error' (since new Error() has empty message)
            error: 'Server Error', 
        });

        consoleErrorSpy.mockRestore(); 
    });
});