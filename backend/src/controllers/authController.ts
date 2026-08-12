import { Request, Response } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/jwt';

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role, studentProfile, providerProfile } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'A user with this email already exists',
      });
      return;
    }

    // Only allow student and provider roles through registration
    const allowedRoles = ['student', 'provider'];
    const userRole = allowedRoles.includes(role) ? role : 'student';

    // Create new user
    const user = await User.create({
      fullName,
      email,
      password,
      role: userRole,
      ...(userRole === 'student'
        ? { studentProfile }
        : {
            providerProfile: {
              ...providerProfile,
              verified: false,
              verificationStatus: 'PENDING',
            },
          }),
    });

    // Providers must be reviewed before they can access the provider portal.
    const isPendingProvider = user.role === 'provider' && !user.providerProfile?.verified;
    const token = isPendingProvider ? undefined : generateToken(user._id.toString(), user.role);

    res.status(201).json({
      success: true,
      message: isPendingProvider
        ? 'Thank you for registering. Your organization is under review. You will be able to publish opportunities after verification by the TechBridge team.'
        : 'Registration successful',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
          providerProfile: user.providerProfile,
          createdAt: user.createdAt,
        },
        ...(token ? { token } : {}),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
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
      '+password'
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
    const token = generateToken(user._id.toString(), user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          studentProfile: user.studentProfile,
          providerProfile: user.providerProfile,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
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
    const portfolioUrl = text(profile.portfolioUrl, 500);
    const skills = tags(profile.skills, 25, 50);
    const learningGoals = tags(profile.learningGoals, 12, 100);
    const certifications = tags(profile.certifications, 12, 160);

    if (!institution) { res.status(400).json({ success: false, message: 'Institution is required.' }); return; }
    if (!['ICT', 'ET', 'BST', 'other'].includes(profile.degree as string)) { res.status(400).json({ success: false, message: 'Select a valid degree programme.' }); return; }
    if (!Number.isInteger(profile.studyYear) || (profile.studyYear as number) < 1 || (profile.studyYear as number) > 6) { res.status(400).json({ success: false, message: 'Study year must be between 1 and 6.' }); return; }
    if (!skills?.length) { res.status(400).json({ success: false, message: 'Add at least one skill or interest.' }); return; }
    if (profile.availabilityHours !== undefined && (!Number.isInteger(profile.availabilityHours) || (profile.availabilityHours as number) < 0 || (profile.availabilityHours as number) > 168)) { res.status(400).json({ success: false, message: 'Availability must be between 0 and 168 hours.' }); return; }
    if (profile.preferredWorkType !== undefined && !['remote', 'on-site', 'hybrid', 'flexible'].includes(profile.preferredWorkType as string)) { res.status(400).json({ success: false, message: 'Select a valid work preference.' }); return; }
    if (portfolioUrl && !/^https?:\/\//i.test(portfolioUrl)) { res.status(400).json({ success: false, message: 'Portfolio URL must start with http:// or https://.' }); return; }

    student.studentProfile = {
      institution,
      degree: profile.degree as 'ICT' | 'ET' | 'BST' | 'other',
      studyYear: profile.studyYear as number,
      skills,
      ...(location ? { location } : {}),
      ...(careerGoal ? { careerGoal } : {}),
      ...(typeof profile.availabilityHours === 'number' ? { availabilityHours: profile.availabilityHours } : {}),
      ...(profile.preferredWorkType ? { preferredWorkType: profile.preferredWorkType as 'remote' | 'on-site' | 'hybrid' | 'flexible' } : {}),
      ...(learningGoals ? { learningGoals } : {}),
      ...(certifications ? { certifications } : {}),
      ...(portfolioUrl ? { portfolioUrl } : {}),
    };
    await student.save();
    res.status(200).json({ success: true, message: 'Student profile updated.', data: { user: student } });
  } catch (error) {
    console.error('Update student profile error:', error);
    res.status(500).json({ success: false, message: 'Unable to update student profile.' });
  }
};
