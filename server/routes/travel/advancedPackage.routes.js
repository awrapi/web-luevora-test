import { Router } from 'express';
import { advancedPackageService } from '../../services/travel/advancedPackage.service.js';
import { advancedPackageUploadController, packageMediaUpload } from '../../controllers/travel/advancedPackageUpload.controller.js';
import { advancedPackageUploadService } from '../../services/travel/advancedPackageUpload.service.js';

const router = Router();

// GET /travel/advanced-packages?type=private
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const type = req.query.type || 'private';
    // If type === 'all', pass null or a special flag to getAll if supported, 
    // but looking at getAll, it probably filters by type literally.
    // Let's just fetch all by doing multiple queries if needed, or update service.
    const packages = type === 'all' 
      ? await Promise.all([
          advancedPackageService.getAll(tenantId, 'private'),
          advancedPackageService.getAll(tenantId, 'open_trip'),
          advancedPackageService.getAll(tenantId, 'others')
        ]).then(results => results.flat())
      : await advancedPackageService.getAll(tenantId, type);
    res.json({ status: true, data: packages });
  } catch (err) {
    console.error('[AdvPkg] getAll error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// GET /travel/advanced-packages/:id
router.get('/:id', async (req, res) => {
  try {
    const pkg = await advancedPackageService.getById(req.tenant.id, req.params.id);
    if (!pkg) return res.status(404).json({ status: false, message: 'Package not found' });
    res.json({ status: true, data: pkg });
  } catch (err) {
    console.error('[AdvPkg] getById error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// POST /travel/advanced-packages
router.post('/', async (req, res) => {
  try {
    const pkg = await advancedPackageService.create(req.tenant.id, req.body);
    res.json({ status: true, data: pkg });
  } catch (err) {
    console.error('[AdvPkg] create error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// PUT /travel/advanced-packages/:id
router.put('/:id', async (req, res) => {
  try {
    const pkg = await advancedPackageService.update(req.tenant.id, req.params.id, req.body);
    res.json({ status: true, data: pkg });
  } catch (err) {
    console.error('[AdvPkg] update error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// DELETE /travel/advanced-packages/:id
router.delete('/:id', async (req, res) => {
  try {
    await advancedPackageService.delete(req.tenant.id, req.params.id);
    res.json({ status: true, message: 'Package deleted' });
  } catch (err) {
    console.error('[AdvPkg] delete error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// GET /travel/advanced-packages/ai-context/:type
router.get('/ai-context/:type', async (req, res) => {
  try {
    const context = await advancedPackageService.buildAIContext(req.tenant.id, req.params.type);
    // Fix #9: buildAIContext now returns { text, structured }. Expose both for dashboard inspection.
    res.json({ status: true, data: context && context.text ? context.text : context, structured: context && context.structured ? context.structured : null });
  } catch (err) {
    console.error('[AdvPkg] AI context error:', err);
    res.status(500).json({ status: false, message: err.message });
  }
});

// PREVIEW AI CONTEXT (LIVE SUMMARY)
router.post('/preview-context', packageMediaUpload.array('files', 10), advancedPackageUploadController.previewContext);

// PREVIEW FILES (SMART AI REASONING FOR UNUPLOADED FILES)
router.post('/preview-files', packageMediaUpload.array('files', 10), advancedPackageUploadController.previewFiles);

// GET FILES
router.get('/:packageId/files', async (req, res) => {
  try {
    const files = await advancedPackageUploadService.getMainPackageFiles(req.tenant.id, parseInt(req.params.packageId));
    res.json({ status: true, data: files });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});
router.get('/sub-items/:subItemId/files', async (req, res) => {
  try {
    const files = await advancedPackageUploadService.getSubItemFiles(req.tenant.id, parseInt(req.params.subItemId));
    res.json({ status: true, data: files });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});
// ADDON FILES
router.get('/addons/:addonId/files', advancedPackageUploadController.getAddonFiles);
router.delete('/addons/files/:fileId', advancedPackageUploadController.deleteAddonFile);

export default router;
