// src/routes/conflictRoutes.js
const express = require("express");
const router = express.Router();

const adminConflictController = require("../controllers/adminConflictController");

router.get("/", adminConflictController.getAllConflicts);

router.get("/:id", adminConflictController.getConflictDetails);

router.post("/:id/status", adminConflictController.updateConflictStatus);
router.post("/:id/assign-field-agent", adminConflictController.assignConflictMitra);
// Legacy action URL, retained for forms open before deployment.
router.post("/:id/assign-mitra", adminConflictController.assignConflictMitra);

module.exports = router;