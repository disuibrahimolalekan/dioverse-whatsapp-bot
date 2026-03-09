const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const clients = require('./clients');

const app = express();

// Raw body for Paystack webhook signature verification
app.use('/paystack-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('public'));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const SYSTEME_API_KEY = process.env.SYSTEME_API_KEY;
const PAYSTACK_PAYMENT_LINK = 'https://paystack.shop/pay/dioverse-bot-setup';
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwp3YfQ5nphWnlbJzmDzPOPKNoOs29u0NWw3hcAroucIXMGwI9seIJpfO1OjIjstzOf5A/exec';

let CALENDLY_LINK = process.env.CALENDLY_LINK || 'https://calendly.com/dioverse';

let db;

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('dioverse');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

connectDB();

function getClientByPhoneId(phoneNumberId) {
  return clients.find(c => c.phoneNumberId === phoneNumberId);
}

function getClientById(id) {
  return clients.find(c => c.id === id);
}

// ─── SAVE MESSAGE TO MONGODB ────────────────────────────
async function saveMessage(clientId, phone, name, sender, text) {
  try {
    await db.collection('conversations').updateOne(
      { clientId, phone },
      {
        $set: {
          clientId,
          phone,
          name: name || 'Unknown',
          lastMessage: text.substring(0, 60),
          lastTime: new Date(),
        },
        $push: {
          messages: { sender, text, time: new Date() }
        },
        $inc: { unread: sender === 'customer' ? 1 : 0 }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('Save message error:', err.message);
  }
}

// ─── SEND WHATSAPP MESSAGE ────────────────────────────
async function sendMessage(client, to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${client.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        text: { body: text }
      },
      { headers: { Authorization: `Bearer ${client.token}` } }
    );
  } catch (err) {
    console.error('Send error:', err.response?.data || err.message);
  }
}

// ─── SAVE TO GOOGLE SHEETS ────────────────────────────
async function saveToSheets(name, email, phone, type = 'lead') {
  try {
    await axios({
      method: 'post',
      url: SHEETS_URL,
      data: JSON.stringify({ name, email, phone, type }),
      headers: { 'Content-Type': 'text/plain' },
      maxRedirects: 5
    });
  } catch (err) {
    console.log('Sheets save failed:', err.message);
  }
}

// ─── ADD CONTACT TO SYSTEME.IO ────────────────────────
async function addToSysteme(name, email, phone, tags = []) {
  try {
    // Check if contact exists first
    const checkRes = await axios.get(
      `https://api.systeme.io/api/contacts?email=${encodeURIComponent(email)}`,
      { headers: { 'X-API-Key': SYSTEME_API_KEY } }
    );

    const existing = checkRes.data?.items?.[0];

    if (existing) {
      // Update existing contact
      await axios.patch(
        `https://api.systeme.io/api/contacts/${existing.id}`,
        { fields: [{ slug: 'phone', value: phone || '' }], tags },
        { headers: { 'X-API-Key': SYSTEME_API_KEY, 'Content-Type': 'application/json' } }
      );
      return existing.id;
    } else {
      // Create new contact
      const res = await axios.post(
        'https://api.systeme.io/api/contacts',
        {
          email,
          firstName: name,
          fields: [{ slug: 'phone', value: phone || '' }],
          tags
        },
        { headers: { 'X-API-Key': SYSTEME_API_KEY, 'Content-Type': 'application/json' } }
      );
      return res.data?.id;
    }
  } catch (err) {
    console.error('Systeme.io error:', err.response?.data || err.message);
  }
}

// ─── SEND EMAIL VIA SYSTEME.IO ────────────────────────
async function sendEmail(to, name, type) {
  // We use Systeme.io tags to trigger automations
  // The tag triggers the email sequence you set up in Systeme.io
  const tag = type === 'demo' ? 'demo-lead' : 'new-lead';
  await addToSysteme(name, to, '', [tag]);
}

// ─── GET NAME FROM PENDING LEADS ────────────────────────
async function getNameFromPendingLeads(clientId) {
  try {
    const lead = await db.collection('leads').findOneAndUpdate(
      { clientId, matched: { $ne: true } },
      { $set: { matched: true } },
      { sort: { timestamp: 1 } }
    );
    if (lead && lead.name) return lead.name;
  } catch (e) {}
  return null;
}

// ─── WEBHOOK VERIFICATION ────────────────────────────
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── RECEIVE WHATSAPP MESSAGES ────────────────────────
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text.body.trim();
        const lower = text.toLowerCase();

        const client = getClientByPhoneId(phoneNumberId);
        if (!client) return res.sendStatus(200);

        // Get name from existing conversation or pending leads
        let name = 'there';
        try {
          const existing = await db.collection('conversations').findOne({ clientId: client.id, phone: from });
          if (existing && existing.name && existing.name !== 'Unknown' && existing.name !== 'there') {
            name = existing.name;
          }
        } catch (e) {}

        if (name === 'there') {
          const leadName = await getNameFromPendingLeads(client.id);
          if (leadName) name = leadName;
        }

        // Extract name from message text
        if (lower.includes('my name is')) {
          const match = text.match(/my name is ([a-zA-Z]+)/i);
          if (match) name = match[1];
        }

        await saveMessage(client.id, from, name, 'customer', text);

        let reply = '';
        const r = client.replies;

        if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('interested') || lower.includes('know more') || lower.includes('tell me') || lower.includes('more') || lower.includes('demo')) {
          reply = r.welcome(name);
        } else if (text === '1' || lower.includes('how') || lower.includes('work')) {
          reply = r.howItWorks(name);
        } else if (text === '2' || lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
          reply = r.pricing(name);
        } else if (text === '3' || lower.includes('pay') || lower.includes('purchase') || lower.includes('buy') || lower.includes('ready') || lower.includes('start')) {
          reply = `Great choice ${name}! Here is your payment link to get started:

${PAYSTACK_PAYMENT_LINK}

Once payment is confirmed we will set up your bot within 24 hours. Your WhatsApp will be live and running before you know it.

Want to speak with someone first? Reply 4 to book a call.`;
        } else if (text === '4' || lower.includes('call') || lower.includes('speak') || lower.includes('talk') || lower.includes('book')) {
          reply = `Sure ${name}! Book a call with us at a time that works for you:

${CALENDLY_LINK}

Pick any available slot and we will walk you through everything personally.`;
        } else if (lower.includes('yes') || lower.includes('get started')) {
          reply = r.getStarted(name);
        } else {
          reply = r.default(name);
        }

        await sendMessage(client, from, reply);
        await saveMessage(client.id, from, name, 'bot', reply);
      }
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.sendStatus(200);
  }
});

// ─── SAVE LEAD FROM LANDING PAGE ────────────────────────
app.post('/save-lead', async (req, res) => {
  try {
    const { name, email, phone, clientId = 'dioverse' } = req.body;

    // Save to MongoDB
    await db.collection('leads').insertOne({
      clientId,
      name,
      email,
      phone: phone || '',
      matched: false,
      timestamp: new Date()
    });

    console.log(`Lead saved [${clientId}]: ${name} | ${email} | ${phone}`);

    // Save to Google Sheets — main leads tab
    await saveToSheets(name, email, phone, 'lead');

    // Add to Systeme.io and tag as new-lead (triggers welcome email)
    await addToSysteme(name, email, phone, ['new-lead']);

    res.json({ success: true });
  } catch (err) {
    console.error('Save lead error:', err.message);
    res.status(500).json({ success: false });
  }
});

// ─── SAVE DEMO LEAD ────────────────────────────────────
app.post('/save-demo-lead', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Save to MongoDB
    await db.collection('demo_leads').insertOne({
      name,
      email,
      phone: phone || '',
      timestamp: new Date()
    });

    console.log(`Demo lead saved: ${name} | ${email} | ${phone}`);

    // Save to Google Sheets — demo leads tab
    await saveToSheets(name, email, phone, 'demo');

    // Add to Systeme.io and tag as demo-lead (triggers pitch email)
    await addToSysteme(name, email, phone, ['demo-lead']);

    res.json({ success: true });
  } catch (err) {
    console.error('Save demo lead error:', err.message);
    res.status(500).json({ success: false });
  }
});

// ─── PAYSTACK WEBHOOK ────────────────────────────────────
app.post('/paystack-webhook', async (req, res) => {
  try {
    // Verify the request is from Paystack
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET)
      .update(req.body)
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.log('Invalid Paystack signature');
      return res.sendStatus(400);
    }

    const event = JSON.parse(req.body);

    if (event.event === 'charge.success') {
      const data = event.data;
      const email = data.customer?.email;
      const name = data.customer?.first_name || data.metadata?.name || 'Customer';
      const phone = data.metadata?.phone || data.customer?.phone || '';
      const amount = data.amount / 100; // Paystack sends in kobo
      const businessName = data.metadata?.custom_fields?.find(f => f.variable_name === 'business_name')?.value || '';

      console.log(`Payment received: ${name} | ${email} | ₦${amount}`);

      // Mark lead as paid in MongoDB
      await db.collection('leads').updateOne(
        { email },
        {
          $set: {
            paid: true,
            paidAt: new Date(),
            amount,
            businessName,
            paystackRef: data.reference
          }
        }
      );

      // Save paid customer to MongoDB payments collection
      await db.collection('payments').insertOne({
        name,
        email,
        phone,
        businessName,
        amount,
        reference: data.reference,
        paidAt: new Date()
      });

      // Tag as paid in Systeme.io (triggers payment confirmation email)
      await addToSysteme(name, email, phone, ['paid-customer']);

      // Send WhatsApp confirmation to customer if we have their phone
      if (phone) {
        const client = getClientById('dioverse');
        if (client) {
          const confirmMsg = `Payment confirmed ${name}! 

We received your ₦${amount.toLocaleString()} setup fee. 

Your WhatsApp bot will be live within 24 hours. We will reach out to you shortly to get your business details and start building.

Thank you for choosing Dioverse!`;
          await sendMessage(client, phone.replace(/\D/g, ''), confirmMsg);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Paystack webhook error:', err.message);
    res.sendStatus(200);
  }
});

// ─── INBOX API ────────────────────────────────────────
app.post('/inbox/login', (req, res) => {
  const { password } = req.body;
  const client = clients.find(c => c.inboxPassword === password);
  if (client) {
    res.json({ success: true, clientId: client.id, clientName: client.name });
  } else {
    res.status(401).json({ success: false, message: 'Wrong password' });
  }
});

app.get('/inbox/conversations/:clientId', async (req, res) => {
  try {
    const list = await db.collection('conversations')
      .find({ clientId: req.params.clientId })
      .sort({ lastTime: -1 })
      .project({ phone: 1, name: 1, lastMessage: 1, lastTime: 1, unread: 1 })
      .toArray();
    res.json(list);
  } catch (err) {
    res.json([]);
  }
});

app.get('/inbox/conversation/:clientId/:phone', async (req, res) => {
  try {
    const convo = await db.collection('conversations').findOne({
      clientId: req.params.clientId,
      phone: req.params.phone
    });
    if (!convo) return res.json({ messages: [] });
    await db.collection('conversations').updateOne(
      { clientId: req.params.clientId, phone: req.params.phone },
      { $set: { unread: 0 } }
    );
    res.json(convo);
  } catch (err) {
    res.json({ messages: [] });
  }
});

app.post('/inbox/reply', async (req, res) => {
  try {
    const { clientId, phone, message } = req.body;
    const client = getClientById(clientId);
    if (!client) return res.status(404).json({ success: false });
    await sendMessage(client, phone, message);
    await saveMessage(clientId, phone, null, 'agent', message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─── PAYMENTS DASHBOARD (simple list) ────────────────────
app.get('/inbox/payments/:clientId', async (req, res) => {
  try {
    const payments = await db.collection('payments')
      .find({})
      .sort({ paidAt: -1 })
      .toArray();
    res.json(payments);
  } catch (err) {
    res.json([]);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dioverse bot running on port ${PORT}`));
  
