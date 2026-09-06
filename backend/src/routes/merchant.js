import { Router } from 'express';
import { basicAuth } from '../middleware/basicAuth.js';
import {
  ASSIGNMENT_STATUS,
  DISPLAY_ASSIGNMENT_STATUS,
  DeviceMerchantAssignment,
  DisplayAssignment,
  Location,
  ManagedDevice,
  Merchant,
  MerchantProduct,
  Offer
} from '../merchant/models.js';

const router = Router();

export function merchantDomainAuth(req, res, next) {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return res.status(503).json({ ok: false, error: 'merchant authentication not configured' });
  }
  return basicAuth()(req, res, next);
}

router.use(merchantDomainAuth);

router.get('/merchants/:merchantId', async (req, res) => {
  const merchant = await Merchant.findOne({ merchantId: req.params.merchantId }).lean();
  if (!merchant) return res.status(404).json({ ok: false, error: 'merchant not found' });
  return res.json({ ok: true, merchant });
});

router.get('/merchants/:merchantId/locations', async (req, res) => {
  const locations = await Location.find({ merchantId: req.params.merchantId }).sort({ name: 1 }).lean();
  return res.json({ ok: true, locations });
});

router.get('/merchants/:merchantId/devices', async (req, res) => {
  const assignments = await DeviceMerchantAssignment.find({ merchantId: req.params.merchantId, status: ASSIGNMENT_STATUS.ACTIVE }).lean();
  const devices = await ManagedDevice.find({ deviceId: { $in: assignments.map((entry) => entry.deviceId) } }).sort({ displayName: 1 }).lean();
  return res.json({ ok: true, devices, assignments });
});

router.get('/merchants/:merchantId/products', async (req, res) => {
  const products = await MerchantProduct.find({ merchantId: req.params.merchantId }).sort({ name: 1 }).lean();
  return res.json({ ok: true, products });
});

router.get('/merchants/:merchantId/offers', async (req, res) => {
  const offers = await Offer.find({ merchantId: req.params.merchantId }).sort({ createdAt: 1 }).lean();
  return res.json({ ok: true, offers });
});

router.get('/merchants/:merchantId/display-assignments', async (req, res) => {
  const assignments = await DisplayAssignment.find({
    merchantId: req.params.merchantId,
    status: { $in: [DISPLAY_ASSIGNMENT_STATUS.PENDING, DISPLAY_ASSIGNMENT_STATUS.ACTIVE] }
  }).sort({ assignedAt: -1 }).lean();
  return res.json({ ok: true, assignments });
});

export default router;
