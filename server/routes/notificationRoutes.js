const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getHrAlerts, HR_NOTIFY_ROLES } = require('../services/hrNotificationService');

router.get('/hr-alerts', authMiddleware, async (req, res) => {
  try {
    if (!HR_NOTIFY_ROLES.includes(req.user.role)) {
      return res.json([]);
    }

    const alerts = await getHrAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('[Notifications] Error fetching HR alerts:', error);
    res.status(500).json({ message: 'Failed to fetch HR alerts' });
  }
});

module.exports = router;
