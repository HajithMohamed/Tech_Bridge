import { Request, Response } from 'express';
import Application from '../models/Application';
import Opportunity from '../models/Opportunity';
import Resource from '../models/Resource';
import User from '../models/User';

type CountBucket = { _id: string; count: number };

const toCountMap = (buckets: CountBucket[]): Record<string, number> =>
  Object.fromEntries(buckets.map((bucket) => [bucket._id, bucket.count]));

/** GET /api/dashboard/stats */
export const getImpactStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [userAggregate, opportunityAggregate, applicationAggregate, resourceAggregate] = await Promise.all([
      User.aggregate<{ totalStudents: number }>([
        { $match: { role: 'student' } },
        { $count: 'totalStudents' },
      ]),
      Opportunity.aggregate<{ totalOpenOpportunities: number }>([
        { $match: { status: 'open', applicationDeadline: { $gte: new Date() } } },
        { $count: 'totalOpenOpportunities' },
      ]),
      Application.aggregate<{
        totalApplications: Array<{ count: number }>;
        byStatus: CountBucket[];
      }>([
        {
          $facet: {
            totalApplications: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
          },
        },
      ]),
      Resource.aggregate<{
        totalResourceListings: Array<{ count: number }>;
        byAccessType: CountBucket[];
      }>([
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
  } catch (error) {
    console.error('Impact dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Unable to load impact statistics.' });
  }
};
