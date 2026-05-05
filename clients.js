// ═══════════════════════════════════════════════════════════════
// DIOVERSE — CLIENT CONFIG FILE
// ───────────────────────────────────────────────────────────────
// HOW TO ADD A NEW CLIENT:
// 1. Copy the template block at the bottom of this file
// 2. Fill in their details
// 3. Commit to GitHub — Render redeploys in 2 minutes
// 4. Send them: dioverse-whatsapp-bot.onrender.com/inbox.html
//    and their username + password
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
    inboxUsername: 'dioverse',
    inboxPassword: process.env.INBOX_PASSWORD || 'dioverse2024',
    replies: {
      welcome: (name) =>
`Hi ${name}! 👋

Welcome to Dioverse. Notice how fast that was? That instant personal response you just got is what every customer messaging your business will experience.

A chat that knows their name, speaks to them personally and responds like there's always someone ready because there is.

Dioverse keeps your business alive and responding 24/7 so you never lose a customer to silence again. Day or night, whether you're busy, asleep or on the road your business stays warm, personal and always on.

Reply with:
1 to see how it works
2 to see pricing
3 to get started`,

      howItWorks: (name) =>
`Most businesses lose customers not because their product is bad but because nobody replied fast enough. While you were unavailable, your competitor answered and got the sale.

Dioverse fixes that. The moment someone messages your business, they get an instant reply that knows their name, understands what they need and guides them straight to a purchase or booking all on its own.

No robot menus. No generic responses. Just a conversation that feels real and moves fast.

And when a question comes up that needs your personal touch you have a private inbox where you can step in, read the conversation and reply directly. You stay in control without being chained to your phone.

You set it up once. Dioverse handles the rest.

Reply 2 to see pricing`,

      pricing: (name) =>
`Here is what you get ${name}:

Standard Plan
• Setup: ₦35,000 (one time)
• Monthly: ₦15,000
• Industry bot template set up for your business
• Up to 10 FAQ replies
• Payment link integration
• Ongoing support and maintenance

Done For You Plan
• Setup: ₦70,000 (one time)
• Monthly: ₦35,000
• Everything in Standard
• Unlimited FAQ replies
• Booking integration
• Custom flows and triggers
• Priority support
• Dedicated account manager

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
  //   inboxUsername: 'their-username',
  //   // Create a username for them. e.g. 'amaka-fashion'
  //
  //   inboxPassword: 'their-inbox-password',
  //   // Create a password for them. They use this with the username to log into their inbox
  //
  //   replies: {
  //
  //     welcome: (name) =>
  // `Hi ${name}!
  //
  // [First message when someone says hi]
  // [Make it exciting and personal to their business]
  //
  // Reply with:
  // 1 to [see how it works / see our menu / learn more]
  // 2 to [see pricing / see our services / place an order]
  // 3 to [get started / book now / contact us]`,
  //
  //     howItWorks: (name) =>
  // `[Explain the business and what they offer]
  // [2 to 3 short paragraphs]
  //
  // Reply 2 to [see pricing / see services]`,
  //
  //     pricing: (name) =>
  // `[List their products, services or prices clearly]
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
