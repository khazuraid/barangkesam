# Fix Inventaris Kosong (APPROVED tidak muncul)

**Status**: Approved plan - implementasi dimulai

## Plan Detail
1. [x] Backend `equipment-requests.controller.ts` - tambah `inventaris` param + logic skip role filter untuk APPROVED/FULFILLED
2. [x] Frontend `inventaris/page.tsx` - tambah `inventaris: true` di query params, hapus client filter
3. [x] Test: refresh inventaris → APPROVED muncul → procure → FULFILLED muncul

## Testing Checklist
- [x] Backend: curl `/api/requests?inventaris=true` → return APPROVED/FULFILLED tanpa role filter
- [x] Frontend: inventaris page → data muncul
- [x] Role test: STAFF lihat APPROVED lain ruangan
- [x] Procure flow: APPROVED → FULFILLED + foto/QR
