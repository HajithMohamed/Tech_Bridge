import { Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { isProviderOfferingAllowed } from '../utils/providerCapabilities';
import { AuthChallengeError, consumeAuthChallenge, deliverAuthChallenge } from '../services/authChallenges';

const registrationMessage = 'If this email can be registered, check your inbox for a verification link. Existing accounts can sign in or request a new verification email.';
const recoveryMessage = 'If an eligible account matches this email, we will send a link. Check your inbox and spam folder.';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role, studentProfile, providerProfile } = req.body;

    // Only allow student and provider roles through registration
    const allowedRoles = ['student', 'provider'];
    const userRole = allowedRoles.includes(role) ? role : 'student';

    if (userRole === 'provider') {
      const organizationType = providerProfile?.organizationType;
      const offerings = providerProfile?.opportunityCategories;
      if (!organizationType || !Array.isArray(offerings) || offerings.some((offering: unknown) => typeof offering !== 'string' || !isProviderOfferingAllowed(organizationType, offering))) {
        res.status(400).json({ success: false, message: 'Select only the services that are valid for your provider type.' });
        return;
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.requiresEmailVerification === true && !existingUser.emailVerifiedAt) await deliverAuthChallenge(existingUser, 'verify_email');
      res.status(202).json({ success: true, message: registrationMessage });
      return;
    }

    // Creator discovery is always an explicit, post-registration opt-in.
    const safeStudentProfile = userRole === 'student' && studentProfile && typeof studentProfile === 'object'
      ? Object.fromEntries(Object.entries(studentProfile as Record<string, unknown>).filter(([key]) => key !== 'creatorProfile'))
      : studentProfile;

    // Create new user
    const user = await User.create({
      fullName,
      email,
      password,
      role: userRole,
      requiresEmailVerification: true,
      ...(userRole === 'student'
        ? { studentProfile: safeStudentProfile }
        : {
            providerProfile: {
              ...providerProfile,
              verified: false,
              verificationStatus: 'PENDING',
              verificationDocumentId: undefined,
              verificationDocumentName: undefined,
              rejectionReason: undefined,
            },
          }),
    });

    await deliverAuthChallenge(user, 'verify_email');
    res.status(202).json({ success: true, message: registrationMessage });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      res.status(202).json({ success: true, message: registrationMessage });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user and explicitly include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password +tokenVersion'
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Compare password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    if (user.accountStatus === 'suspended') {
      res.status(403).json({ success: false, message: 'This account has been suspended. Contact TechBridge support if you believe this is a mistake.' });
      return;
    }

    if (user.requiresEmailVerification === true && !user.emailVerifiedAt) {
      res.status(403).json({ success: false, code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verify your email before signing in. You can request a new verification link.' });
      return;
    }

    if (user.role === 'provider' && user.providerProfile?.verificationStatus === 'REJECTED') {
      res.status(403).json({ success: false, message: user.providerProfile.rejectionReason || 'This provider account was not approved. Contact TechBridge support for details.' });
      return;
    }

    if (user.role === 'provider' && (
      user.providerProfile?.verified !== true ||
      user.providerProfile.verificationStatus !== 'VERIFIED'
    )) {
      res.status(403).json({
        success: false,
        message: 'This provider account is awaiting verification. Your organization is under review by the TechBridge team.',
      });
      return;
    }

    // Generate token
    const token = generateToken(user._id.toString(), user.role, user.tokenVersion || 0);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          studentProfile: user.studentProfile,
          providerProfile: user.providerProfile,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
};

/** Public requests deliberately reveal no account identity or challenge token. */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (user) await deliverAuthChallenge(user, 'password_reset');
    res.status(202).json({ success: true, message: recoveryMessage });
  } catch { res.status(503).json({ success: false, message: 'Account access is temporarily unavailable. Please try again.' }); }
};
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ email: req.body.email.toLowerCase(), requiresEmailVerification: true, emailVerifiedAt: { $exists: false } });
    if (user) await deliverAuthChallenge(user, 'verify_email');
    res.status(202).json({ success: true, message: recoveryMessage });
  } catch { res.status(503).json({ success: false, message: 'Account access is temporarily unavailable. Please try again.' }); }
};
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    await consumeAuthChallenge(req.body.token, 'password_reset', req.body.password);
    res.status(200).json({ success: true, message: 'Password changed. Sign in with your new password. Previous sessions have been signed out.' });
  } catch (error) {
    res.status(error instanceof AuthChallengeError ? 400 : 503).json({ success: false, message: error instanceof AuthChallengeError ? error.message : 'Account access is temporarily unavailable. Please try again.' });
  }
};
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    await consumeAuthChallenge(req.body.token, 'verify_email');
    res.status(200).json({ success: true, message: 'Email verified. You can now sign in. Provider organizations also require separate approval.' });
  } catch (error) {
    res.status(error instanceof AuthChallengeError ? 400 : 503).json({ success: false, message: error instanceof AuthChallengeError ? error.message : 'Account access is temporarily unavailable. Please try again.' });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          studentProfile: user.studentProfile,
          providerProfile: user.providerProfile,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/** PUT /api/auth/student-profile */
export const updateStudentProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const student = await User.findById(req.user!._id);
    if (!student || student.role !== 'student' || !student.studentProfile) {
      res.status(404).json({ success: false, message: 'Student profile not found.' });
      return;
    }

    const profile = req.body as Record<string, unknown>;
    const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length <= max ? value.trim() : undefined;
    const tags = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
        .map((item) => item.trim().slice(0, maxLength)).slice(0, maxItems)
      : undefined;

    const institution = text(profile.institution, 150);
    const location = text(profile.location, 100);
    const careerGoal = text(profile.careerGoal, 150);
    const skills = tags(profile.skills, 25, 50);

    if (!institution) { res.status(400).json({ success: false, message: 'Institution is required.' }); return; }
    if (!['ICT', 'ET', 'BST', 'other'].includes(profile.degree as string)) { res.status(400).json({ success: false, message: 'Select a valid degree programme.' }); return; }
    if (!Number.isInteger(profile.studyYear) || (profile.studyYear as number) < 1 || (profile.studyYear as number) > 6) { res.status(400).json({ success: false, message: 'Study year must be between 1 and 6.' }); return; }
    if (!skills?.length) { res.status(400).json({ success: false, message: 'Add at least one skill or interest.' }); return; }
    if (profile.availabilityHours !== undefined && (!Number.isInteger(profile.availabilityHours) || (profile.availabilityHours as number) < 0 || (profile.availabilityHours as number) > 168)) { res.status(400).json({ success: false, message: 'Availability must be between 0 and 168 hours.' }); return; }
    if (profile.preferredWorkType !== undefined && !['remote', 'on-site', 'hybrid', 'flexible'].includes(profile.preferredWorkType as string)) { res.status(400).json({ success: false, message: 'Select a valid work preference.' }); return; }

    const academicProfile = {
      institution,
      degree: profile.degree as 'ICT' | 'ET' | 'BST' | 'other',
      studyYear: profile.studyYear as number,
      skills,
      ...(location ? { location } : {}),
      ...(careerGoal ? { careerGoal } : {}),
      ...(typeof profile.availabilityHours === 'number' ? { availabilityHours: profile.availabilityHours } : {}),
      ...(profile.preferredWorkType ? { preferredWorkType: profile.preferredWorkType as 'remote' | 'on-site' | 'hybrid' | 'flexible' } : {}),
    };
    // Update only academic fields: replacing the parent can erase or restore stale
    // creator consent and also attempts to re-cast a live Mongoose nested object.
    const fields = Object.fromEntries(Object.entries(academicProfile).map(([key, value]) => [`studentProfile.${key}`, value]));
    const absent = ['location', 'careerGoal', 'availabilityHours', 'preferredWorkType'].filter((key) => !(key in academicProfile));
    const updated = await User.findOneAndUpdate(
      { _id: student._id, role: 'student', accountStatus: 'active' },
      { $set: fields, ...(absent.length ? { $unset: Object.fromEntries(absent.map((key) => [`studentProfile.${key}`, ''])) } : {}), $inc: { __v: 1 } },
      { new: true, runValidators: true }
    );
    if (!updated) { res.status(403).json({ success: false, message: 'An active student account is required.' }); return; }
    res.status(200).json({ success: true, message: 'Student profile updated.', data: { user: updated } });
  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({ success: false, message: 'Unable to update student profile.' });
  }
};
