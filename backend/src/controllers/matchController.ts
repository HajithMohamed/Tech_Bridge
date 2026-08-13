import { Request, Response } from 'express';
import Opportunity from '../models/Opportunity';
import User from '../models/User';
import { matchScore, getResourceForSkill, type MatchBreakdown } from '../utils/matchEngine';

const providerSelect =
  'fullName email providerProfile.organizationName providerProfile.organizationType providerProfile.verified';

/**
 * GET /api/opportunities/matched
 *
 * For the currently logged-in student, return all open opportunities
 * sorted by match score descending. Each opportunity includes:
 *   matchPercentage, matchedSkills, missingSkills, skillResources
 */
export const getMatchedOpportunities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Fetch the student with their profile
    const student = await User.findById(req.user!._id);

    if (!student || student.role !== 'student') {
      res.status(403).json({
        success: false,
        message: 'Only students can access matched opportunities.',
      });
      return;
    }

    if (!student.studentProfile) {
      res.status(400).json({
        success: false,
        message: 'Complete your student profile to receive matches.',
      });
      return;
    }

    // Auto-expire past-deadline opportunities
    await Opportunity.updateMany(
      { status: 'open', applicationDeadline: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    // Fetch all open opportunities
    const opportunities = await Opportunity.find({ status: 'open' })
      .populate('providerId', providerSelect)
      .lean();

    // Score each opportunity against the student profile
    const scored = opportunities.map((opp) => {
      const match: MatchBreakdown = matchScore(student.studentProfile!, opp as any);

      // Build resource suggestions for missing skills
      const skillResources = match.missingSkills.map((skill) => ({
        skill,
        ...getResourceForSkill(skill),
      }));

      return {
        ...opp,
        matchPercentage: match.matchPercentage,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
        skillScore: match.skillScore,
        careerRelevanceScore: match.careerRelevanceScore,
        locationScore: match.locationScore,
        skillResources,
      };
    });

    // Sort by match percentage descending
    scored.sort((a, b) => b.matchPercentage - a.matchPercentage);

    res.status(200).json({
      success: true,
      data: {
        opportunities: scored,
        studentSkills: student.studentProfile.skills,
        careerGoal: student.studentProfile.careerGoal || '',
      },
    });
  } catch (error) {
    console.error('Matched opportunities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching matched opportunities.',
    });
  }
};
