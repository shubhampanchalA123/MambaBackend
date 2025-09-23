# Dummy Users Seeding Task

## ✅ Completed Tasks
- [x] Created `scripts/seedUsers.js` with 100 dummy users generator
- [x] Added `seed:users` script to package.json
- [x] Script includes realistic Indian names and data
- [x] Handles duplicate email errors gracefully
- [x] Sets `isVerified: true` for testing purposes
- [x] Added `isActive` field to User model for user management
- [x] Fixed search functionality to work with full names (space-separated)
- [x] Created delete user API with role-based access control
- [x] Added `isActive: true` field to User model
- [x] All dummy users are set as active by default

## 📋 User Details Generated
- **Names**: Realistic Indian first and last names
- **Email**: Pattern: `firstname.lastname@domain.com`
- **Password**: `Test@123` (same for all users)
- **User Roles**: Coach, Parent, Player (randomly assigned)
- **Gender**: Male, Female, Other (randomly assigned)
- **Mobile**: Random 10-digit numbers with country codes
- **DOB**: Random dates (18-70 years old)
- **Verification**: Set to `true` (bypasses OTP verification)

## 🚀 How to Run

### Method 1: Using npm script
```bash
npm run seed:users
```

### Method 2: Direct node execution
```bash
node scripts/seedUsers.js
```

## 🔧 Prerequisites
1. Make sure your MongoDB is running
2. Your `.env` file should have `MONGODB_URI` configured
3. Run from project root directory

## 📊 Sample Output
```
🌱 Starting user seeding process...
✅ Connected to MongoDB
📝 Generated 100 dummy users
✅ Inserted batch 1: 10 users
✅ Inserted batch 2: 10 users
...
🎉 Successfully seeded 100 users to the database!
📋 Sample user credentials:
   Email: user1.sharma1@gmail.com
   Password: Test@123
```

## 🔍 Testing the Seeded Data
After seeding, you can test login with:
- **Email**: Any generated email (e.g., `aarav.sharma1@gmail.com`)
- **Password**: `Test@123`
- **User Role**: Will be randomly assigned (Coach/Parent/Player)

## ⚠️ Important Notes
- Script handles duplicate emails gracefully
- All users are pre-verified (isVerified: true)
- Password is hashed automatically by the User model
- Run this only in development/testing environment

## 🔧 User Management Features Added
- **isActive Field**: Added to User model for user activation/deactivation
- **Default Active**: All existing and new users are active by default
- **Auto-included in Responses**: isActive field is automatically included in all user API responses (login, profile, registration, etc.)
- **Separate User Management**: Created dedicated `userController.js` and `userRoutes.js` for better architecture
- **Future Use**: You can now create endpoints to toggle user active status

## 🆕 New API Structure (Separated Architecture)

### User Management Endpoints (Separate from Auth)
**Base URL**: `/api/users`

#### Get All Users
```bash
GET /api/users?role=player&isActive=true&searchText=name&page=1&limit=10
```

#### Get Users by Role
```bash
GET /api/users/role?role=coach&isActive=true&searchText=john
```

#### Delete User (Admin/Coach Only)
```bash
DELETE /api/users/delete/{userId}
Authorization: Bearer {token}
```

**Security Features:**
- ✅ **Role-based Access**: Only coaches and admins can delete users
- ✅ **Self-protection**: Users cannot delete their own accounts
- ✅ **User Validation**: Checks if user exists before deletion
- ✅ **Authentication Required**: Protected route with JWT token

### Authentication Endpoints (Auth Only)
**Base URL**: `/api/auth`
- POST `/register` - User registration
- POST `/login` - User login
- POST `/verify-otp` - OTP verification
- POST `/forgot-password` - Password reset
- POST `/reset-password` - Reset password
- GET `/profile` - Get user profile
- PUT `/update-profile` - Update profile
- POST `/logout` - User logout

### API Features:
- ✅ **Separated Architecture**: User management is now separate from authentication
- ✅ **Flexible Filtering**: Role, active status, and search text support
- ✅ **Pagination Support**: With metadata
- ✅ **Optimized Queries**: Only fetches required fields
- ✅ **Error Handling**: Validates role and handles errors gracefully
