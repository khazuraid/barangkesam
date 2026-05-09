/**
 * Utility untuk membangun URL publik (misal untuk encode QR Code)
 * yang dapat diakses dari perangkat lain (HP) di jaringan yang sama.
 *
 * Prioritas:
 *  1. `NEXT_PUBLIC_APP_URL` dari env (harus berupa URL valid tanpa `https://localhost`).
 *     - Jika env ini diset ke `https://localhost...` atau `http://localhost...`,
 *       akan DIABAIKAN karena tidak dapat dijangkau oleh HP.
 *  2. Base URL yang diturunkan dari `window.location`, tetapi:
 *     - Protokol dipaksa `http` untuk hostname non-publik (localhost, 127.*, LAN IP).
 *     - Jika hostname adalah `localhost`/`127.0.0.1`, ditukar dengan IP LAN
 *       (`NEXT_PUBLIC_LAN_IP`) agar dapat di-scan dari HP.
 *  3. Fallback string kosong (sebaiknya tidak terjadi di client).
 */

const isLocalHostname = (hostname: string): boolean => {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower.startsWith('127.') ||
    lower.endsWith('.local')
  );
};

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * Menghasilkan base URL publik yang dapat digunakan untuk QR code / share.
 */
export function getPublicBaseUrl(): string {
  // 1) Env explicit, namun tolak jika berisi localhost (tidak bisa di-scan).
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    try {
      const u = new URL(envUrl);
      if (!isLocalHostname(u.hostname)) {
        return stripTrailingSlash(envUrl);
      }
    } catch {
      // URL invalid — abaikan dan lanjut ke fallback berikutnya.
    }
  }

  // 2) Derive dari window.location.
  if (typeof window === 'undefined') return '';

  const lanIp = process.env.NEXT_PUBLIC_LAN_IP?.trim(); // contoh "192.168.0.153"
  const port = window.location.port || '3000';
  const currentHost = window.location.hostname;

  // Jika hostname saat ini localhost dan ada LAN IP → gunakan LAN IP.
  if (isLocalHostname(currentHost) && lanIp) {
    return `http://${lanIp}:${port}`;
  }

  // Jika hostname localhost tapi tidak ada LAN IP, tetap pakai origin
  // (nantinya user akan diberi tahu via UI agar set env).
  // Paksa `http` untuk hostname lokal/privat supaya HP tidak coba HTTPS.
  const protocol = isLocalHostname(currentHost) ? 'http:' : window.location.protocol;
  const host = window.location.host || (port ? `${currentHost}:${port}` : currentHost);
  return `${protocol}//${host}`;
}

/**
 * Membangun URL publik lengkap untuk halaman scan alkes.
 */
export function buildAlkesScanUrl(kodeAlat: string): string {
  const base = getPublicBaseUrl();
  if (!base) return '';
  return `${base}/alkes/scan/${encodeURIComponent(kodeAlat)}`;
}

/**
 * Deteksi apakah base URL saat ini masih menunjuk ke localhost.
 * Berguna untuk menampilkan peringatan di UI jika QR belum dapat di-scan dari HP.
 */
export function isPublicUrlLocalhost(): boolean {
  const url = getPublicBaseUrl();
  if (!url) return true;
  try {
    return isLocalHostname(new URL(url).hostname);
  } catch {
    return true;
  }
}

/**
 * Mendapatkan base URL API backend yang dapat diakses dari perangkat saat ini.
 *
 * Problem yang dipecahkan: `NEXT_PUBLIC_API_URL` biasanya berisi `http://localhost:3001/api`,
 * tapi saat halaman diakses dari HP via `http://192.168.0.153:3000`, fetch ke
 * `localhost:3001` tidak akan berhasil (localhost = HP itu sendiri).
 *
 * Strategi:
 *  - Di server / SSR: pakai `NEXT_PUBLIC_API_URL` apa adanya.
 *  - Di browser: jika `NEXT_PUBLIC_API_URL` berisi hostname lokal (localhost/127.*)
 *    **dan** hostname halaman saat ini BUKAN localhost, swap hostname API dengan
 *    hostname halaman (supaya HP dapat menjangkau backend lewat LAN IP yang sama).
 */
export function getApiBaseUrl(): string {
  const envApi = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').trim();

  // SSR / tidak ada window → pakai env apa adanya
  if (typeof window === 'undefined') return stripTrailingSlash(envApi);

  try {
    const apiUrl = new URL(envApi);
    const currentHost = window.location.hostname;

    // Jika API pakai hostname lokal, tapi user mengakses dari hostname non-lokal,
    // swap hostname API → hostname sekarang (LAN IP / domain publik).
    if (isLocalHostname(apiUrl.hostname) && !isLocalHostname(currentHost)) {
      apiUrl.hostname = currentHost;
      // Paksa scheme http untuk hostname LAN (menghindari TLS error).
      apiUrl.protocol = 'http:';
    }
    return stripTrailingSlash(apiUrl.toString());
  } catch {
    return stripTrailingSlash(envApi);
  }
}
