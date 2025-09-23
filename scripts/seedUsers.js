const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Sample data arrays for generating realistic dummy data
const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Dhruv', 'Rudra', 'Virat', 'Aryan', 'Advik', 'Rian', 'Aarush', 'Kabir', 'Veer',
  'Priya', 'Ananya', 'Aadhya', 'Pari', 'Diya', 'Ira', 'Riya', 'Anika', 'Myra', 'Sara',
  'Aarohi', 'Anvi', 'Navya', 'Inaya', 'Siya', 'Zara', 'Mira', 'Kia', 'Lara', 'Tara'
];

const lastNames = [
  'Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Jain', 'Agarwal', 'Mehta', 'Shah',
  'Reddy', 'Rao', 'Nair', 'Menon', 'Pillai', 'Das', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Roy',
  'Khanna', 'Kapoor', 'Malhotra', 'Chopra', 'Saxena', 'Mathur', 'Agarwal', 'Bhat', 'Kulkarni', 'Desai'
];

const userRoles = ['Coach', 'Parent', 'Player'];
const genders = ['Male', 'Female', 'Other'];
const countryCodes = ['+91', '+1', '+44', '+65', '+61', '+86', '+81', '+49', '+33', '+39'];

// Generate random date of birth (18-70 years old)
const generateRandomDOB = () => {
  const today = new Date();
  const minAge = 18;
  const maxAge = 70;
  const randomAge = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
  const birthYear = today.getFullYear() - randomAge;
  const birthMonth = Math.floor(Math.random() * 12);
  const birthDay = Math.floor(Math.random() * 28) + 1; // Avoid date issues
  return new Date(birthYear, birthMonth, birthDay);
};

// Generate random mobile number
const generateMobileNumber = () => {
  let number = '';
  for (let i = 0; i < 10; i++) {
    number += Math.floor(Math.random() * 10);
  }
  return number;
};

// Generate random email
const generateEmail = (firstName, lastName, index) => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
  const randomDomain = domains[Math.floor(Math.random() * domains.length)];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${randomDomain}`;
};

// Generate dummy users
const generateDummyUsers = (count) => {
  const users = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const userRole = userRoles[Math.floor(Math.random() * userRoles.length)];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const countryCode = countryCodes[Math.floor(Math.random() * countryCodes.length)];

    users.push({
      username: firstName,
      surname: lastName,
      email: generateEmail(firstName, lastName, i + 1),
      password: 'Test@123', // Default password for all dummy users
      userRole: userRole,
      isVerified: true, // Set to true for testing purposes
      isActive: true, // Set to true so users are active by default
      countryCode: countryCode,
      mobileNumber: generateMobileNumber(),
      avatar: '', // Optional field
      dateOfBirth: generateRandomDOB(),
      gender: gender
    });
  }

  return users;
};

// Connect to database and seed users
const seedUsers = async () => {
  try {
    console.log('🌱 Starting user seeding process...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Generate dummy users
    const dummyUsers = generateDummyUsers(100);
    console.log('📝 Generated 100 dummy users');

    // Insert users in batches to avoid memory issues
    const batchSize = 10;
    let insertedCount = 0;

    for (let i = 0; i < dummyUsers.length; i += batchSize) {
      const batch = dummyUsers.slice(i, i + batchSize);

      try {
        const result = await User.insertMany(batch, { ordered: false });
        insertedCount += result.length;
        console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${result.length} users`);
      } catch (error) {
        if (error.name === 'BulkWriteError') {
          // Handle duplicate key errors gracefully
          const insertedInBatch = error.result.nInserted || 0;
          insertedCount += insertedInBatch;
          console.log(`⚠️  Batch ${Math.floor(i / batchSize) + 1}: ${insertedInBatch}/${batch.length} users inserted (some duplicates skipped)`);
        } else {
          console.error(`❌ Error in batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        }
      }
    }

    console.log(`🎉 Successfully seeded ${insertedCount} users to the database!`);
    console.log('📋 Sample user credentials:');
    console.log('   Email: user1.sharma1@gmail.com');
    console.log('   Password: Test@123');
    console.log('   (All users follow pattern: firstname.lastname@domain.com)');

  } catch (error) {
    console.error('❌ Error seeding users:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
};

// Run the seeder
if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers, generateDummyUsers };
