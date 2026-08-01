/**
 * Reschedule Routes — Reschedule Detection & Management
 * Ported from: api_schedule.php (reschedule-related actions)
 */
import express from 'express';
import ScheduleService from '../../services/course/schedule.service.js';

const router = express.Router();

// GET /api/course/reschedule/requests — Fetch reschedule requests
router.get('/requests', async (req, res) => {
  try {
    const requests = await req.db.query(
      `SELECT rr.*, 
         COALESCE(l.saved_name, l.push_name, rr.phone) as display_name,
         cs.schedule_date as original_date, cs.schedule_time as original_time,
         cs.service_label
       FROM reschedule_requests rr
       LEFT JOIN leads l ON rr.phone = l.phone
       LEFT JOIN customer_schedules cs ON rr.customer_schedule_id = cs.id
       WHERE rr.status = ?
       ORDER BY rr.created_at DESC`,
      [req.query.status || 'pending']
    );
    res.json({ status: true, requests });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/course/reschedule/approve
router.post('/approve', async (req, res) => {
  try {
    const { id, new_date, new_time } = req.body;
    if (!id) throw new Error('Request ID wajib');

    // Update reschedule request
    await req.db.execute(
      `UPDATE reschedule_requests SET status='approved', approved_date=?, approved_time=?, actioned_at=NOW() WHERE id=?`,
      [new_date, new_time, id]
    );

    // Get the customer_schedule_id to update
    const rows = await req.db.query(`SELECT customer_schedule_id FROM reschedule_requests WHERE id=?`, [id]);
    if (rows.length > 0 && rows[0].customer_schedule_id) {
      await req.db.execute(
        `UPDATE customer_schedules SET schedule_date=?, schedule_time=?, status='rescheduled', updated_at=NOW() WHERE id=?`,
        [new_date, new_time || null, rows[0].customer_schedule_id]
      );
    }

    res.json({ status: true, message: 'Reschedule disetujui' });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

// POST /api/course/reschedule/reject
router.post('/reject', async (req, res) => {
  try {
    const { id, reason } = req.body;
    if (!id) throw new Error('Request ID wajib');

    await req.db.execute(
      `UPDATE reschedule_requests SET status='rejected', reject_reason=?, actioned_at=NOW() WHERE id=?`,
      [reason || '', id]
    );

    res.json({ status: true, message: 'Reschedule ditolak' });
  } catch (err) { res.status(500).json({ status: false, message: err.message }); }
});

export default router;
