import ChildProcess from 'child_process';
import Path from 'path';
import FS from 'fs-extra';
import {
  CERTBOT_CLOUDFLARE_CONFIG,
  CERTBOT_DIR,
  CERTBOT_LIVE_DIR,
  CERTBOT_LOGS_DIR,
} from './common/paths';
import { redis } from './common/redis';

const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY;
if (!CLOUDFLARE_EMAIL || !CLOUDFLARE_API_KEY) {
  throw new Error('Missing Cloudflare credentials in environment variables');
}
const CLOUDFLARE_CONFIG_CONTENT = `
dns_cloudflare_email = ${CLOUDFLARE_EMAIL}
dns_cloudflare_api_key = ${CLOUDFLARE_API_KEY}
`;
const CERTBOT_DOMAINS = process.env.CERTBOT_DOMAINS;
const CERTBOT_EMAIL = process.env.CERTBOT_EMAIL;
if (!CERTBOT_DOMAINS || !CERTBOT_EMAIL) {
  throw new Error('Missing Certbot config in environment variables');
}
const DOMAIN_LIST = CERTBOT_DOMAINS.split(',')
  .map(domain => domain.trim())
  .filter(domain => domain.length > 0)
  .sort((a, b) => a.localeCompare(b));

FS.ensureDirSync(CERTBOT_DIR);
FS.ensureDirSync(CERTBOT_LOGS_DIR);

async function main() {
  await FS.writeFile(CERTBOT_CLOUDFLARE_CONFIG, CLOUDFLARE_CONFIG_CONTENT);

  const CERT_NAME = DOMAIN_LIST.join('_').slice(0, 50);
  const DOMAIN_ARGS = DOMAIN_LIST.map(
    domain => `-d ${domain} -d *.${domain}`,
  ).join(' ');
  const PATH_ARGS = `--config-dir "${CERTBOT_DIR}" --work-dir "${CERTBOT_DIR}" --logs-dir "${CERTBOT_LOGS_DIR}"`;

  console.log('Running certbot');
  await exec(
    `certbot certonly --dns-cloudflare --dns-cloudflare-propagation-seconds 60 --dns-cloudflare-credentials "${CERTBOT_CLOUDFLARE_CONFIG}" --email "${CERTBOT_EMAIL}" --agree-tos --no-eff-email ${PATH_ARGS} --cert-name "${CERT_NAME}" ${DOMAIN_ARGS}`,
  );

  console.log('Uploading certs to Redis');
  await uploadCerts(CERT_NAME, DOMAIN_LIST);

  console.log('Done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function exec(command: string): Promise<void> {
  const childProcess = ChildProcess.exec(command);
  childProcess.stdout?.pipe(process.stdout);
  childProcess.stderr?.pipe(process.stderr);
  await new Promise((resolve, reject) => {
    childProcess.on('close', code => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function uploadCerts(
  certName: string,
  domainList: string[],
): Promise<void> {
  const certDir = Path.join(CERTBOT_LIVE_DIR, certName);
  const certPem = await FS.readFile(Path.join(certDir, 'cert.pem'), {
    encoding: 'utf8',
  });
  const chainPem = await FS.readFile(Path.join(certDir, 'chain.pem'), {
    encoding: 'utf8',
  });
  const fullchainPem = await FS.readFile(Path.join(certDir, 'fullchain.pem'), {
    encoding: 'utf8',
  });
  const privkeyPem = await FS.readFile(Path.join(certDir, 'privkey.pem'), {
    encoding: 'utf8',
  });

  const certData = {
    updatedAt: Date.now(),
    certPem,
    chainPem,
    fullchainPem,
    privkeyPem,
    domainList,
  };

  await redis.set('certs:main', JSON.stringify(certData, null, 2));
}
