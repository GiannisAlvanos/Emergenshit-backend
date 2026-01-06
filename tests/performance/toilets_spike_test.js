import http from 'k6/http';
import { check, sleep } from 'k6';

// ----------------------------------------------------
// 1. CONFIGURATION (Ρυθμίσεις για Spike Test)
// ----------------------------------------------------
export const options = {
    stages: [
        { duration: '10s', target: 100 }, // Απότομη άνοδος σε 50 χρήστες
        { duration: '30s', target: 100 }, // Παραμονή στην αιχμή (Spike)
        { duration: '10s', target: 0 },  // Απότομη πτώση
    ],
    thresholds: {
        // Μη-λειτουργική απαίτηση: Το 95% των αιτημάτων να απαντά σε < 2 δευτερόλεπτα
        http_req_duration: ['p(95)<2000'],
        // Επιτρέπουμε 5% σφάλματα λόγω του απότομου spike
        http_req_failed: ['rate<0.05'], 
    },
};

// ΔΙΟΡΘΩΣΗ: Αφαιρέθηκε το /toilets/ για να μην γίνεται διπλό
const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

// ----------------------------------------------------
// 2. TEST SCENARIO
// ----------------------------------------------------
export default function () {
    // Σωστό URL: http://localhost:4000/api/toilets
    const res = http.get(`${BASE_URL}/toilets`);

    check(res, {
        'is status 200': (r) => r.status === 200,
        'has success body': (r) => {
            try {
                return r.json().success === true;
            } catch (e) {
                return false;
            }
        },
    });

    sleep(1);
}