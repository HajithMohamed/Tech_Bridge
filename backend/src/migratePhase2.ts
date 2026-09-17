import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Application from './models/Application';
import Resource from './models/Resource';
import ResourceRequest from './models/ResourceRequest';

dotenv.config();

const legacyJustification = 'Legacy submission: no self-declared need statement was collected before the Phase 2 update.';

/**
 * Safely backfills only records created before Phase 2. New submissions are
 * still validated normally in their controllers and schemas.
 */
const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);

    const applications = await Application.find({ $or: [{ justification: { $exists: false } }, { selfDeclaredNeed: { $exists: false } }] });
    for (const application of applications) {
      await Application.updateOne({ _id: application._id }, {
        $set: {
          justification: application.justification || legacyJustification,
          selfDeclaredNeed: application.selfDeclaredNeed || 'medium',
        },
      });
    }

    const requests = await ResourceRequest.find({ $or: [{ justification: { $exists: false } }, { selfDeclaredNeed: { $exists: false } }, { resourceCategory: { $exists: false } }] });
    for (const request of requests) {
      const resource = await Resource.findById(request.resourceId).select('category');
      await ResourceRequest.updateOne({ _id: request._id }, {
        $set: {
          justification: request.justification || legacyJustification,
          selfDeclaredNeed: request.selfDeclaredNeed || 'medium',
          resourceCategory: request.resourceCategory || resource?.category || 'other',
        },
      });
    }

    console.log(`Phase 2 migration complete: ${applications.length} applications and ${requests.length} resource requests updated.`);
    process.exit(0);
  } catch (error) {
    console.error('Phase 2 migration failed:', error);
    process.exit(1);
  }
};

void migrate();
