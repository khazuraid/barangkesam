import type { NextConfig } from 'next';

// IP LAN komputer (untuk akses dari HP di jaringan WiFi yang sama, scan QR Code, dll.)
// Bisa di-override lewat `NEXT_PUBLIC_LAN_IP` di `.env.local`.
const LAN_IP = process.env.NEXT_PUBLIC_LAN_IP?.trim();

const nextConfig: NextConfig = {
  output: 'standalone',
  // Izinkan HMR WebSocket + dev request dari origin LAN (mis. `http://192.168.0.153:3000`)
  // tanpa warning "Cross origin request detected". Hanya berlaku di mode dev.
  allowedDevOrigins: LAN_IP ? [LAN_IP, `${LAN_IP}:3000`] : [],
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      // Tambah LAN IP supaya `<Image>` dari API `http://<LAN_IP>:3001/uploads/...` tetap bisa di-optimize
      ...(LAN_IP ? [{ protocol: 'http' as const, hostname: LAN_IP }] : []),
    ],
  },
};

export default nextConfig;
