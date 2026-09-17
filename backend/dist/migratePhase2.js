"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const Application_1 = __importDefault(require("./models/Application"));
const Resource_1 = __importDefault(require("./models/Resource"));
const ResourceRequest_1 = __importDefault(require("./models/ResourceRequest"));
dotenv_1.default.config();
const legacyJustification = 'Legacy submission: no self-declared need statement was collected before the Phase 2 update.';
/**
 * Safely backfills only records created before Phase 2. New submissions are
 * still validated normally in their controllers and schemas.
 */
const migrate = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        const applications = await Application_1.default.find({ $or: [{ justification: { $exists: false } }, { selfDeclaredNeed: { $exists: false } }] });
        for (const application of applications) {
            await Application_1.default.updateOne({ _id: application._id }, {
                $set: {
                    justification: application.justification || legacyJustification,
                    selfDeclaredNeed: application.selfDeclaredNeed || 'medium',
                },
            });
        }
        const requests = await ResourceRequest_1.default.find({ $or: [{ justification: { $exists: false } }, { selfDeclaredNeed: { $exists: false } }, { resourceCategory: { $exists: false } }] });
        for (const request of requests) {
            const resource = await Resource_1.default.findById(request.resourceId).select('category');
            await ResourceRequest_1.default.updateOne({ _id: request._id }, {
                $set: {
                    justification: request.justification || legacyJustification,
                    selfDeclaredNeed: request.selfDeclaredNeed || 'medium',
                    resourceCategory: request.resourceCategory || resource?.category || 'other',
                },
            });
        }
        console.log(`Phase 2 migration complete: ${applications.length} applications and ${requests.length} resource requests updated.`);
        process.exit(0);
    }
    catch (error) {
        console.error('Phase 2 migration failed:', error);
        process.exit(1);
    }
};
void migrate();
//# sourceMappingURL=migratePhase2.js.map