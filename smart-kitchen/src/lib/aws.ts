/**
 * aws.ts — Lazily-instantiated AWS SDK v3 clients.
 *
 * We construct the clients on first use (not at module load) so that builds /
 * tests that never touch AWS don't require credentials. Credentials are resolved
 * by the default AWS provider chain (env vars, shared config, or IAM role).
 */
import { TextractClient } from '@aws-sdk/client-textract';
import { SNSClient } from '@aws-sdk/client-sns';

const REGION = process.env.AWS_REGION || 'us-east-1';

let _textract: TextractClient | null = null;
let _sns: SNSClient | null = null;

export function getTextractClient(): TextractClient {
  if (!_textract) {
    _textract = new TextractClient({ region: REGION });
  }
  return _textract;
}

export function getSnsClient(): SNSClient {
  if (!_sns) {
    _sns = new SNSClient({ region: REGION });
  }
  return _sns;
}
