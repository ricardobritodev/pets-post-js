/**
 * GET /api/v1/site — configuração pública do site (specs/api/site.md).
 * Hoje só o link do botão flutuante de WhatsApp (BR-CONTACT-002).
 */
import { Router } from 'express';

/** @param {{ config: { CONTACT_WHATSAPP_URL: string|null } }} deps */
export function siteRouter({ config }) {
  const router = Router();
  router.get('/', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ contact: { whatsappUrl: config.CONTACT_WHATSAPP_URL } });
  });
  return router;
}
