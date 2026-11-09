// Live Supabase project. For now the SaaS lives inside the shared "nosh7-pricing" project
// (ref xoiksbtxoxrifkgvupqp) in its own schema, so it adds no cost until there is a customer.
// The publishable key is meant to be public: every permission is enforced in the database.
// The local dev server replaces this file with its own config unless started with LIVE=1.
window.APP_CONFIG = {
  API_URL: 'https://xoiksbtxoxrifkgvupqp.supabase.co',
  ANON_KEY: 'sb_publishable_UwUNp74KFKUlbqQ7aY0s7Q_toy7kUiD',
  DEV: false,
  // true on a shared address such as github.io, where ?k=kitchen-name picks the kitchen.
  // Set to false once kitchens have their own web addresses.
  SHARED_HOST: true,
};
