const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

const leads = {};
const pendingLeads = [];

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

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text.body.trim();
        const lower = text.toLowerCase();

        if (!leads[from] && pendingLeads.length > 0) {
          leads[from] = pendingLeads.shift();
        }

        const lead = leads[from];
        const name = lead ? lead.name : 'there';

        if (lower.includes('interested') || lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
          await sendMessage(from,
`Hi ${name}!

You just experienced something most businesses in Nigeria are not using yet.

That greeting with your name the moment you messaged? That is exactly what your customers will feel every single time they reach out to your business. Instant. Personal. Professional.

No delays. No "I will get back to you." Just instant replies that make your business look on top of its game 24 hours a day.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`
          );

        } else if (text === '1' || lower.includes('how') || lower.includes('work')) {
          await sendMessage(from,
`Right now, every time a customer messages your business on WhatsApp, they have to wait for you to be available. You could be in a meeting, on the road or simply asleep. This means they have to wait and not everyone likes to wait, so you lose customers.

With Dioverse, the moment a customer messages you, they get an instant reply. Your WhatsApp greets them by their name, tells them everything about your business and even answers their common questions automatically.

The best part? You are not doing any of this. It is all running on its own while you focus on what matters.

Reply 2 to see what it costs`
          );

        } else if (text === '2' || lower.includes('price') || lower.includes('cost') || lower.includes('how much')) {
          await sendMessage(from,
`Here is the honest breakdown ${name}

To get your WhatsApp bot set up properly, there is a one time setup fee of ₦75,000. That covers everything. We build it, connect it to your WhatsApp, add it to your website and make sure it is working perfectly before we hand it over to you.

After that, to keep it running, updated and supported every month, it is ₦35,000 per month. That includes any changes you want, priority support and we make sure nothing ever goes wrong.

No hidden fees. No surprises.

Reply 3 when you are ready to get started`
          );

        } else if (text === '3' || lower.includes('yes') || lower.includes('start') || lower.includes('ready')) {
          await sendMessage(from,
`Let's go ${name}!

We will reach out to you shortly to get the ball rolling.

Please save our contact so you do not lose us 💾

Your bot will be live and running within 24 hours of payment. Talk soon!`
          );

        } else {
          await sendMessage(from,
`Hey ${name}

Not sure what you mean but we are here.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`
          );
        }
      }
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Error:', err.message);
    res.sendStatus(200);
  }
});

app.post('/save-lead', async (req, res) => {
  try {
    const { name, email } = req.body;
    pendingLeads.push({ name, email, timestamp: new Date() });
    console.log(`Lead saved: ${name} | ${email}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

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
  
