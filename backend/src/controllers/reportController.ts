import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Report from '../models/Report';
import { reportMessage } from '../services/messageReports';
import { messageId, messageText } from '../services/messagingPolicy';
import { AdminActionError } from '../services/adminUsers';

export const createReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetType, targetId, reason } = req.body;
    if (!['opportunity', 'resource', 'user', 'message', 'promotion_request'].includes(targetType) || !mongoose.isValidObjectId(targetId) || typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 1000) {
      res.status(400).json({ success: false, message: 'Provide a valid target and a reason between 5 and 1000 characters.' });
      return;
    }
    const report = targetType === 'message'
      ? await reportMessage(req.user!._id, messageId(targetId), messageText(reason, 5, 1000))
      : await Report.create({ reporterId: req.user!._id, targetType, targetId, reason: reason.trim() });
    res.status(201).json({ success: true, message: 'Report submitted for review.', data: { report } });
  } catch (error: unknown) {
    if (error instanceof AdminActionError) { res.status(error.statusCode).json({ success: false, message: error.message }); return; }
    if ((error as { code?: number }).code === 11000) { res.status(409).json({ success: false, message: 'You have already reported this item.' }); return; }
    res.status(500).json({ success: false, message: 'Unable to submit report.' });
  }
};
