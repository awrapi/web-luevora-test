import express from 'express';
import ScheduleController from '../../controllers/course/schedule.controller.js';

const router = express.Router();

router.get('/list', ScheduleController.fetchSchedules);
router.post('/create', ScheduleController.createSchedule);
router.get('/contacts', ScheduleController.fetchContacts);
router.post('/followup/trigger', ScheduleController.triggerFollowup);
router.post('/contact/confirm', ScheduleController.confirmContact);

export default router;
