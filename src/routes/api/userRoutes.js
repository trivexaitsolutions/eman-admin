const express = require('express');
const router = express.Router();

// Placeholder for future customer app routes!
router.get('/test', (req, res) => {
    res.json({ message: "User/Customer API is ready to be built!" });
});

module.exports = router;