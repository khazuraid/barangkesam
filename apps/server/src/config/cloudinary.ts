import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

/**
 * Jika kredensial Cloudinary masih placeholder/tidak di-set,
 * otomatis fallback ke penyimpanan lokal di folder `uploads/`.
 * Ini memudahkan pengembangan tanpa akun Cloudinary.
 */
const PLACEHOLDER_VALUES = new Set(['your-cloud-name', 'your-api-key', 'your-api-secret', '']);

export const USE_LOCAL_STORAGE =
  PLACEHOLDER_VALUES.has(env.CLOUDINARY_CLOUD_NAME) ||
  PLACEHOLDER_VALUES.has(env.CLOUDINARY_API_KEY) ||
  PLACEHOLDER_VALUES.has(env.CLOUDINARY_API_SECRET);

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const PUBLIC_BASE = `http://localhost:${env.PORT}/uploads`;

if (USE_LOCAL_STORAGE) {
  console.warn('⚠️  Cloudinary belum dikonfigurasi — menggunakan penyimpanan lokal di ./uploads/');
} else {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export { cloudinary };

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; public_id: string }> {
  if (USE_LOCAL_STORAGE) {
    const id = publicId ?? randomUUID();
    const dirAbs = path.join(UPLOADS_DIR, folder);
    await fs.mkdir(dirAbs, { recursive: true });
    const filename = `${id}.webp`;
    const fileAbs = path.join(dirAbs, filename);
    await fs.writeFile(fileAbs, buffer);
    const relativeId = `${folder}/${id}`;
    return {
      url: `${PUBLIC_BASE}/${folder}/${filename}`,
      public_id: relativeId,
    };
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'webp' }],
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );
    uploadStream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (USE_LOCAL_STORAGE) {
    // publicId format: "<folder>/<id>"
    const fileAbs = path.join(UPLOADS_DIR, `${publicId}.webp`);
    try {
      await fs.unlink(fileAbs);
    } catch (err) {
      // Abaikan kalau file sudah tidak ada
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    return;
  }
  await cloudinary.uploader.destroy(publicId);
}
