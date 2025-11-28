import { fal } from '@fal-ai/client';
import { Blob } from 'buffer';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { config as loadEnv } from 'dotenv';

const DEFAULT_IMAGE = 'backend/uploads/f121b476-f797-4f8c-9705-89f83fd9f0eb_fashion-portrait-young-elegant-woman.jpg';
const ENV_LOCATIONS = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env')
];

function bootstrapEnv() {
  for (const envPath of ENV_LOCATIONS) {
    if (fs.existsSync(envPath)) {
      loadEnv({ path: envPath });
      return;
    }
  }
}

function getMimeType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.jpeg':
    case '.jpg':
    default:
      return 'image/jpeg';
  }
}

async function uploadToFal(buffer: Buffer, mimeType: string): Promise<string> {
  const blob = new Blob([buffer], { type: mimeType });
  const upload = await fal.storage.upload(blob, { contentType: mimeType } as any) as any;
  const url = typeof upload === 'string' ? upload : upload?.url;

  if (!url) {
    throw new Error('Fal storage upload did not return a URL');
  }

  return url;
}

async function main() {
  bootstrapEnv();

  const apiKey = process.env.FAL_KEY || process.env.FAL_SUBSCRIBER_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY or FAL_SUBSCRIBER_KEY is not configured in your environment');
  }

  fal.config({ credentials: apiKey });

  const imageArg = process.argv[2] || DEFAULT_IMAGE;
  const imagePath = path.isAbsolute(imageArg) ? imageArg : path.resolve(process.cwd(), imageArg);

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found at ${imagePath}`);
  }

  console.log('🖼️  Using image:', imagePath);

  const buffer = await fs.promises.readFile(imagePath);
  const mimeType = getMimeType(imagePath);
  const imageUrl = await uploadToFal(buffer, mimeType);

  console.log('☁️  Uploaded to fal storage:', imageUrl);
  console.log('🚀 Sending nano-banana test request...');

  const result = await fal.subscribe('fal-ai/nano-banana/edit', {
    input: {
      prompt: 'simple test',
      image_urls: [imageUrl],
      num_images: 1
    }
  });

  console.log('✅ Request completed.');
  console.log('Request ID:', result.requestId);

  const images = result.data?.images?.map((img: any) => img.url) || [];
  if (images.length > 0) {
    console.log('Generated image URLs:');
    images.forEach((url: string, index: number) => {
      console.log(`  [${index + 1}] ${url}`);
    });
  } else {
    console.log('No images were returned in the response data.');
  }
}

main().catch(error => {
  console.error('❌ Nano-banana test failed:', error);
  process.exit(1);
});

