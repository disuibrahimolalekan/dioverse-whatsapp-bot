const express = require('express');
const axios = require('axios');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const INBOX_PASSWORD = process.env.INBOX_PASSWORD || 'dioverse2024';
const MONGODB_URI = process.env.MONGODB_URI;

let db;
const pendingLeads = [];

// Connect to MongoDB
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

// Save message to MongoDB
async function saveMessage(phone, name, sender, text) {
  try {
    await db.collection('conversations').updateOne(
      { phone },
      {
        $set: {
          phone,
          name: name || 'Unknown',
          lastMessage: text.substring(0, 60),
          lastTime: new Date(),
        },
        $push: {
          messages: {
            sender,
            text,
            time: new Date()
          }
        },
        $inc: { unread: sender === 'customer' ? 1 : 0 }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('Save message error:', err.message);
  }
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
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text.body.trim();
        const lower = text.toLowerCase();

        // Check if we know this person in DB
        let lead = null;
        try {
          const existing = await db.collection('conversations').findOne({ phone: from });
          if (existing && existing.name && existing.name !== 'Unknown') {
            lead = { name: existing.name };
          }
        } catch (e) {}

        // Match pending lead if not found in DB
        if (!lead && pendingLeads.length > 0) {
          lead = pendingLeads.shift();
        }

        const name = lead ? lead.name : 'there';

        // Save incoming message
        await saveMessage(from, name, 'customer', text);

        let reply = '';

        if (lower.includes('interested') || lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('know more') || lower.includes('tell me')) {
          reply =
`Hi ${name}!

You just experienced something most businesses in Nigeria are not using yet.

That greeting with your name the moment you messaged? That is exactly what your customers will feel every single time they reach out to your business. Instant. Personal. Professional.

No delays. No "I will get back to you." Just instant replies that make your business look on top of its game 24 hours a day.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`;

        } else if (text === '1' || lower.includes('how') || lower.includes('work')) {
          reply =
`Right now, every time a customer messages your business on WhatsApp, they have to wait for you to be available. You could be in a meeting, on the road or simply asleep. This means they have to wait and not everyone likes to wait, so you lose customers.

With Dioverse, the moment a customer messages you, they get an instant reply. Your WhatsApp greets them by their name, tells them everything about your business and even answers their common questions automatically.

The best part? You are not doing any of this. It is all running on its own while you focus on what matters.

Reply 2 to see what it costs`;

        } else if (text === '2' || lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
          reply =
`Here is the honest breakdown ${name}

To get your WhatsApp bot set up properly, there is a one time setup fee of ₦75,000. That covers everything. We build it, connect it to your WhatsApp, add it to your website and make sure it is working perfectly before we hand it over to you.

After that, to keep it running, updated and supported every month, it is ₦35,000 per month. That includes any changes you want, priority support and we make sure nothing ever goes wrong.

No hidden fees. No surprises.

Reply 3 when you are ready to get started`;

        } else if (text === '3' || lower.includes('yes') || lower.includes('start') || lower.includes('ready')) {
          reply =
`Let's go ${name}!

We will reach out to you shortly to get the ball rolling.

Please save our contact so you do not lose us 💾

Your bot will be live and running within 24 hours of payment. Talk soon!`;

        } else {
          reply =
`Hey ${name}

Not sure what you mean but we are here.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`;
        }

        await sendMessage(from, reply);
        await saveMessage(from, name, 'bot', reply);
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
    const { name, email } = req.body;
    pendingLeads.push({ name, email, timestamp: new Date() });
    // Also save to DB
    await db.collection('leads').insertOne({ name, email, timestamp: new Date() });
    console.log(`Lead saved: ${name} | ${email}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─── INBOX API ───────────────────────────────────────────

app.post('/inbox/login', (req, res) => {
  const { password } = req.body;
  if (password === INBOX_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Wrong password' });
  }
});

app.get('/inbox/conversations', async (req, res) => {
  try {
    const list = await db.collection('conversations')
      .find({})
      .sort({ lastTime: -1 })
      .project({ phone: 1, name: 1, lastMessage: 1, lastTime: 1, unread: 1 })
      .toArray();
    res.json(list);
  } catch (err) {
    res.json([]);
  }
});

app.get('/inbox/conversation/:phone', async (req, res) => {
  try {
    const convo = await db.collection('conversations').findOne({ phone: req.params.phone });
    if (!convo) return res.json({ messages: [] });
    await db.collection('conversations').updateOne({ phone: req.params.phone }, { $set: { unread: 0 } });
    res.json(convo);
  } catch (err) {
    res.json({ messages: [] });
  }
});

app.post('/inbox/reply', async (req, res) => {
  try {
    const { phone, message } = req.body;
    await sendMessage(phone, message);
    await saveMessage(phone, null, 'agent', message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ─── SEND MESSAGE ────────────────────────────────────────

async function sendMessage(to, text) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        text: { body: text }
      },
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
  } catch (err) {
    console.error('Send error:', err.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dioverse bot running on port ${PORT}`));
      
