// Tiny Supabase client for the static apps: sign in, call database functions,
// upload images. Talks to the real Supabase or the local dev server (same URLs).
// Needs window.APP_CONFIG = { API_URL, ANON_KEY } from /config.js.
(function () {
  const CFG = window.APP_CONFIG || {};

  function store(key) {
    return {
      get() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
      set(v) { try { v ? localStorage.setItem(key, JSON.stringify(v)) : localStorage.removeItem(key); } catch { /* private mode */ } },
    };
  }

  // Friendly text for the error codes our functions raise or return.
  const MESSAGES = {
    not_signed_in: 'Please sign in again.',
    not_allowed: 'This login is not allowed to do that.',
    account_suspended: 'This kitchen is suspended.',
    session_expired: 'Your session ended. Please sign in again.',
    slug_taken: 'That web name is already used by another kitchen.',
    invalid_slug: 'Web name can only use letters, numbers and dashes (3 to 32 characters).',
    name_required: 'Please enter a name.',
    invalid_domain: 'That does not look like a web address (example: food.example.com).',
    domain_taken: 'That web address belongs to another kitchen.',
    invalid_key_id: 'Razorpay key id should start with rzp_test_ or rzp_live_.',
    invalid_email: 'Please enter a valid email address.',
    display_name_required: 'Brand name cannot be empty.',
    unknown_timezone: 'Unknown time zone.',
    not_ready: 'Finish the checklist first.',
    row_not_found: 'That row no longer exists. Reload the page.',
    pin_must_be_4_to_6_digits: 'PIN must be 4 to 6 digits.',
    unavailable: 'This kitchen is not taking orders right now.',
    invalid_phone: 'Please enter a valid mobile number.',
    account_exists: 'This number already has an account here. Please sign in first.',
    no_account: 'No account with this number yet.',
    wrong_pin: 'That PIN is not right.',
    locked: 'Too many wrong tries. Please try again in 15 minutes.',
    plan_unavailable: 'That plan is no longer on sale.',
    addon_unavailable: 'One of the add-ons is no longer available.',
    slot_unavailable: 'That meal slot is no longer available.',
    variant_unavailable: 'That meal type is not available for this plan.',
    need_a_day: 'Please pick at least one delivery day.',
    address_required: 'Please enter your address.',
    address_not_found: 'That address could not be found.',
    address_costs_more: 'That address is further away and costs more. Please contact the kitchen to change it.',
    address_in_use: 'A running plan uses this address, so it cannot be removed.',
    location_required: 'Please mark your location on the map.',
    too_far: 'Sorry, that location is outside the delivery area.',
    delivery_unavailable: 'This kitchen offers pickup only.',
    pickup_unavailable: 'Pickup is not available.',
    pickup_plan: 'This is a pickup plan.',
    promo_invalid: 'That code is not valid.',
    promo_expired: 'That code has expired.',
    promo_used_up: 'That code has been used up.',
    promo_not_for_plan: 'That code does not apply to this plan.',
    promo_min_order: 'Your order is below the minimum for that code.',
    amount_too_small: 'This order cannot be paid online.',
    too_many_attempts: 'Too many attempts. Please try again in an hour.',
    not_yours: 'That plan is not on this account.',
    not_active: 'This plan is not running.',
    not_paused: 'This plan is not paused.',
    bad_dates: 'The end date must be after the start date.',
    cannot_restore: 'That day can no longer be restored.',
    plan_closed: 'This plan has ended.',
    checkout_expired: 'This checkout has expired. Please start again.',
    payments_not_set_up: 'Online payment is not set up for this kitchen yet.',
    bad_signature: 'We could not confirm that payment. If money was taken, please contact the kitchen.',
    already_paid: 'This order is already paid.',
    server_error: 'Something went wrong. Please try again.',
    no_access: 'This login does not have access to that page.',
    customer_not_found: 'That customer could not be found.',
    plan_not_found: 'That plan could not be found.',
    not_found: 'That could not be found. Reload the page.',
    phone_taken: 'Another customer already has this number.',
    bad_amount: 'Please enter a valid amount.',
    bad_payment: 'Please choose how it was paid.',
    bad_quantity: 'That quantity is not allowed.',
    bad_role: 'Please choose a role.',
    discount_too_big: 'The discount is more than the total.',
    future_date: 'The date cannot be in the future.',
    reason_required: 'Please give a reason.',
    zero_change: 'Please enter a number other than zero.',
    not_enough_meals: 'The plan does not have that many meals left.',
    not_cancellable: 'This delivery can no longer be cancelled.',
    online_payment: 'Online payments cannot be removed here. Refund them from Razorpay.',
    owner_only: 'Only the owner can do that.',
    cannot_change_self: 'You cannot change your own role or remove yourself.',
    last_owner: 'A kitchen must keep at least one owner.',
    already_on_team: 'This person is already on the team. Use Edit to change their role.',
    unknown_kind: 'That cannot be saved.',
  };
  function friendly(msg) {
    if (!msg) return 'Something went wrong.';
    const code = String(msg).split(':')[0].trim();
    if (MESSAGES[code]) return MESSAGES[code];
    if (/duplicate key/.test(msg)) return 'That name is already used. Pick another one.';
    if (/null value in column/.test(msg)) return 'Please fill in every required field.';
    if (/check constraint/.test(msg)) return 'One of the values is not allowed. Check the highlighted fields.';
    if (/invalid input syntax/.test(msg)) return 'One of the values is in the wrong format.';
    return msg;
  }

  function createClient(namespace) {
    const sess = store(`${namespace}.session`);

    async function authCall(grant, body) {
      const r = await fetch(`${CFG.API_URL}/auth/v1/token?grant_type=${grant}`, {
        method: 'POST', headers: { apikey: CFG.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error_description || j.msg || 'Sign in failed');
      sess.set({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, user: j.user });
      return j.user;
    }

    async function refresh() {
      const s = sess.get();
      if (!s?.refresh_token) return false;
      try { await authCall('refresh_token', { refresh_token: s.refresh_token }); return true; }
      catch { sess.set(null); return false; }
    }

    async function token() {
      const s = sess.get();
      if (!s) return null;
      if (s.expires_at && s.expires_at - 60 < Date.now() / 1000) {
        if (!(await refresh())) return null;
      }
      return sess.get()?.access_token || null;
    }

    async function request(url, init, retry = true) {
      const t = await token();
      const headers = { apikey: CFG.ANON_KEY, Authorization: `Bearer ${t || CFG.ANON_KEY}`, ...(init.headers || {}) };
      const r = await fetch(url, { ...init, headers });
      // A dead login must not break public calls: refresh it, or carry on signed out.
      if (r.status === 401 && retry && sess.get()?.refresh_token) { await refresh(); return request(url, init, false); }
      const text = await r.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      if (!r.ok) {
        const err = new Error(friendly(body?.message || body?.error || r.statusText));
        err.status = r.status; err.raw = body;
        throw err;
      }
      return body;
    }

    return {
      user: () => sess.get()?.user || null,
      signedIn: () => !!sess.get(),
      signIn: (email, password) => authCall('password', { email, password }),
      // Creates a login. With email confirmation on, no session comes back until the link is opened.
      async signUp(email, password) {
        const r = await fetch(`${CFG.API_URL}/auth/v1/signup`, {
          method: 'POST', headers: { apikey: CFG.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error_description || j.msg || j.message || 'Could not create the login');
        return j;
      },
      async signOut() {
        const t = sess.get()?.access_token;
        sess.set(null);
        if (t) fetch(`${CFG.API_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: CFG.ANON_KEY, Authorization: `Bearer ${t}` } }).catch(() => {});
      },
      async rpc(fn, args = {}) {
        const res = await request(`${CFG.API_URL}/rest/v1/rpc/${fn}`, {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args),
        });
        // Our functions also return {ok:false, error:'code'} for expected problems.
        if (res && typeof res === 'object' && res.ok === false && res.error) {
          const err = new Error(friendly(res.error));
          err.code = res.error; err.raw = res;
          throw err;
        }
        return res;
      },
      async upload(bucket, objectPath, file) {
        await request(`${CFG.API_URL}/storage/v1/object/${bucket}/${objectPath}`, {
          method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'true' }, body: file,
        });
        return `${CFG.API_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
      },
      friendly,
    };
  }

  window.MealApi = { createClient, config: CFG };
})();
