import { Redis } from '@upstash/redis';

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;
if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
  throw new Error('Missing Upstash Redis credentials in environment variables');
}

export const redis = new Redis({
  url: UPSTASH_REDIS_URL,
  token: UPSTASH_REDIS_TOKEN,
});
