// ═══════════════════════════════════════════════════════════════
// DIOVERSE — CLIENT CONFIG FILE
// ───────────────────────────────────────────────────────────────
// HOW TO ADD A NEW CLIENT:
// 1. Copy the template block at the bottom of this file
// 2. Fill in their details
// 3. Commit to GitHub — Render redeploys in 2 minutes
// 4. Send them: dioverse-whatsapp-bot.onrender.com/inbox.html
//    and their password
// ═══════════════════════════════════════════════════════════════

const clients = [

  // ─────────────────────────────────────────────
  // CLIENT 1 — DIOVERSE (your own number)
  // ─────────────────────────────────────────────
  {
    id: 'dioverse',
    name: 'Dioverse',
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    token: process.env.WHATSAPP_TOKEN,
    inboxPassword: process.env.INBOX_PASSWORD || 'dioverse2024',
    replies: {
      welcome: (name) =>
`Hi ${name}!

You just experienced something most businesses in Nigeria are not using yet.

That greeting with your name the moment you messaged? That is exactly what your customers will feel every single time they reach out to your business.

Every message feels personal.

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
`Here is what you get ${name}:

• Greets every customer by their name
• Instant replies 24 hours a day
• Custom replies written for your business
• Every lead saved automatically
• Private inbox to monitor all chats
• Live within 24 hours of payment
• Ongoing support included

Setup: ₦60,000 (one time)
Monthly: ₦25,000 — keeps your bot live 24/7, fully supported and updated every month.

Reply 3 to get started`,

      getStarted: (name) =>
`Let's talk ${name}!

Book a quick call and we will walk you through everything and get your bot live within 24 hours:

https://cal.com/dioversetech/bot-setup

See you on the call!`,

      default: (name) =>
`Hey ${name}, not sure what you mean but let's try again.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`
    }
  },


  // ═══════════════════════════════════════════════════════════════
  // TEMPLATE — COPY THIS BLOCK TO ADD A NEW CLIENT
  // Fill in all the details then remove the // comment marks
  // ═══════════════════════════════════════════════════════════════

  // {
  //   id: 'client-id-here',
  //   // Short unique ID, no spaces. e.g. 'amaka-fashion', 'temi-catering'
  //
  //   name: 'Business Name Here',
  //   // Their business name. e.g. "Amaka's Fashion Store"
  //
  //   phoneNumberId: 'PASTE_PHONE_NUMBER_ID_FROM_META_HERE',
  //   // Get this from Meta -> API Setup after adding their number
  //
  //   token: process.env.WHATSAPP_TOKEN,
  //   // Leave this exactly as is — same token for all clients
  //
  //   inboxPassword: 'their-inbox-password',
  //   // Create a password for them. They use this to log into their inbox
  //
  //   replies: {
  //
  //     welcome: (name) =>
  // `Hi ${name}!
  //
  // [First message when someone says hi]
  // [Make it exciting and personal to their business]
  // [Show them something impressive happened — they got greeted by name]
  //
  // Reply with:
  // 1 to [see how it works / see our menu / learn more]
  // 2 to [see pricing / see our services / place an order]
  // 3 to [get started / book now / contact us]`,
  //
  //     howItWorks: (name) =>
  // `[Explain the business and what they offer]
  // [2 to 3 short paragraphs]
  // [End with a call to action]
  //
  // Reply 2 to [see pricing / see services]`,
  //
  //     pricing: (name) =>
  // `[List their products, services or prices clearly]
  // [Be specific — customers want to know what they get and what it costs]
  //
  // Reply 3 to [order / book / get started]`,
  //
  //     getStarted: (name) =>
  // `[Confirmation message — warm and friendly]
  // [Tell them what happens next]
  // [Include their contact info, location or next step]`,
  //
  //     default: (name) =>
  // `Hey ${name}, not sure what you mean but we are here.
  //
  // Reply with:
  // 1 to learn more
  // 2 to see our services
  // 3 to get started`
  //
  //   }
  // },

];

module.exports = clients;
      
