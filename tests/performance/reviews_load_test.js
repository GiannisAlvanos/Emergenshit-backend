import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '20s', target: 15 }, // Άνοδος σε 15 χρήστες
        { duration: '30s', target: 15 }, // Σταθερά στα 15
        { duration: '10s', target: 0 },  // Μείωση
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // Μη-λειτουργική απαίτηση < 2s
        http_req_failed: ['rate<0.01'],    // Σφάλματα < 1%
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

export default function () {
    // Χρησιμοποιούμε ένα toiletId από τα mockData σου (π.χ. '1')
    const toiletId = '1'; 
    const res = http.get(`${BASE_URL}/reviews/toilet/${toiletId}`);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'has success body': (r) => {
            try { return r.json().success === true; } catch (e) { return false; }
        },
    });

    sleep(1);
}