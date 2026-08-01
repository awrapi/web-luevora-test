import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware } from '../middleware/tenant.middleware.js';
import { businessTypeGuard } from '../middleware/businessType.middleware.js';

// Shared Routes
import authRoutes from './shared/auth.routes.js';
import adminRoutes from './shared/admin.routes.js';
import leadsRoutes from './shared/leads.routes.js';
import publicRoutes from './shared/public.routes.js';
import webhookRoutes from './shared/webhook.routes.js';
import knowledgeBaseRoutes from './shared/knowledgeBase.routes.js';
import bankingRoutes from './shared/banking.routes.js';
import configurationRoutes from './shared/configuration.routes.js';
import eventsRoutes from './shared/events.routes.js';
import offersRoutes from './shared/offers.routes.js';
import aiRoutes from './ai.routes.js';
import kbMediaRoutes from './shared/kbMedia.routes.js';
import testRagRoutes from './shared/testRag.routes.js';
import transactionRoutes from './shared/transaction.routes.js';
import adminCopilotRoutes from './shared/adminCopilot.routes.js';
import emailRoutes from './shared/email.routes.js';
import metaRoutes from './shared/meta.routes.js';
import instagramRoutes from './shared/instagram.routes.js';
import zernioRoutes from './shared/zernio.routes.js';
import telegramRoutes from './shared/telegram.routes.js';
import notificationRoutes from './shared/notification.routes.js';
import subscriptionRoutes from './shared/subscription.routes.js';
import dashboardRoutes from './shared/dashboard.routes.js';

import smartGroupingRoutes from './shared/smartGrouping.routes.js';

// Legacy-compatible shared routes (kept from previous integration)
import customerRoutes from './shared/customer.routes.js';
import labelRoutes from './shared/label.routes.js';
import productRoutes from './shared/product.routes.js';
import newLeadRoutes from './lead.routes.js';

// Course Routes
import scheduleRoutes from './course/schedule.routes.js';
import rescheduleRoutes from './course/reschedule.routes.js';
import courseCustomerRoutes from './course/customer.routes.js';
import formerCustomerRoutes from './course/formerCustomer.routes.js';
import serviceLabelRoutes from './course/serviceLabel.routes.js';

// Rental Routes
import rentalRequestRoutes from './rental/rentalRequest.routes.js';
import rentalUnitRoutes from './rental/rentalUnit.routes.js';

// Retail Routes
import inventoryRoutes from './retail/inventory.routes.js';

// Travel Routes
import bookingRoutes from './travel/booking.routes.js';
import invoiceRoutes from './travel/invoice.routes.js';
import customerRequestRoutes from './travel/customerRequest.routes.js';
import packageMediaRoutes from './travel/packageMedia.routes.js';
import advancedPackageRoutes from './travel/advancedPackage.routes.js';
import addonRoutes from './travel/addon.routes.js';
import centralInfoRoutes from './travel/centralInfo.routes.js';
import refundRoutes from './travel/refund.routes.js';
import orderFormConfigRoutes from './travel/orderFormConfig.routes.js';
import systemGuiderRoutes from './travel/systemGuider.routes.js';
import cmCopilotRoutes from './travel/cmCopilot.routes.js';
import aiTestRoutes from './aiTest.routes.js';
import creditRoutes from './credit.routes.js';

const router = express.Router();

// Public routes
router.use('/public', publicRoutes);
router.use('/events', eventsRoutes);
router.use('/test-rag', testRagRoutes);

// Webhook & Public Integration Routes (These handle auth internally if needed)
router.use('/webhook', webhookRoutes);
router.use('/meta', metaRoutes);
router.use('/instagram', instagramRoutes);
router.use('/zernio', zernioRoutes);
router.use('/telegram', telegramRoutes);

// AI Configuration Routes
router.use('/ai', authMiddleware, tenantMiddleware, aiRoutes);

// Shared Admin Routes
router.use('/auth', authRoutes);
router.use('/dashboard', authMiddleware, tenantMiddleware, dashboardRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/admin', authMiddleware, tenantMiddleware, adminRoutes);
router.use('/transactions', authMiddleware, tenantMiddleware, transactionRoutes);
router.use('/admin-copilot', authMiddleware, tenantMiddleware, adminCopilotRoutes);
router.use('/email', authMiddleware, tenantMiddleware, emailRoutes);
router.use('/leads', authMiddleware, tenantMiddleware, leadsRoutes);
router.use('/knowledge-base', authMiddleware, tenantMiddleware, knowledgeBaseRoutes);
router.use('/knowledge-base/packages', authMiddleware, tenantMiddleware, kbMediaRoutes);
router.use('/banking', authMiddleware, tenantMiddleware, bankingRoutes);
router.use('/configuration', authMiddleware, tenantMiddleware, configurationRoutes);
router.use('/offers', authMiddleware, tenantMiddleware, offersRoutes);
router.use('/notifications', authMiddleware, tenantMiddleware, notificationRoutes);

// Central Smart Grouping (analyze → modal → commit) — all scopes
router.use('/smart-grouping', authMiddleware, tenantMiddleware, smartGroupingRoutes);

// Legacy / compatibility routes
router.use('/lead', authMiddleware, tenantMiddleware, newLeadRoutes);
router.use('/customers', authMiddleware, tenantMiddleware, customerRoutes);
router.use('/labels', authMiddleware, tenantMiddleware, labelRoutes);
router.use('/products', authMiddleware, tenantMiddleware, productRoutes);

// Course-specific routes
router.use('/course/schedule', authMiddleware, tenantMiddleware, businessTypeGuard(['course']), scheduleRoutes);
router.use('/course/reschedule', authMiddleware, tenantMiddleware, businessTypeGuard(['course']), rescheduleRoutes);
router.use('/course/customers', authMiddleware, tenantMiddleware, businessTypeGuard(['course']), courseCustomerRoutes);
router.use('/course/services', authMiddleware, tenantMiddleware, businessTypeGuard(['course']), serviceLabelRoutes);
router.use('/course/mantan', authMiddleware, tenantMiddleware, businessTypeGuard(['course']), formerCustomerRoutes);

// Rental-specific routes
router.use('/rental/requests', authMiddleware, tenantMiddleware, businessTypeGuard(['rental']), rentalRequestRoutes);
router.use('/rental/unit', authMiddleware, tenantMiddleware, businessTypeGuard(['rental']), rentalUnitRoutes);

// Retail-specific routes
router.use('/retail/inventory', authMiddleware, tenantMiddleware, businessTypeGuard(['retail']), inventoryRoutes);

// Travel-specific routes
router.use('/travel/bookings', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), bookingRoutes);
router.use('/travel/packages', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), packageMediaRoutes);
router.use('/travel/invoices', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), invoiceRoutes);
router.use('/travel/customer-requests', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), customerRequestRoutes);
router.use('/travel/advanced-packages', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), advancedPackageRoutes);
router.use('/travel/addons', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), addonRoutes);
router.use('/travel/central-info', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), centralInfoRoutes);
router.use('/travel/refunds', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), refundRoutes);
router.use('/travel/order-form', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), orderFormConfigRoutes);
router.use('/travel/system-guider', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), systemGuiderRoutes);
router.use('/travel/cm-copilot', authMiddleware, tenantMiddleware, businessTypeGuard(['travel']), cmCopilotRoutes);

// AI Test Playground
router.use('/ai-test', authMiddleware, tenantMiddleware, aiTestRoutes);

// AI Credit Management (Per-Tenant)
router.use('/ai-credits', authMiddleware, tenantMiddleware, creditRoutes);

export default router;
