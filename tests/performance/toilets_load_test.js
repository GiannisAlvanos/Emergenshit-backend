import http from 'k6/http';
import { check, sleep } from 'k6';

// ----------------------------------------------------
// 1. CONFIGURATION (Ρυθμίσεις)
// ----------------------------------------------------
export const options = {
    stages: [
        { duration: '20s', target: 100 }, // Σταδιακή άνοδος σε 10 χρήστες
        { duration: '30s', target: 100 }, // Παραμονή στους 10 χρήστες (Load)
        { duration: '10s', target: 0 },  // Σταδιακή μείωση
    ],
    thresholds: {
        // Μη-λειτουργική απαίτηση: Το 95% των αιτημάτων να απαντά σε < 2 δευτερόλεπτα
        http_req_duration: ['p(95)<2000'],
        // Μη-λειτουργική απαίτηση: Τα σφάλματα να είναι λιγότερα από 1%
        http_req_failed: ['rate<0.01'],
    },
};

// Διόρθωση: Αφαιρέθηκε το επιπλέον /toilets/ από το BASE_URL
const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

// ----------------------------------------------------
// 2. TEST SCENARIO
// ----------------------------------------------------
export default function () {
    // Καλούμε το σωστό endpoint: http://localhost:4000/api/toilets
    const res = http.get(`${BASE_URL}/toilets`);

    // Debugging: Αν αποτύχει, δες το status και το body στο τερματικό
    if (res.status !== 200) {
        console.error(`Request failed! Path: ${res.url}, Status: ${res.status}, Body: ${res.body}`);
    }

    // Έλεγχος αν η απάντηση είναι 200 OK
    check(res, {
        'is status 200': (r) => r.status === 200,
        'has success body': (r) => {
            try {
                // Προσοχή: Βεβαιώσου ότι το API σου επιστρέφει όντως { "success": true }
                return r.json().success === true;
            } catch (e) {
                return false;
            }
        },
    });

    // Μικρή παύση 1 δευτερολέπτου για να προσομοιώσουμε ανθρώπινη συμπεριφορά
    sleep(1);
}