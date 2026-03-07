// ─────────────────────────────────────────────
// DIOVERSE CLIENT CONFIG
// Add a new client by copying one block below
// and filling in their details
// ─────────────────────────────────────────────

const clients = [
  {
    id: 'dioverse',                          // unique ID, no spaces
    name: 'Dioverse',                        // business name
    phoneNumberId: process.env.PHONE_NUMBER_ID, // from Meta
    token: process.env.WHATSAPP_TOKEN,          // from Meta
    inboxPassword: process.env.INBOX_PASSWORD || 'dioverse2024',
    replies: {
      welcome: (name) =>
`Hi ${name}!

You just experienced something most businesses in Nigeria are not using yet.

That greeting with your name the moment you messaged? That is exactly what your customers will feel every single time they reach out to your business. Instant. Personal. Professional.

No delays. No "I will get back to you." Just instant replies that make your business look on top of its game 24 hours a day.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`,

      howItWorks: (name) =>
`Right now, every time a customer messages your business on WhatsApp, they have to wait for you to be available. You could be in a meeting, on the road or simply asleep. This means they have to wait and not everyone likes to wait, so you lose customers.

With Dioverse, the moment a customer messages you, they get an instant reply. Your WhatsApp greets them by their name, tells them everything about your business and even answers their common questions automatically.

The best part? You are not doing any of this. It is all running on its own while you focus on what matters.

Reply 2 to see what it costs`,

      pricing: (name) =>
`Here is the honest breakdown ${name}

To get your WhatsApp bot set up properly, there is a one time setup fee of ₦75,000. That covers everything. We build it, connect it to your WhatsApp, add it to your website and make sure it is working perfectly before we hand it over to you.

After that, to keep it running, updated and supported every month, it is ₦35,000 per month. That includes any changes you want, priority support and we make sure nothing ever goes wrong.

No hidden fees. No surprises.

Reply 3 when you are ready to get started`,

      getStarted: (name) =>
`Let's go ${name}!

We will reach out to you shortly to get the ball rolling.

Please save our contact so you do not lose us 💾

Your bot will be live and running within 24 hours of payment. Talk soon!`,

      default: (name) =>
`Hey ${name}

Not sure what you mean but we are here.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`
    }
  },

  // ─── ADD NEW CLIENT BELOW ───
  // {
  //   id: 'amakas-fashion',
  //   name: "Amaka's Fashion",
  //   phoneNumberId: 'CLIENT_PHONE_NUMBER_ID',
  //   token: 'CLIENT_WHATSAPP_TOKEN',
  //   inboxPassword: 'amaka2024',
  //   replies: {
  //     welcome: (name) => `Hi ${name}! Welcome to Amaka's Fashion...`,
  //     howItWorks: (name) => `...`,
  //     pricing: (name) => `...`,
  //     getStarted: (name) => `...`,
  //     default: (name) => `...`
  //   }
  // },

];

module.exports = clients;
    
