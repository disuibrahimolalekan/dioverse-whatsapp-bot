const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const clients = require('./clients');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwp3YfQ5nphWnlbJzmDzPOPKNoOs29u0NWw3hcAroucIXMGwI9seIJpfO1OjIjstzOf5A/exec';

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

async function saveToSheets(name, email) {
  try {
    await axios({
      method: 'post',
      url: SHEETS_URL,
      data: JSON.stringify({ name, email }),
      headers: { 'Content-Type': 'text/plain' },
      maxRedirects: 5
    });
  } catch (err) {
    console.log('Sheets save failed:', err.message);
  }
}

// Get name from pending leads in MongoDB
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

// Webhook verification
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

// Receive messages
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

        // Get name — check existing conversation first, then pending leads
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

        // Extract name from message
if (lower.includes('my name is')) {
  const match = text.match(/my name is ([a-zA-Z]+)/i);
  if (match) name = match[1];
}

        let reply = '';
        const r = client.replies;

        if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey') || lower.includes('interested') || lower.includes('know more') || lower.includes('tell me') || lower.includes('more')) {
          reply = r.welcome(name);
        } else if (text === '1' || lower.includes('how') || lower.includes('work')) {
          reply = r.howItWorks(name);
        } else if (text === '2' || lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
          reply = r.pricing(name);
        } else if (text === '3' || lower.includes('yes') || lower.includes('start') || lower.includes('ready')) {
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
    console.error('Error:', err.message);
    res.sendStatus(200);
  }
});

// Save lead from landing page
app.post('/save-lead', async (req, res) => {
  try {
    const { name, email, clientId = 'dioverse' } = req.body;

    await db.collection('leads').insertOne({
      clientId,
      name,
      email,
      matched: false,
      timestamp: new Date()
    });

    console.log(`Lead saved [${clientId}]: ${name} | ${email}`);

    await saveToSheets(name, email);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─── INBOX API ───────────────────────────────────────────

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dioverse bot running on port ${PORT}`));
  
