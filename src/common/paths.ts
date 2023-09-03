import path from 'path';

export const PROJECT_DIR = path.join(__dirname, '..', '..');
export const CERTBOT_DIR = path.join(PROJECT_DIR, 'certbot');
export const CERTBOT_CLOUDFLARE_CONFIG = path.join(
  CERTBOT_DIR,
  'cloudflare.ini',
);
export const CERTBOT_CERTS_DIR = path.join(CERTBOT_DIR, 'certs');
export const CERTBOT_LOGS_DIR = path.join(CERTBOT_DIR, 'logs');
export const CERTBOT_LIVE_DIR = path.join(CERTBOT_DIR, 'live');
