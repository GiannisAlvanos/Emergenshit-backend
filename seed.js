// seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const User = require('./models/User');
const Toilet = require('./models/Toilet');
const Review = require('./models/Review');

const MONGO_URI = process.env.MONGODB_URI;

async function seed() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB");

  // Clear collections
  await User.deleteMany({});
  await Toilet.deleteMany({});
  await Review.deleteMany({});

  console.log("Old data cleared");

  // Users
  const admin = await User.create({
    userId: uuid(),
    name: "Admin User",
    email: "admin@emergenshit.com",
    passwordHash: await bcrypt.hash("Admin123!", 10),
    role: "ADMIN",
    points: 0,
    ranking: 1,
    isActive: true
  });

  const maria = await User.create({
    userId: uuid(),
    name: "Maria Pap",
    email: "maria@example.com",
    passwordHash: await bcrypt.hash("Maria123!", 10),
    role: "USER",
    points: 120,
    ranking: 3,
    isActive: true
  });

  const john = await User.create({
    userId: uuid(),
    name: "John Smith",
    email: "john@example.com",
    passwordHash: await bcrypt.hash("John123!", 10),
    role: "USER",
    points: 50,
    ranking: 2,
    isActive: true
  });

  console.log("Users inserted");

  // Toilets
  const toiletsData = [
    {
      name: "Σύνταγμα Δημόσια Τουαλέτα",
      location: { lat: 37.9755, lng: 23.7348 },
      description: "Κεντρική, συχνά γεμάτη, μέτρια καθαριότητα",
      amenities: ["toilet_paper", "soap"],
      wheelchairAccessible: true,
      isActive: true,
      createdBy: maria.userId
    },
    {
      name: "Μοναστηράκι Metro WC",
      location: { lat: 37.9763, lng: 23.7258 },
      description: "Καλή κατάσταση τις περισσότερες ώρες",
      amenities: ["toilet_paper", "soap", "airblower"],
      wheelchairAccessible: false,
      isActive: true,
      createdBy: john.userId
    },
    {
      name: "Coffee Island WC - Θεσσαλονίκη",
      location: { lat: 40.6401, lng: 22.9444 },
      description: "WC διαθέσιμο στους πελάτες",
      amenities: ["soap"],
      wheelchairAccessible: false,
      isActive: true,
      createdBy: admin.userId
    },
    {
      name: "Πάρκο Νεάπολης WC",
      location: { lat: 37.9934, lng: 23.7030 },
      description: "Δημοτική τουαλέτα σε πάρκο",
      amenities: ["toilet_paper"],
      wheelchairAccessible: true,
      isActive: true,
      createdBy: maria.userId
    },
    {
      name: "Shopping Mall WC - Golden Hall",
      location: { lat: 38.0208, lng: 23.8030 },
      description: "Πολύ καθαρό WC σε εμπορικό κέντρο",
      amenities: ["soap", "airblower", "toilet_paper"],
      wheelchairAccessible: true,
      isActive: true,
      createdBy: john.userId
    }
  ];

  const toilets = [];
  for (const t of toiletsData) {
    const doc = await Toilet.create({
      toiletId: uuid(),
      ...t,
      photos: [],
      averageRating: 0,
      cleanlinessRating: 0,
      layoutRating: 0,
      spaciousnessRating: 0,
      amenitiesRating: 0,
      reviewCount: 0
    });
    toilets.push(doc);
  }

  console.log("Toilets inserted");

  // Reviews
  const reviewsData = [
    {
      toilet: toilets[0],
      user: maria,
      ratings: { overall: 4, clean: 4, layout: 4, space: 4, amenities: 4 },
      text: "Καλό συνολικά."
    },
    {
      toilet: toilets[0],
      user: john,
      ratings: { overall: 3, clean: 3, layout: 3, space: 3, amenities: 3 },
      text: "Μέτριο."
    },
    {
      toilet: toilets[1],
      user: maria,
      ratings: { overall: 5, clean: 5, layout: 5, space: 5, amenities: 5 },
      text: "Πολύ καθαρό!"
    },
    {
      toilet: toilets[3],
      user: john,
      ratings: { overall: 3.5, clean: 3, layout: 4, space: 3.5, amenities: 3 },
      text: "Οκ για δημόσιο."
    },
    {
      toilet: toilets[4],
      user: maria,
      ratings: { overall: 4.5, clean: 5, layout: 4, space: 4.5, amenities: 5 },
      text: "Πολύ καλό!"
    }
  ];

  for (const r of reviewsData) {
    await Review.create({
      reviewId: uuid(),
      toiletId: r.toilet.toiletId,
      userId: r.user.userId,
      overallRating: r.ratings.overall,
      cleanlinessRating: r.ratings.clean,
      layoutRating: r.ratings.layout,
      spaciousnessRating: r.ratings.space,
      amenitiesRating: r.ratings.amenities,
      comment: r.text,
      isDeleted: false
    });
  }

  console.log("Reviews inserted");

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
