"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImpactStats = void 0;
const Application_1 = __importDefault(require("../models/Application"));
const Opportunity_1 = __importDefault(require("../models/Opportunity"));
const Resource_1 = __importDefault(require("../models/Resource"));
const User_1 = __importDefault(require("../models/User"));
const toCountMap = (buckets) => Object.fromEntries(buckets.map((bucket) => [bucket._id, bucket.count]));
/** GET /api/dashboard/stats */
const getImpactStats = async (_req, res) => {
    try {
        const [userAggregate, opportunityAggregate, applicationAggregate, resourceAggregate] = await Promise.all([
            User_1.default.aggregate([
                { $match: { role: 'student' } },
                { $count: 'totalStudents' },
            ]),
            Opportunity_1.default.aggregate([
                { $match: { status: 'open', applicationDeadline: { $gte: new Date() } } },
                { $count: 'totalOpenOpportunities' },
            ]),
            Application_1.default.aggregate([
                {
                    $facet: {
                        totalApplications: [{ $count: 'count' }],
                        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
                    },
                },
            ]),
            Resource_1.default.aggregate([
                {
                    $facet: {
                        totalResourceListings: [{ $count: 'count' }],
                        byAccessType: [{ $group: { _id: '$accessType', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
                    },
                },
            ]),
        ]);
        const applicationData = applicationAggregate[0] || { totalApplications: [], byStatus: [] };
        const resourceData = resourceAggregate[0] || { totalResourceListings: [], byAccessType: [] };
        res.status(200).json({
            success: true,
            data: {
                totalStudents: userAggregate[0]?.totalStudents || 0,
                totalOpenOpportunities: opportunityAggregate[0]?.totalOpenOpportunities || 0,
                totalApplications: applicationData.totalApplications[0]?.count || 0,
                totalResourceListings: resourceData.totalResourceListings[0]?.count || 0,
                applicationsByStatus: toCountMap(applicationData.byStatus),
                resourceListingsByAccessType: toCountMap(resourceData.byAccessType),
            },
        });
    }
    catch (error) {
        console.error('Impact dashboard stats error:', error);
        res.status(500).json({ success: false, message: 'Unable to load impact statistics.' });
    }
};
exports.getImpactStats = getImpactStats;
//# sourceMappingURL=dashboardController.js.map