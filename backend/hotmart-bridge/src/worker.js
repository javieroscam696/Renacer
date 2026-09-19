// Puente entre Hotmart y Zodiaco Cuantico.
//
// Que hace:
// 1) POST /webhook/hotmart -> Hotmart avisa aqui cuando alguien compra,
//    cancela o le reembolsan la suscripcion. Guardamos el estado por correo
//    en Workers KV.
// 2) GET  /check?email=... -> la app llama aqui para saber si ese correo
//    tiene una suscripcion activa, y desbloquea el contenido si es asi.
//
// El KV namespace se llama SUBS (ver wrangler.toml). La clave es el correo
// en minusculas, el valor es un JSON: { active, event, updatedAt }.

const ACTIVE_EVENTS = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'SUBSCRIPTION_REACTIVATED',
]);

const INACTIVE_EVENTS = new Set([
  'PURCHASE_CANCELED',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_EXPIRED',
  'PURCHASE_DELAYED',
  'SUBSCRIPTION_CANCELLATION',
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/webhook/hotmart') {
      return handleWebhook(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/check') {
      return handleCheck(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleWebhook(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const incomingToken =
    request.headers.get('X-Hotmart-Hottok') || payload.hottok || '';

  if (!env.HOTMART_HOTTOK || incomingToken !== env.HOTMART_HOTTOK) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = payload.event || '';
  const email = extractEmail(payload);

  if (!email) {
    return new Response('Missing buyer email', { status: 400 });
  }

  let active;
  if (ACTIVE_EVENTS.has(event)) {
    active = true;
  } else if (INACTIVE_EVENTS.has(event)) {
    active = false;
  } else {
    // Evento que no nos importa para el candado (ej. PIX generado, boleto
    // impreso, etc). Respondemos OK para que Hotmart no lo reintente.
    return new Response('Ignored event: ' + event, { status: 200 });
  }

  await env.SUBS.put(
    email,
    JSON.stringify({ active, event, updatedAt: Date.now() })
  );

  return new Response('OK', { status: 200 });
}

async function handleCheck(request, env) {
  const url = new URL(request.url);
  const email = normalizeEmail(url.searchParams.get('email'));

  if (!email) {
    return json({ active: false });
  }

  const raw = await env.SUBS.get(email);
  if (!raw) {
    return json({ active: false });
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return json({ active: false });
  }

  return json({ active: !!data.active });
}

function extractEmail(payload) {
  const candidate =
    payload?.data?.buyer?.email ||
    payload?.data?.subscriber?.email ||
    payload?.data?.subscription?.subscriber?.email ||
    '';
  return normalizeEmail(candidate);
}

function normalizeEmail(value) {
  return (value || '').toString().trim().toLowerCase();
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
