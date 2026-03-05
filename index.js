const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// Store leads temporarily
const leads = {};

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
  const body = req.body;
  if (body.object === 'whatsapp_business_account') {
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      const text = message.text?.body?.toLowerCase() || '';
      const lead = leads[from] || {};
      const name = lead.name || 'there';

      // Extract name and ref from first message
      if (text.includes('ref#')) {
        const ref = text.split('ref#')[1]?.trim().split(' ')[0];
        const savedLead = leads[ref];
        if (savedLead) {
          leads[from] = savedLead;
          await sendMessage(from, 
`Hi ${savedLead.name}! 👋

Thanks for reaching out!

Here's what happens next:
✅ You're now connected with us
✅ Save my contact so you never lose me
✅ Check my status for exclusive updates

Reply with *INFO* to learn more
Reply with *PRICE* to see pricing`
          );
        }
      } else if (text.includes('info')) {
        await sendMessage(from,
`Here's everything you need to know 👇

[Your product/service description goes here]

💡 Reply with *PRICE* to see our pricing`
        );
      } else if (text.includes('price')) {
        await sendMessage(from,
`Here's our pricing 💰

[Your pricing details go here]

To get started, simply reply *YES* and we'll take it from there! 🚀`
        );
      } else if (text.includes('yes')) {
        await sendMessage(from,
`Amazing! 🎉 

Someone from our team will reach out to you shortly.

In the meantime, save our contact and check our status for updates! 👀`
        );
      } else {
        await sendMessage(from,
`👋 Hi ${name}!

Thanks for messaging us!

Reply with:
*INFO* - Learn about us
*PRICE* - See pricing
*YES* - Get started`
        );
      }
    }
    res.sendStatus(200);
  }
});

// Save lead from website form
app.post('/save-lead', (req, res) => {
  const { name, email, ref } = req.body;
  leads[ref] = { name, email };
  res.json({ success: true, ref });
});

async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body: text }
    },
    {
      headers: { Authorization: `Bearer ${TOKEN}` }
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
