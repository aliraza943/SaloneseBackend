const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Website = require('../models/Website'); // adjust path as needed
const websitemiddleware = require('../middleware/websitemiddleware'); // adjust path if needed

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });
const router = express.Router();
router.post(
    '/upload-logo',
    websitemiddleware,
    upload.fields([
      { name: 'logo', maxCount: 1 },
      { name: 'gallery[]' },
      { name: 'textImage', maxCount: 1 }
    ]),
    async (req, res) => {
      try {
        const logo = req.files['logo']?.[0];
        const gallery = req.files['gallery[]'] || [];
        const textImage = req.files['textImage']?.[0];
  
        const overlayTexts = JSON.parse(req.body.overlayTexts || '[]');
        const headerSettings = JSON.parse(req.body.headerSettings || '{}');
        const removedImages = JSON.parse(req.body.removedImages || '[]');
        const textSection = JSON.parse(req.body.textSection || '{}');
  
        const removedFileNames = removedImages.map(url => url.split('/').pop());
  
        console.log('Overlay Texts:', overlayTexts);
        console.log('Header Settings:', headerSettings);
        console.log('Text Section:', textSection);
        console.log('Logo:', logo?.filename);
        console.log('Gallery Files:', gallery.map(f => f.filename));
        console.log('Text Image:', textImage?.filename);
        console.log('Removed Images:', removedImages);
  
        let website = await Website.findOne({ businessId: req.user.businessId });
  
        if (website) {
          website.headerSettings = headerSettings;
  
          if (logo) {
            website.logoFileName = logo.filename;
          }
  
          // Handle gallery images
          removedFileNames.forEach(async (fileName) => {
            const filePath = path.join(__dirname, '../uploads', fileName);
            try {
              fs.unlinkSync(filePath);
              console.log(`Removed file: ${fileName}`);
            } catch (err) {
              console.error(`Error deleting file: ${fileName}`, err);
            }
          });
  
          const updatedGallery = website.galleryImages.filter(
            (image) => !removedFileNames.includes(image.fileName)
          );
          const newGalleryImages = gallery.map(file => ({ fileName: file.filename }));
          website.galleryImages = [...updatedGallery, ...newGalleryImages];
  
          // Update text section
          website.textSection = {
            heading: textSection.heading || '',
            text: textSection.text || '',
            mapCoords: textSection.mapCoords || '',
            mapLabel: textSection.mapLabel || '',
            image: textImage?.filename || website.textSection?.image || null
          };
  
          website.overlayTexts = overlayTexts;
          website.url = website.url || 'WASSAP';
  
          await website.save();
          return res.json({ message: 'Website updated successfully', success: true });
        }
  
        // Create new website
        website = new Website({
          headerSettings,
          logoFileName: logo?.filename || null,
          galleryImages: gallery.map(file => ({ fileName: file.filename })),
          overlayTexts,
          textSection: {
            heading: textSection.heading || '',
            text: textSection.text || '',
            mapCoords: textSection.mapCoords || '',
            mapLabel: textSection.mapLabel || '',
            image: textImage?.filename || null
          },
          businessId: req.user.businessId,
          url: 'WASSAP'
        });
  
        await website.save();
  
        res.json({ message: 'Website created successfully', success: true });
      } catch (error) {
        console.error('Error saving website data:', error);
        res.status(500).json({ message: 'Upload failed', error });
      }
    }
  );

  
  
  router.get('/get-website', websitemiddleware, async (req, res) => {
    try {
      const website = await Website.findOne({ businessId: req.user.businessId });
  
      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }
  
      res.json({ success: true, website });
    } catch (error) {
      console.error('Error fetching website data:', error);
      res.status(500).json({ message: 'Failed to fetch website', error });
    }
  });
  router.post('/save-social-links', websitemiddleware, async (req, res) => {
  console.log('Received data from frontend:', req.body);

  const { siteName, siteUrl, facebook, instagram, twitter } = req.body;
  // siteUrl here is the “slug” part—no need to prepend http://… on the backend
  const fullUrl = siteUrl;

  try {
    // 1) Find this business’s website record
    let website = await Website.findOne({ businessId: req.user.businessId });

    // 2) Ensure no one else is using the same slug
    const urlInUse = await Website.findOne({
      url: fullUrl,
      businessId: { $ne: req.user.businessId }
    });
    if (urlInUse) {
      return res
        .status(400)
        .json({ message: 'This URL is already used by another business.' });
    }

    if (website) {
      // 3a) Update existing
      website.siteName = siteName;
      website.url = fullUrl;
      website.socialLinks = { facebook, instagram, twitter };

      await website.save();
      console.log('Updated website:', website);
      return res.json({
        message: 'Social links and URL updated successfully',
        success: true
      });
    } else {
      // 3b) Create new
      website = new Website({
        businessId: req.user.businessId,
        siteName,
        url: fullUrl,
        socialLinks: { facebook, instagram, twitter }
      });
      await website.save();
      console.log('Created new website:', website);
      return res.json({
        message: 'Website created successfully',
        success: true
      });
    }
  } catch (error) {
    console.error('Error saving social links:', error);
    return res.status(500).json({ message: 'Server error', success: false });
  }
});
  router.get('/get-website/:siteUrl', async (req, res) => {
    try {
      const fullUrl = `${req.params.siteUrl}`;
      const website = await Website.findOne({ url: fullUrl });
  
      if (!website) {
        return res.status(404).json({ message: 'Website not found' });
      }
  
      res.json({ success: true, website });
    } catch (error) {
      console.error('Error fetching website data:', error);
      res.status(500).json({ message: 'Failed to fetch website', error });
    }
  });
  router.post(
    '/save-cards',
    websitemiddleware,
    upload.array('images', 10),
    async (req, res) => {
      try {
        const cardsMeta = JSON.parse(req.body.cards);
        console.log('Received metadata:', cardsMeta);
  
        const imageIndices = req.body.imageIndices
          ? (Array.isArray(req.body.imageIndices)
              ? req.body.imageIndices.map(Number)
              : [Number(req.body.imageIndices)])
          : [];
  
        // Build cards from metadata
        const structuredCards = cardsMeta.map((meta, i) => {
          const index = meta.index !== undefined ? Number(meta.index) : i;
  
          const imageIndex = imageIndices.findIndex(
            (imgIdx) => Number(imgIdx) === index
          );
  
          return {
            staffId: meta.staffId || '',
            description: meta.description || '',
            image:
              imageIndex !== -1 && req.files[imageIndex]
                ? `/uploads/${req.files[imageIndex].filename}`
                : meta.image || '',
          };
        });
  
        // Find or create website document
        let website = await Website.findOne({ businessId: req.user.businessId });
  
        if (!website) {
          website = new Website({
            businessId: req.user.businessId,
            url: req.body.url || '',
            cards: structuredCards.filter((card) => card.staffId),
          });
        } else {
          const existingCards = website.cards || [];
  
          // Map of existing cards by staffId
          const existingMap = {};
          existingCards.forEach((card) => {
            const id = card.staffId?.toString?.() || '';
            if (id) existingMap[id] = card;
          });
  
          const updatedCards = structuredCards
            .filter((card) => card.staffId)
            .map((card) => {
              const id = card.staffId.toString();
              if (existingMap[id]) {
                return {
                  staffId: existingMap[id].staffId,
                  description: card.description,
                  image: card.image || existingMap[id].image,
                };
              }
              return card;
            });
  
          website.cards = updatedCards;
        }
  
        await website.save();
  
        await Website.populate(website, {
          path: 'cards.staffId',
          select: 'name',
        });
  
        res.status(200).json({
          success: true,
          message: 'Team cards saved/updated successfully.',
          cards: website.cards,
        });
      } catch (error) {
        console.error('Error saving/updating team cards:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to save/update team cards.',
          error: error.message || error,
        });
      }
    }
  );
router.get(
  '/get-cards',
  websitemiddleware,
  async (req, res) => {
    try {
      // 1) Find the Website doc for this business and populate staff names
      const website = await Website
        .findOne({ businessId: req.user.businessId })
        .populate('cards.staffId', 'name');

      // 2) If not found, return empty array
      if (!website) {
        return res.status(200).json({ success: true, cards: [] });
      }

      // 3) Send back whatever is in website.cards (could be empty)
      return res.status(200).json({
        success: true,
        cards: website.cards
      });

    } catch (error) {
      console.error('Error fetching team cards:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch cards',
        error: error.message || error
      });
    }
  }
);
router.get('/get-meetourTeam/:siteUrl', async (req, res) => {
  try {
    const { siteUrl } = req.params;

    // 1) Find the Website doc by public URL and populate staff names
    const website = await Website
      .findOne({ url: siteUrl })
      .populate('cards.staffId', 'name');

    // 2) If not found, return empty array
    if (!website) {
      return res.status(200).json({ success: true, cards: [] });
    }

    // 3) Send back whatever is in website.cards (could be empty)
    return res.status(200).json({
      success: true,
      cards: website.cards
    });

  } catch (error) {
    console.error('Error fetching team cards by siteUrl:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cards',
      error: error.message || error
    });
  }
});


  // router.get('/get-cards', websitemiddleware, async (req, res) => {
  //   try {
  //     const website = await Website.findOne({ businessId: req.user.businessId }).select('cards');
  
  //     if (!website) {
  //       return res.status(404).json({ message: 'Website not found' });
  //     }
  
  //     res.json({ success: true, cards: website.cards });
  //   } catch (error) {
  //     console.error('Error fetching cards:', error);
  //     res.status(500).json({ message: 'Failed to fetch cards', success: false });
  //   }
  // });
  
  
module.exports = router;
