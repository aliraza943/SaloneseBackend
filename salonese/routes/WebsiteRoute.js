const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const Website = require('../models/Website'); // adjust path as needed
const websitemiddleware = require('../middleware/websitemiddleware');
const Service = require('../models/Service'); // adjust the path as needed
const Staff = require('../models/Staff');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);
const Appointment = require('../models/Appointments');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
dayjs.extend(isSameOrBefore);
const mongoose = require('mongoose');
const minMax          = require('dayjs/plugin/minMax');
dayjs.extend(minMax);
const {validateAppointments,createBill,calculateBill} = require('./ValidateAppointments');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
console.log("Supabase URL:", process.env.SUPABASE_URL);
console.log("Supabase Key:", process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be the Service Role key, not anon/public key
);


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
router.get('/get-services/:siteUrl', async (req, res) => {
  try {
    const { siteUrl } = req.params;

    // 1. Find the website by the given public site URL
    const website = await Website.findOne({ url: siteUrl });

    if (!website) {
      return res.status(404).json({ message: 'Website not found' });
    }

    // 2. Find all services that belong to the same businessId
    const services = await Service.find({ businessId: website.businessId });

    // 3. Return the services
    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error fetching services by siteUrl:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
      error: error.message || error,
    });
  }
});
router.post('/get-professionals/:siteUrl', async (req, res) => {
  const { siteUrl } = req.params;
  const { bookingIds } = req.body;

  try {
    // 1. Find the website
    const website = await Website.findOne({ url: siteUrl });

    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }

    const businessId = website.businessId;

    
    const professionals = await Staff.find({
      businessId,
      role: 'provider',
      services: { $in: bookingIds.map(id => new mongoose.Types.ObjectId(id)) }
    }).select('-password -email -phone -role');
    

    return res.status(200).json({
      success: true,
      professionals,
    });
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch professionals',
      error: error.message || error,
    });
  }
});


router.post('/get-availability/:siteUrl', async (req, res) => {
  const { siteUrl } = req.params;
  const { selection, date } = req.body;
  console.log('Received data:', { siteUrl, selection, date });

  if (!date) {
    return res.status(400).json({ success: false, message: 'Date is required' });
  }

  try {
    // 1) fetch website → businessId
    const website = await Website.findOne({ url: siteUrl });
    if (!website) {
      return res.status(404).json({ success: false, message: 'Website not found' });
    }
    const businessId = website.businessId;

    // 2) preload service durations
    const allServiceIds = Object.keys(selection);
    const serviceDocs   = await Service.find({ _id: { $in: allServiceIds } });
    const durations     = serviceDocs.reduce((acc, s) => { acc[s._id] = s.duration; return acc; }, {});

    // 3) define time window
    const startDate = dayjs(date);
    const endDate   = startDate.add(3, 'month');

    // will hold all candidate slots (with embedded appointments)
    const rawSlotsByDay = {};

    // 4) build raw slots & embedded appointments
    for (let d = startDate; d.isBefore(endDate); d = d.add(1, 'day')) {
      const day     = d.format('YYYY-MM-DD');
      const weekday = d.format('dddd');

      // pick staffList
      const specific = Object.values(selection).filter(v => v !== 'max_availability');
      const staffList = specific.length
        ? await Staff.find({ _id: { $in: specific }, businessId, role: 'provider' })
        : await Staff.find({ businessId, role: 'provider', services: { $all: allServiceIds } });

      // collect & merge working‑hour ranges
      let ranges = [];
      staffList.forEach(p => {
        (p.workingHours?.[weekday] || []).forEach(r => {
          const [s, e] = r.split(' - ');
          ranges.push({
            start: dayjs(`${day} ${s}`, 'YYYY-MM-DD hh:mm A'),
            end:   dayjs(`${day} ${e}`, 'YYYY-MM-DD hh:mm A')
          });
        });
      });
      ranges.sort((a, b) => a.start - b.start);

      const merged = [];
      for (const r of ranges) {
        if (!merged.length || r.start.isAfter(merged[merged.length - 1].end)) {
          merged.push({ ...r });
        } else {
          // extend the end if needed
          const last = merged[merged.length - 1];
          last.end = last.end.isAfter(r.end) ? last.end : r.end;
        }
      }

      // slice each merged block into slots of totalDuration, embedding service‑level appointments
      const totalDur = allServiceIds.reduce((sum, id) => sum + (durations[id] || 0), 0);
      const slots = [];

      for (const block of merged) {
        let cursor = block.start;
        // plugin‑free “same or before” check:
        while (!cursor.add(totalDur, 'minute').isAfter(block.end)) {
          const slotStart = cursor;
          const slotEnd   = cursor.add(totalDur, 'minute');

          // build the per‑service appointments inside this slot
          let apptCursor = slotStart;
          const appointments = [];

          for (const serviceId of allServiceIds) {
            const dur      = durations[serviceId] || 0;
            const segStart = apptCursor;
            const segEnd   = apptCursor.add(dur, 'minute');

            // determine staffId
            let staffId = null;
            const sel = selection[serviceId];
            if (sel !== 'max_availability') {
              staffId = sel;
            } else {
              // pick any provider whose working hours cover this segment
              const m = staffList.find(p =>
                (p.workingHours?.[weekday] || []).some(rng => {
                  const [ss, ee] = rng.split(' - ');
                  const ws = dayjs(`${day} ${ss}`, 'YYYY-MM-DD hh:mm A');
                  const we = dayjs(`${day} ${ee}`, 'YYYY-MM-DD hh:mm A');
                  return !segStart.isBefore(ws) && !segEnd.isAfter(we);
                })
              );
              staffId = m?._id || null;
            }

            appointments.push({
              serviceId,
              staffId,
              start: segStart.toISOString(),
              end:   segEnd.toISOString()
            });

            apptCursor = segEnd;
          }

          slots.push({
            start:        slotStart.toISOString(),
            end:          slotEnd.toISOString(),
            label:        slotStart.format('hh:mm A'),
            duration:     totalDur,
            appointments  // embedded array
          });

          cursor = cursor.add(15, 'minute');
        }
      }

      rawSlotsByDay[day] = slots;
    }

    // 5) fetch existing appointments in the window
    const existing = await Appointment.find({
      businessId,
      start: { $gte: startDate.toDate(), $lte: endDate.toDate() }
    });

    // 6) filter out any slots that overlap existing bookings
    const availableSlots = {};
    for (const [day, slots] of Object.entries(rawSlotsByDay)) {
      const ok = slots.filter(s =>
        !existing.some(a =>
          dayjs(s.start).isBefore(dayjs(a.end)) &&
          dayjs(s.end).isAfter(dayjs(a.start))
        )
      );
      if (ok.length) {
        availableSlots[day] = ok;
      }
    }

    // 7) respond
    return res.json({
      success: true,
      businessId,
      availableSlots
    });

  } catch (err) {
    console.error('Error in get-availability:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/staffandDetails', async (req, res) => {
  try {
    const { appointments } = req.body;
    if (!Array.isArray(appointments)) {
      return res.status(400).json({ success: false, message: 'appointments must be an array' });
    }

    // collect unique IDs
    const serviceIds = [...new Set(appointments.map(a => a.serviceId))];
    const staffIds   = [...new Set(appointments.map(a => a.staffId))];

    // fetch services and staff, excluding sensitive fields on staff
    const [services, staff] = await Promise.all([
      Service.find({ _id: { $in: serviceIds } }),
      Staff.find(
        { _id: { $in: staffIds } },
        '-password -email -phone' // still excluding these
      )
    ]);

    // build lookup maps
    const serviceMap = services.reduce((m, s) => { m[s._id] = s; return m; }, {});
    const staffMap   = staff.reduce((m, s) => { m[s._id] = s.toObject(); return m; }, {});

    // just in case, delete any lingering sensitive props
    for (const st of Object.values(staffMap)) {
      delete st.password;
      delete st.email;
    }

    // enrich each appointment including businessId from staff
    const enriched = appointments.map(a => ({
      ...a,
      service: serviceMap[a.serviceId] || null,
      staff: staffMap[a.staffId] || null,
      businessId: staffMap[a.staffId]?.businessId || null, // add businessId here
    }));

    return res.json({ success: true, enriched });
  } catch (err) {
    console.error('Error in /api/appointments/details:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        redirectTo: 'http://localhost:5173/loginConfirmed',
      },
    });

    if (error) {
      console.error('Error sending magic link:', error);
      return res.status(500).json({ message: 'Failed to send magic link', error });
    }

    res.status(200).json({ message: 'Magic link sent successfully' });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});



router.post('/auth/session', async (req, res) => {
  const { accessToken, appointments } = req.body;

  if (!accessToken) {
    return res.status(400).json({ message: 'Access token is required.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(accessToken, process.env.SUPABASE_JWT);
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({
      message: 'Invalid or expired access token',
      error: err.message
    });
  }

  const userEmail = decoded.email;
  console.log('Decoded JWT:', decoded);

  // Base response payload
  const responsePayload = {
    message: 'Access token is valid.',
    email: userEmail
  };

  // If appointments exist, validate and optionally create bill
  if (Array.isArray(appointments) && appointments.length > 0) {
    try {
      const validationErrors = await validateAppointments(appointments);

      if (validationErrors.length > 0) {
        console.warn('Appointment validation errors:', validationErrors);
        responsePayload.validationErrors = validationErrors;
      } else {
        const { bill } = await createBill(appointments, userEmail);
        if (bill) {
          responsePayload.billId = bill._id;
          console.log('Bill created successfully:', bill._id);
        }
      }

    } catch (err) {
      console.error('Error processing appointments:', err.message);
    }
  }

  // Always respond once — after JWT verified
  res.status(200).json(responsePayload);
});

module.exports = router;


module.exports = router;
