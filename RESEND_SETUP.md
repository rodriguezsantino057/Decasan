# Configuracion de Resend

La app envia emails transaccionales desde `src/lib/email.ts`.
Los emails de confirmacion de pedido se construyen en `src/lib/order-email.ts` y se disparan cuando Mercado Pago confirma un pedido como `pagado`.
Los emails de seguridad de cuenta usan el mismo helper desde `src/lib/auth.functions.ts`.

## Variables necesarias

Agrega estas variables en local y en produccion:

```env
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxx"
RESEND_FROM_EMAIL="Decasan <ventas@tudominio.com>"
ORDER_EMAIL_BCC="admin@tudominio.com"
ORDER_EMAIL_REPLY_TO="ventas@tudominio.com"
```

`RESEND_FROM_EMAIL` debe usar un dominio verificado en Resend. Para pruebas Resend permite remitentes de prueba, pero en produccion conviene usar un email del dominio de Decasan.

## DNS en Resend

1. Entra al dashboard de Resend.
2. Agrega tu dominio, por ejemplo `decasan.com.ar`.
3. Copia en tu proveedor DNS los registros que muestra Resend para DKIM, SPF/Return-Path y DMARC.
4. Espera la propagacion y confirma que el dominio figure como verificado.
5. Usa un remitente del mismo dominio en `RESEND_FROM_EMAIL`.

## Cloudflare / Wrangler

Si el deploy corre en Cloudflare, carga los secretos con:

```bash
wrangler secret put RESEND_API_KEY
wrangler secret put RESEND_FROM_EMAIL
wrangler secret put ORDER_EMAIL_BCC
wrangler secret put ORDER_EMAIL_REPLY_TO
```

Tambien asegurate de configurar `PUBLIC_BASE_URL` sin errores, por ejemplo:

```env
PUBLIC_BASE_URL="https://decasan.lovable.app"
```

## Comprobacion

Despues de pagar un pedido, el webhook de Mercado Pago marca el pedido como `pagado`, envia el email por Resend y guarda `confirmation_email_sent_at` para no enviarlo dos veces.
