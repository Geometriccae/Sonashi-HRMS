const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json([
    { _id: '1', name: 'John Doe' },
    { _id: '2', name: 'Jane Doe' }
  ]);
});

module.exports = router;
