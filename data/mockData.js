// data/mockData.js
const { v4: uuid } = require('uuid');
const now = () => new Date().toISOString();

const users = [
  {
    userId: uuid(),
    name: "Maria Pap",
    email: "maria@example.com",
    passwordHash: "$2a$10$examplehash", // placeholder (demo)
    profilePhotoUrl: null,
    role: "USER",
    points: 120,
    ranking: 5,
    isActive: true,
    createdAt: now(),
    updatedAt: now()
  },
  {
    userId: uuid(),
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: "$2a$10$examplehash2",
    profilePhotoUrl: null,
    role: "ADMIN",
    points: 0,
    ranking: 1,
    isActive: true,
    createdAt: now(),
    updatedAt: now()
  }
];

const toilets = [
 {
  toiletId: uuid(),
  name: "Κεντρικός Σταθμός WC",
  location: { lat: 37.9838, lng: 23.7275 },
  description: "Δημόσιο WC στο κέντρο, καθαρό το πρωί",
  photos: [],
  averageRating: 4.2,
  cleanlinessRating: 4.0,
  layoutRating: 4.0,
  spaciousnessRating: 4.0,
  amenitiesRating: 4.5,
  reviewCount: 2,
  amenities: ["soap","toilet_paper"],
  wheelchairAccessible: false,
  isActive: true,
  createdBy: users[0].userId,
  createdAt: now(),
  updatedAt: now()
 },
 {
  toiletId: uuid(),
  name: "Καφετέρια X WC",
  location: { lat: 37.9840, lng: 23.7270 },
  description: "WC πελατών καφετέριας",
  photos: [],
  averageRating: 3.8,
  cleanlinessRating: 3.5,
  layoutRating: 3.8,
  spaciousnessRating: 4.0,
  amenitiesRating: 4.0,
  reviewCount: 1,
  amenities: ["soap","paper_towel"],
  wheelchairAccessible: true,
  isActive: true,
  createdBy: users[1].userId,
  createdAt: now(),
  updatedAt: now()
 }
];

const reviews = [
 {
  reviewId: uuid(),
  toiletId: toilets[0].toiletId,
  userId: users[0].userId,
  overallRating: 4.5,
  cleanlinessRating: 4.0,
  layoutRating: 4.0,
  spaciousnessRating: 4.5,
  amenitiesRating: 4.5,
  comment: "Καθαρό και ευρύχωρο.",
  photos: [],
  likes: 2,
  dislikes: 0,
  replies: [],
  createdAt: now(),
  updatedAt: now(),
  isDeleted: false
 },
 {
  reviewId: uuid(),
  toiletId: toilets[0].toiletId,
  userId: users[1].userId,
  overallRating: 3.9,
  cleanlinessRating: 3.8,
  layoutRating: 3.9,
  spaciousnessRating: 4.0,
  amenitiesRating: 4.0,
  comment: "Στα καλά αλλά βρώμικο αργότερα.",
  photos: [],
  likes: 1,
  dislikes: 0,
  replies: [],
  createdAt: now(),
  updatedAt: now(),
  isDeleted: false
 }
];

module.exports = { users, toilets, reviews };
