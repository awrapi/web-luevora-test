/**
 * ================================================================
 * Schedule Controller — HTTP Request Handler
 * ================================================================
 */

import ScheduleService from '../../services/course/schedule.service.js';
import prisma from '../../config/database.js';
import { AI_CONFIG } from '../../config/ai.js';

export const fetchSchedules = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { status } = req.query;
    const data = await ScheduleService.fetchSchedules(tenantId, prisma, status);
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const createSchedule = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const result = await ScheduleService.createSchedule(tenantId, prisma, AI_CONFIG, req.body);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const fetchContacts = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { scheduleId } = req.query;
    const data = await ScheduleService.fetchContacts(tenantId, prisma, parseInt(scheduleId));
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const triggerFollowup = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { scheduleId } = req.body;
    const result = await ScheduleService.triggerFollowup(tenantId, prisma, AI_CONFIG, parseInt(scheduleId));
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const confirmContact = async (req, res, next) => {
  try {
    const { contactId, status } = req.body;
    const result = await ScheduleService.confirmContact(prisma, parseInt(contactId), status);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export default { fetchSchedules, createSchedule, fetchContacts, triggerFollowup, confirmContact };
