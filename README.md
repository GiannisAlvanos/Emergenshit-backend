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

Soft delete.




3) Admin API
GET /api/admin/pending

Επιστρέφει τουαλέτες υπό έγκριση.

POST /api/admin/approve/:id

Ενεργοποιεί τουαλέτα.

POST /api/admin/reject/:id

Απορρίπτει τουαλέτα και ειδοποιεί τον δημιουργό.

Admin rights καθορίζονται στο JWT:

role: "admin"
