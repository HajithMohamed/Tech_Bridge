import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });

    if (existingAdmin) {
      console.log('Admin user already exists:');
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Name: ${existingAdmin.fullName}`);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      fullName: 'TechBridge Admin',
      email: 'admin@techbridge.lk',
      password: 'Admin@123',
      role: 'admin',
    });

    console.log('✅ Admin user created successfully:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Password: Admin@123`);
    console.log(`  Role: ${admin.role}`);
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedAdmin();
