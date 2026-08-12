"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = __importDefault(require("./models/User"));
dotenv_1.default.config();
const seedAdmin = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        // Check if admin already exists
        const existingAdmin = await User_1.default.findOne({ role: 'admin' });
        if (existingAdmin) {
            console.log('Admin user already exists:');
            console.log(`  Email: ${existingAdmin.email}`);
            console.log(`  Name: ${existingAdmin.fullName}`);
            process.exit(0);
        }
        // Create admin user
        const admin = await User_1.default.create({
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
    }
    catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    }
};
seedAdmin();
//# sourceMappingURL=seed.js.map