# Puente Hotmart -> Zodiaco Cuantico

Este es el "conector" que hace que, cuando alguien pague en Hotmart, la app
sepa que esa persona ya es miembro y le desbloquee el contenido en
cualquier dispositivo (no solo en el navegador donde pago).

Es un Cloudflare Worker (un programa chiquito que corre gratis en la nube,
sin necesidad de contratar un servidor). Tiene dos partes:

- `POST /webhook/hotmart` — Hotmart le avisa aqui cada vez que alguien
  compra, cancela o le reembolsan.
- `GET /check?email=...` — la app le pregunta aqui "¿este correo esta
  activo?" para decidir si desbloquea o no.

## Lo que necesitas tener antes de seguir

1. **Cuenta de Cloudflare** (gratis, no pide tarjeta):
   https://dash.cloudflare.com/sign-up

2. **Cuenta de Hotmart** con el producto de la suscripcion ya creado
   (precio, nombre "Zodiaco Cuantico", tipo "recurrente/suscripcion").

## Pasos para publicar el conector

Desde una terminal, dentro de esta carpeta (`backend/hotmart-bridge`):

```bash
npm install -g wrangler        # herramienta de Cloudflare (una sola vez)
wrangler login                 # abre el navegador para iniciar sesion
wrangler kv namespace create SUBS
```

Ese ultimo comando imprime algo como:

```
{ binding = "SUBS", id = "abcd1234..." }
```

Copia ese `id` y pegalo en `wrangler.toml`, donde dice
`REEMPLAZA_CON_TU_KV_ID`.

Despues, pon el "Hottok" (una clave secreta que te da Hotmart para
verificar que los avisos son de verdad de ellos — la encuentras en tu
cuenta de Hotmart, en Herramientas > Webhooks, o en el mismo lugar donde
configures la URL del webhook):

```bash
wrangler secret put HOTMART_HOTTOK
```

(te va a pedir que pegues el valor, y le das enter)

Y por ultimo, publicalo:

```bash
wrangler deploy
```

Esto te va a dar una URL parecida a:

```
https://zodiaco-cuantico-hotmart.<tu-usuario>.workers.dev
```

## Conectar Hotmart a esta URL

En tu cuenta de Hotmart, en la configuracion de Webhooks del producto,
agrega esta URL:

```
https://zodiaco-cuantico-hotmart.<tu-usuario>.workers.dev/webhook/hotmart
```

Y activa (marca) al menos estos eventos: compra aprobada, compra
cancelada, reembolso, cancelacion de suscripcion.

## Conectar la app a esta URL

Dame la URL que te dio `wrangler deploy` y yo actualizo
`zodiaco-cuantico-app.html` para que apunte ahi (una sola linea de
config).

## Si prefieres que yo lo publique por ti

Puedes crear un "API Token" en Cloudflare (Perfil > API Tokens > Create
Token > plantilla "Edit Cloudflare Workers") y pasarmelo. Con eso puedo
correr los mismos comandos de arriba yo mismo, sin que tengas que tocar
la terminal. El token se puede borrar despues desde tu cuenta en
cualquier momento.
