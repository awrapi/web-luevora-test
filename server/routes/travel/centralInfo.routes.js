import express from 'express';
import { getCancellations, getModifications, getCustomerManagement, updateCustomerManagementStatus, approveDateRequest, rejectDateRequest, getStatusInformation, getInfoRequests, instructInfoRequest, takeoverInfoRequest, resolveInfoRequest } from '../../controllers/travel/centralInfo.controller.js';

const router = express.Router();

// GET /api/central-info/cancellations
router.get('/cancellations', getCancellations);

// GET /api/central-info/modifications
router.get('/modifications', getModifications);

// GET /api/central-info/customer-management
router.get('/customer-management', getCustomerManagement);

// PUT /api/central-info/customer-management/:id
router.put('/customer-management/:id', updateCustomerManagementStatus);

// PUT /api/central-info/customer-management/:id/approve-date
router.put('/customer-management/:id/approve-date', approveDateRequest);

// PUT /api/central-info/customer-management/:id/reject-date
router.put('/customer-management/:id/reject-date', rejectDateRequest);

// GET /api/central-info/status-information
router.get('/status-information', getStatusInformation);

// ================================================================
// CENTRAL INFO REQUESTS (AI Knowledge Gap)
// ================================================================

// GET /api/central-info/info-requests
router.get('/info-requests', getInfoRequests);

// PUT /api/central-info/info-requests/:id/instruct
router.put('/info-requests/:id/instruct', instructInfoRequest);

// PUT /api/central-info/info-requests/:id/takeover
router.put('/info-requests/:id/takeover', takeoverInfoRequest);

// PUT /api/central-info/info-requests/:id/resolve
router.put('/info-requests/:id/resolve', resolveInfoRequest);

export default router;
