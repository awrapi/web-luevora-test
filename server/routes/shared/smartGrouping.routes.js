import { Router } from 'express';
import { smartGroupingController, smartGroupingUpload } from '../../controllers/shared/smartGrouping.controller.js';

const router = Router();

/**
 * Central Smart Grouping Routes
 * Handles file grouping AI workflow for all entity types.
 *
 * Supported scopes: 'package' | 'kb' | 'adv-main' | 'adv-sub' | 'adv-addon'
 *
 * Endpoints:
 *   POST /smart-grouping/:scope/:entityId/analyze       → Upload + AI analyze
 *   POST /smart-grouping/:scope/:entityId/commit        → Save proposal to DB
 *   POST /smart-grouping/regenerate-title               → AI regen group title
 */

// Regenerate title — must be before /:scope/:entityId/* to avoid param collision
router.post('/regenerate-title', smartGroupingController.regenerateTitle);

// Analyze: upload files → Cloudinary → AI propose grouping
router.post(
  '/:scope/:entityId/analyze',
  smartGroupingUpload.array('files', 10),
  smartGroupingController.analyze
);

// Commit: save user-approved (or edited) grouping to DB
router.post('/:scope/:entityId/commit', smartGroupingController.commit);

// Rearrange: move existing files between contexts (no new upload)
router.post('/:scope/:entityId/rearrange', smartGroupingController.rearrange);

export default router;
