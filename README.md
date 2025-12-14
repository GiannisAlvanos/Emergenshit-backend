EmergenSh!t – Backend API

Το backend του EmergenSh!t είναι μία RESTful API κατασκευασμένη με Node.js, Express και MongoDB/Mongoose.
Υποστηρίζει λειτουργίες για διαχείριση χρηστών, τουαλετών, αξιολογήσεων, αναζήτηση και admin moderation.

Η API συνεργάζεται με ένα React frontend και παρέχει:

Authentication με JWT

CRUD για Toilets

Reviews με πολλαπλά rating fields

Like/Dislike σε reviews

Duplicate prevention

Geolocation υποστήριξη

Admin approval system

-------------------------------------------------------------------------------------------------------	

Εγκατάσταση:

Clone το repository

git clone https://github.com/your-repo/emergenshit-backend.git
cd emergenshit-backend
npm install
npm run seed
npm run dev

Δημιουργία .env αρχείου
PORT=4000
JWT_SECRET=your_jwt_secret
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority

Ο server τρέχει στο:
http://localhost:4000/

Database Seeding (Fake Local Mode)

Εάν το MONGODB_URI δεν οριστεί, τότε:

Το backend περνάει σε MOCK MODE

Χρησιμοποιεί in-memory objects

Τρέχει seed data από seed.js

Χρήσιμο για debugging και ανάπτυξη frontend.

------------------------------------------------------------------------------------------------------
Authentication

Χρησιμοποιεί JWT.

Endpoints:

POST /api/auth/register

Στην επέκταση Thunder Client -> New Request -> Post -> http://localhost:4000/api/auth/register -> 
-> Body (JSON): 
{
  "name": "Giannis",
  "email": "test@example.com",
  "password": "123456"
}
-> send 
Μετά απο αυτή την διαδικασία ο χρήστης μπορεί να κάνει login απο το login που εμφανίζεται στην σελίδα

-----------------------------------------------------------------------------------------------------
Έλεγχοι (Postman / browser / curl):

GET http://localhost:4000/ → "Emergensh!t API is running"

POST http://localhost:4000/api/auth/register → σώζει χρήστη (ή mock)

POST http://localhost:4000/api/auth/login → παίρνεις token

GET http://localhost:4000/api/toilets → lista toilets

POST http://localhost:4000/api/toilets (Authorization: Bearer <token>) → προσθήκη toilet

POST http://localhost:4000/api/reviews (Authorization) → προσθήκη review

--------------------------------------------------------------------------------------------------------
1)Toilets API
GET /api/toilets

Επιστρέφει όλες τις ενεργές τουαλέτες.
Υποστηρίζει filters:
minRating, amenities, sort, lat/lng, κ.λπ.

GET /api/toilets/:id

Επιστρέφει:

τουαλέτα

reviews για τη συγκεκριμένη τουαλέτα

POST /api/toilets (JWT required)

Δημιουργεί νέα τουαλέτα.
Οι νέες τουαλέτες δεν είναι ενεργές μέχρι να εγκριθούν από admin.

PUT /api/toilets/:id

Update (creator or admin only)

DELETE /api/toilets/:id

Soft-delete (deactivate)

2)Reviews API
GET /api/reviews/toilet/:toiletId

Φέρνει όλα τα ενεργά reviews για συγκεκριμένη τουαλέτα.

POST /api/reviews (JWT required)

Δημιουργεί review με:

overallRating

cleanlinessRating

layoutRating

spaciousnessRating

amenitiesRating

comment

Κάνει επίσης:

duplicate prevention (ένας χρήστης = ένα review ανά τουαλέτα)

recompute rating aggregates

PUT /api/reviews/:id

Update review (μόνο creator ή admin)

DELETE /api/reviews/:id

Soft delete




3) Admin API
GET /api/admin/pending

Επιστρέφει τουαλέτες υπό έγκριση.

POST /api/admin/approve/:id

Ενεργοποιεί τουαλέτα.

POST /api/admin/reject/:id

Απορρίπτει τουαλέτα και ειδοποιεί τον δημιουργό.

Admin rights καθορίζονται στο JWT:

role: "admin"
.
----------------------------------------------------------------------------------------------
(Παραδοτέο 2)
Στο πλαίσιο του 2ου παραδοτέου υλοποιήθηκε ολοκληρωμένη στρατηγική ελέγχου (testing strategy) για το backend.

Backend Unit & Integration Tests

Το backend καλύπτεται με Jest και Supertest.

Υλοποιήθηκαν tests για:

1)Controllers:

 - authController

 - toiletsController

 - reviewsController

 - searchController

2)Middleware:

 - auth

 - errorHandler

3)Routes

 - auth

 - toilets

 - reviews

 - search

 - admin

4)Models

 - User

 - Toilet

 - Review

Τα tests καλύπτουν:

 Happy paths

 Error cases

 Authorization / role checks

 Validation errors

 Duplicate prevention

 Like / Dislike logic

-------------------------------------------------------------------------------

Test Database

Κατά την εκτέλεση των tests:

 Χρησιμοποιείται mongodb-memory-server

 Δημιουργείται in-memory MongoDB instance

 Δεν επηρεάζεται production ή development database

Για την εκτέλεση των Tests χρησιμοποιείται η εντολή

npm test
ή
npm run test


Code Coverage

Το backend επιτυγχάνει:

> 89% statement coverage

> 78% branch coverage

> 88% function coverage

---------------------------------|---------|----------|---------|---------|---------------------
File                             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s   
---------------------------------|---------|----------|---------|---------|---------------------
All files                        |   89.03 |    78.67 |   88.57 |   92.73 | 

All files                        |   89.03 |    78.67 |   88.57 |   92.73 | 
 Emergenshit-backend             |    93.1 |    66.66 |       0 |    93.1 | 
  app.js                         |    93.1 |    66.66 |       0 |    93.1 | 23,43
 Emergenshit-backend/config      |   27.27 |        0 |       0 |   27.27 | 
  db.js                          |   27.27 |        0 |       0 |   27.27 | 6-16
 Emergenshit-backend/controllers |   88.11 |    78.09 |   89.83 |   92.94 | 
  authController.js              |   95.08 |    87.17 |     100 |   98.03 | 22
  reviewsController.js           |   89.85 |    77.94 |   85.71 |   96.51 | 54,161-165,231     
  searchController.js            |     100 |      100 |     100 |     100 | 
  toiletsController.js           |   81.71 |    73.64 |    87.5 |   85.71 | 30-32,69-89,165,227
 Emergenshit-backend/data        |     100 |      100 |     100 |     100 | 
  mockData.js                    |     100 |      100 |     100 |     100 | 
 Emergenshit-backend/middleware  |     100 |    92.85 |     100 |     100 | 
  auth.js                        |     100 |       90 |     100 |     100 | 9
  errorHandler.js                |     100 |      100 |     100 |     100 | 
 Emergenshit-backend/models      |     100 |      100 |     100 |     100 | 
  Review.js                      |     100 |      100 |     100 |     100 | 
  Toilet.js                      |     100 |      100 |     100 |     100 | 
  User.js                        |     100 |      100 |     100 |     100 | 
 Emergenshit-backend/routes      |     100 |      100 |     100 |     100 | 
  admin.js                       |     100 |      100 |     100 |     100 | 
  auth.js                        |     100 |      100 |     100 |     100 | 
  reviews.js                     |     100 |      100 |     100 |     100 | 
  search.js                      |     100 |      100 |     100 |     100 | 
  toilets.js                     |     100 |      100 |     100 |     100 | 
---------------------------------|---------|----------|---------|---------|---------------------

Test Suites: 7 passed, 7 total
Tests:       111 passed, 111 total

(Σχεδόν όλο το αρχείο db.js δεν έχει εκτελεστεί. Αυτό συμβαίνει επειδή, για λόγους ταχύτητας και αξιοπιστίας, το testing παρακάμπτει 
τη σύνδεση με την πραγματική βάση δεδομένων και χρησιμοποιεί mocks.)

Το coverage report παράγεται αυτόματα μέσω Jest (--coverage).
-----------------------------------------------------------------------------------------------------------------------------------

CI Pipeline (GitHub Actions)

Υλοποιήθηκε πλήρες CI pipeline μέσω GitHub Actions.

Backend CI Workflow

Το workflow εκτελείται σε:

  -push

  -pull_request

Προς το production/main branch.

Το pipeline περιλαμβάνει:

1)Checkout κώδικα

2)Εγκατάσταση dependencies

3)Εκτέλεση tests

4)Έλεγχο code coverage

5)Build validation

Αν οποιοδήποτε test αποτύχει, το pipeline σταματά και το deploy δεν εκτελείται.

Αρχείο:

.github/workflows/backend.yml
--------------------------------------------------------------------------------------------------------


Deployment στο Render 

Το backend έχει γίνει deploy στην πλατφόρμα Render.

Deployment Features:

 - Αυτόματο deploy από GitHub

 - Συνδεδεμένο με CI pipeline

 - Deploy γίνεται μόνο αν περάσουν όλα τα tests

 - Environment variables ορίζονται μέσω Render dashboard

Production Environment Variables

Ορίζονται στο Render (όχι στο repository):

PORT

JWT_SECRET

JWT_EXPIRES_IN

MONGODB_URI



Production URL
https://emergenshit-backend-1.onrender.com/


Η API είναι προσβάσιμη και επικοινωνεί κανονικά με το frontend.
------------------------------------------------------------------------------------------------------

Επικοινωνία με Frontend

Το backend:

-Παρέχει REST API

-Χρησιμοποιεί JWT authentication

-Υποστηρίζει CORS

-Επικοινωνεί με React frontend που έχει επίσης deploy στο Render

Το frontend καλεί το backend μέσω environment variable:

VITE_API_URL