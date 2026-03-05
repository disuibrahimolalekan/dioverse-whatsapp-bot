const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// This stores leads from your landing page
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
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text.body;
        const lower = text.toLowerCase();

        // Check if message contains a REF code from landing page
        if (text.includes('REF#')) {
          const ref = text.split('REF#')[1].trim().split(' ')[0];
          const lead = leads[ref];

          if (lead) {
            // Save lead under their phone number for future messages
            leads[from] = lead;
            await sendMessage(from,
`Hi ${lead.name}! 👋

Welcome to Dioverse. You just saw exactly how our WhatsApp bot works.

That greeting you just received? Your customers will get the same experience.

Here is what we set up for your business:
✅ Auto replies when customers message you
✅ Greets every customer by their name
✅ Answers common questions automatically
✅ Saves every customer contact for you

Reply with *PRICE* to see our packages
Reply with *HOW* to see how it works`
            );
          } else {
            await sendDefaultMessage(from);
          }

        } else if (lower.includes('price') || lower.includes('how much') || lower.includes('cost')) {
          const lead = leads[from];
          const name = lead ? lead.name : 'there';
          await sendMessage(from,
`Here are our packages ${name} 💰

*Starter Package*
Setup your WhatsApp bot
Personalized replies
Works on your website
One time payment of ₦75,000

*Growth Package*
Everything in Starter
Monthly updates and changes
Priority support
₦75,000 setup + ₦35,000 per month

*Best Deal*
Get both for ₦95,000 in your first month

Reply *YES* to get started today 🚀`
          );

        } else if (lower.includes('how') || lower.includes('work')) {
          await sendMessage(from,
`Here is how it works 👇

1. Your customer sees your business online
2. They click your WhatsApp button
3. They type their name and enter their email
4. WhatsApp opens and they send a message
5. Your bot replies instantly and greets them by name
6. They get all the information they need automatically

You do not have to be online at all.
Your WhatsApp works for you 24 hours a day.

Reply *PRICE* to see our packages 💰`
          );

        } else if (lower.includes('yes') || lower.includes('interested') || lower.includes('start')) {
          const lead = leads[from];
          const name = lead ? lead.name : 'there';
          await sendMessage(from,
`Amazing ${name}! 🎉

We will reach out to you shortly to get everything set up.

In the meantime please save our contact so you do not lose us 💾

We will have your bot running within 24 hours of payment. 

Talk soon! 👊`
          );

        } else {
          await sendDefaultMessage(from);
        }
      }
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Error:', err.message);
    res.sendStatus(200);
  }
});

async function sendDefaultMessage(from) {
  await sendMessage(from,
`Hi there! 👋

Welcome to Dioverse. We set up WhatsApp bots for businesses.

Reply with:
*HOW* to see how it works
*PRICE* to see our packages
*YES* if you are ready to get started`
  );
}

// Save lead from landing page form
app.post('/save-lead', async (req, res) => {
  try {
    const { name, email, ref } = req.body;
    leads[ref] = { name, email, timestamp: new Date() };
    console.log(`Lead saved: ${name} | ${email} | REF#${ref}`);
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
      {
        headers: { Authorization: `Bearer ${TOKEN}` }
      }
    );
  } catch (err) {
    console.error('Send error:', err.response?.data || err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dioverse bot running on port ${PORT}`));
