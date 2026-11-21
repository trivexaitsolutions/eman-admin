'use strict';
const router = require('express').Router();
const c = require('../controllers/translationAdminController');
const multer = require('multer');
const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:5}});
router.get('/', c.index);
router.get('/export', c.exportTranslations);
router.post('/import', (req,res,next)=> upload.single('translationFile')(req,res,(err)=>{
  if(err) return res.status(400).send('Upload rejected. Use a CSV/XLSX file smaller than 5 MB.');
  next();
}), c.importTranslations);
router.get('/:type/:id', c.editor);
router.post('/:type/:id', c.save);
module.exports = router;
