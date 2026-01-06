import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '10s', target: 100 }, // Spike!
        { duration: '30s', target: 100 }, 
        { duration: '10s', target: 0 },  
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'],
        http_req_failed: ['rate<0.05'], 
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api';

export default function () {
    const toiletId = '1';
    const res = http.get(`${BASE_URL}/reviews/toilet/${toiletId}`);

    check(res, {
        'status is 200': (r) => r.status === 200,
    });

    sleep(1);
}