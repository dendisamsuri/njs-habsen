# DESIGN.md — njs-habsen Admin

> **Status: draft without direction.** Arah ini ditulis oleh agent, bukan pemilik brand.
> Produksi final wajib direview pemilik produk sebelum dijadikan acuan tetap.
>
> Dials: **ENERGY 1 · RHYTHM 1 · MOTION 1** (statik, komposisi seragam, gerak hover/fokus saja).
> Produk ini belum punya DESIGN.md buatan pemilik, jadi hasilnya rasa default AI.

## Produk & audiens

- Admin panel absensi SMRU multi-perusahaan. Audiens: HR admin & supervisor Indonesia.
- Karakter: utilitarian, tenang, cepat dipindai. Bukan marketing page — layar kerja harian.
- Keputusan utama per layar: lihat siapa belum/terlambat absen, proses antrean persetujuan, kelola masterdata.

## Identitas

- Nama: **Absensi Admin**. Monogram: huruf **A** pada kotak solid (bukan logo raster, bukan glyph dekoratif).
- Nada: korporat-santai. Serius tanpa kaku, bersih tanpa steril.

## Palet (2 core + 1 aksen + set status fungsional)

| Token | Nilai | Peran |
|---|---|---|
| `--ink` | `#0f172a` | teks utama (netral core 1) |
| `--bg` | `#eef2f7` | latar aplikasi (netral core 1 varian) |
| `--card` | `#ffffff` | permukaan kartu/tabel |
| `--line` | `#e2e8f0` | garis pemisah — jangan lebih tebal dari 1px |
| Sidebar | `#101a30` | solid navy, tanpa gradient (core 2) |
| `--brand` | `#1d4ed8` | aksen tunggal: tombol primer, link, fokus (1 aksen) |
| Status | green `#047857`/`#d1fae5`, amber `#92400e`/`#fef3c7`, red `#991b1b`/`#fee2e2`, blue `#1e40af`/`#dbeafe`, orange `#9a3412`/`#ffedd5`, gray `#475569`/`#eef2f7` | HANYA status data (kehadiran, approval, aktif). Label non-status = gray. |

Aturan keras: tanpa gradient biru–ungu, tanpa glow, tanpa warna ungu, tanpa palet di luar tabel ini.
Aksen `--brand` hanya di momen kunci (CTA utama, fokus keyboard) — bukan di semua elemen.

### Varian gelap (`data-theme="dark"`)

Override token di `[data-theme="dark"]` — hue sama, naik terang untuk kontras di latar gelap:

| Token | Nilai gelap |
|---|---|
| `--ink` | `#e5eaf3` |
| `--bg` | `#0b1220` |
| `--card` | `#131c2e` |
| `--line` / `--line-soft` | `#263349` / `#1b2537` |
| `--brand` / `--brand-2` | `#3b82f6` / `#818cf8` |
| Status (teks) | green `#34d399`, amber `#fbbf24`, red `#f87171`, blue `#60a5fa`, orange `#fb923c`, gray `#94a3b8` |
| Status (latar) | `#062e22`, `#33240a`, `#3a1414`, `#12294d`, `#3a1e0a`, `#1f2a3d` |

Tema: pilihan tersimpan di `localStorage('theme')` (`light`/`dark`), fallback `prefers-color-scheme`, toggle segmented "Terang | Gelap" di topbar. Ikon bukan lambang tema — label teks.

## Tipografi

- Stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
  Alasan: nol webfont = nol lisensi, nol FOUT, cepat di jaringan lambat, konsisten OS.
- Skala: body 14.5px/1.55; judul halaman h1 1.35rem; KPI number 1.5rem; label tabel 14px uppercase 0.07em hanya untuk header kolom; caption 0.74–0.86rem.
- Angka/ID/jam: `ui-monospace` + `tabular-nums` (kolom waktu & NIP sejajar).
- Enum status (HADIR, TERLAMAT, pending, dst.) **tidak diterjemahkan** — konsisten dengan aturan API.

## Spasi, radius, elevasi

- Radius (dissipasi pill): kartu 14px · kontrol (input/button/chip) 9–10px · **pill 999px hanya badge status**.
- Skala spasi basis 4px; padding kartu 1rem–1.2rem; gap antar kartu 0.8–1rem.
- Shadow: satu level saja (`--shadow`, sangat halus) untuk kartu sebagai permukaan terangkat. Elemen lain rata. Tanpa shadow berwarna/glow.

## Komponen

- Tabel = isi halaman. Header sticky, row hover halus, kolom penentu keputusan di depan.
- Tabel: sel (`th`, `td`) `white-space: nowrap`, nilai tidak di-wrap ke baris baru. Wrapper tabel `overflow-x: auto`, scroll kanan boleh, wrap teks jangan.
- Badge status: teks + titik `::before` — titik WAJIB menandai state nyata.
- KPI: hanya angka nyata dari data; hint hanya menyebut field asli (HADIR, TERLAMAT). Tanpa delta/desain karangan.
- Empty state: sebab + aksi nyata, lewat key i18n (`empty_*`). Tanpa "Tidak ada data" polos.
- Ikon: tanpa emoji, tanpa ikon library default. Label teks menopang makna; `☰` hanya untuk menu mobile (fungsional + aria-label).
- Form: label di atas input, target sentuh ≥38px, focus ring terlihat.
- Input: tanpa border keras — isi `--line-soft`, radius 10px, border transparan (penyangga ukuran saja); hover garis `--line` 1px, focus putih + `--brand-2`. Segmented/radio control mengikuti pola isi lembut yang sama; opsi terpilih `--brand-soft` + `--brand-2`.
- Field grouping: section judul normal-case bold + pemisah hairline `--line-soft`, help text `--muted` 0.74rem di bawah input. Bukan blok form rapat tanpa jarak.

## Gerak (MOTION 1)

- Hanya transisi hover/focus dan animasi fungsional (slide sidebar mobile, `transition .22s`).
- Tanpa loop, pulse, float, atau entrance animation.

## Dilarang (cek sebelum kirim)

gradient biru–ungu · glow · emoji dekoratif · bento kosmetik · badge pill dekoratif · stripe kiri tanpa makna · judul dobel · angka/delta karangan · webfont tanpa alasan · radius pill untuk non-status · "No data" tanpa sebab.

## Checkpoint

Perubahan palet, tipografi, gerak, atau karakter WAJIB memperbarui file ini lebih dulu.
