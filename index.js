const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const Groq = require('groq-sdk');
const clients = require('./clients');
const cors = require('cors');

const app = express();

// ─── CORS ────────────────────────────────────────────
app.use(cors({
  origin: ['https://dioverse.online', 'https://www.dioverse.online'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Raw body for Paystack webhook signature verification
app.use('/paystack-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static('public'));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const SYSTEME_API_KEY = process.env.SYSTEME_API_KEY;
const PAYSTACK_PAYMENT_LINK = 'https://paystack.shop/pay/dioverse-bot-setup';
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyX5g06twrdJbOUxvpJfnCpE-HVeD3OlOqwi45sq71-JxWNeGK93emSaYdvwsexRSYLvA/exec';

let CALENDLY_LINK = process.env.CALENDLY_LINK || 'https://calendly.com/dioverse';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
        { fields: [], tags },
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
          fields: [],
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
function normalizePhone(phone) {
  phone = phone.toString().replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (phone.startsWith('0')) phone = '234' + phone.slice(1);
  return phone;
}

async function getNameFromPendingLeads(clientId, phone) {
  try {
    const normalizedIncoming = normalizePhone(phone);
    const leads = await db.collection('leads').find({ clientId, matched: { $ne: true } }).toArray();
    const matched = leads.find(l => normalizePhone(l.phone || '') === normalizedIncoming);
    if (matched) {
      await db.collection('leads').updateOne({ _id: matched._id }, { $set: { matched: true } });
      return matched.name;
    }
  } catch (e) {}
  return null;
}


// ─── AI REPLY ────────────────────────────────────────────
async function getAIReply(client, customerName, conversationHistory, newMessage) {
  try {
    const systemPrompt = `You are a friendly and professional customer service assistant for ${client.name}. 

About Dioverse:
Dioverse is a WhatsApp automation service that sets up intelligent bots for businesses in Nigeria. We help businesses never miss a customer by providing instant, personalized replies 24/7.

Two plans available:
Standard Plan: ₦35,000 setup (one time) + ₦15,000/month. Includes industry bot template, business info setup, up to 10 FAQ replies, payment link integration, ongoing support.
Done For You Plan: ₦70,000 setup (one time) + ₦35,000/month. Everything in Standard plus unlimited FAQs, booking integration, custom flows, priority support, dedicated account manager.

Booking link: https://cal.com/dioversetech/bot-setup
Payment link: https://paystack.shop/pay/dioverse-bot-setup

Rules:
- Address the customer as ${customerName} naturally when appropriate
- Keep replies concise and conversational — this is WhatsApp not email
- Be warm, human and direct — never robotic
- If they want to get started, share the booking link
- If they are ready to pay, share the payment link
- Never make up information not provided above
- If unsure about something, offer to connect them with the team`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8).map(m => ({
        role: m.sender === 'customer' ? 'user' : 'assistant',
        content: m.text
      })),
      { role: 'user', content: newMessage }
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      max_tokens: 400,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || null;
  } catch (err) {
    console.error('Groq error:', err.message);
    return null;
  }
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
          const leadName = await getNameFromPendingLeads(client.id, from);
          if (leadName) name = leadName;
        }

        // Extract name from message text
        if (lower.includes('my name is')) {
          const match = text.match(/my name is ([a-zA-Z]+)/i);
          if (match) name = match[1];
        }

        // Get conversation history for AI context
        let conversationHistory = [];
        try {
          const convo = await db.collection('conversations').findOne({ clientId: client.id, phone: from });
          if (convo && convo.messages) conversationHistory = convo.messages;
        } catch(e) {}

        await saveMessage(client.id, from, name, 'customer', text);

        let reply = '';
        const r = client.replies;

        // Use preset replies for numbered options and first contact
        const isFirstMessage = conversationHistory.length === 0;
        const isGreeting = lower.includes('hi') || lower.includes('hello') || lower.includes('hey');
        const isNumbered = text === '1' || text === '2' || text === '3';

        if (isFirstMessage || isGreeting) {
          reply = r.welcome(name);
        } else if (text === '1') {
          reply = r.howItWorks(name);
        } else if (text === '2') {
          reply = r.pricing(name);
        } else if (text === '3') {
          reply = r.getStarted(name);
        } else {
          // Use AI for everything else
          const aiReply = await getAIReply(client, name, conversationHistory, text);
          reply = aiReply || r.default(name);
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
      phone: phone ? normalizePhone(phone) : '',
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
  const { username, password } = req.body;
  const client = clients.find(c => c.inboxPassword === password && c.inboxUsername === username);
  if (client) {
    res.json({ success: true, clientId: client.id, clientName: client.name });
  } else {
    res.status(401).json({ success: false, message: 'Wrong credentials' });
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
      
