#!/usr/bin/env node
/*
 * render_ai.js  -  Render video motion "Di Balik Layar Kecerdasan Buatan"
 * Versi: Ikon & Animasi Stickman Minimalis (Tanpa teks penuh di layar)
 *
 * Kebutuhan (Termux):  pkg install nodejs ffmpeg
 * Jalankan          :  node render_ai.js
 *
 * Opsi:
 *   --preview     render cepat 640x360 15fps (untuk cek sinkron)
 *   --scene N     render scene N saja -> tes_scene_N.mp4 (lengkap dengan suara)
 *   --peta        cetak peta waktu lalu keluar, tanpa render
 *   --ulang       paksa render ulang semua segmen (abaikan cache)
 *   --bersih      hapus folder kerja setelah selesai
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

/* ===================== DATA PETA NARASI ===================== */
const SCENES = [
 {
  "audioKey": "isipertamav4",
  "label": "HOOK: MANA YANG ASLI?",
  "accent": "0x22d3ee",
  "glitch": false,
  "durMs": 17398,
  "animType": "question" // Stickman bingung/tanya
 },
 {
  "audioKey": "isikeduav4",
  "label": "AI DI MANA-MANA",
  "accent": "0x22d3ee",
  "glitch": false,
  "durMs": 23406,
  "animType": "everywhere" // Stickman dengan gawai/peta
 },
 {
  "audioKey": "isiketigav4",
  "label": "BAHAYA 1: DEEPFAKE",
  "accent": "0xff4d5e",
  "glitch": true,
  "durMs": 38034,
  "animType": "deepfake" // Stickman topeng/wajah ganda
 },
 {
  "audioKey": "isikeempatv4",
  "label": "BAHAYA 2: PRIVASI DATA",
  "accent": "0xff4d5e",
  "glitch": true,
  "durMs": 25966,
  "animType": "privacy" // Stickman gembok/data
 },
 {
  "audioKey": "isikelimav4",
  "label": "BAHAYA 3: BIAS MESIN",
  "accent": "0xff4d5e",
  "glitch": true,
  "durMs": 30354,
  "animType": "bias" // Stickman timbangan timpang
 },
 {
  "audioKey": "isikeenamv4",
  "label": "BAHAYA 4: PEKERJAAN",
  "accent": "0xff4d5e",
  "glitch": true,
  "durMs": 30668,
  "animType": "jobs" // Stickman gigi roda/robot
 },
 {
  "audioKey": "isiketujuv4",
  "label": "BAHAYA 5: KEKUASAAN",
  "accent": "0xff4d5e",
  "glitch": true,
  "durMs": 25626,
  "animType": "power" // Stickman kendali/kontrol
 },
 {
  "audioKey": "isikedelapanv4",
  "label": "SOLUSI & KESIMPULAN",
  "accent": "0x5eead4",
  "glitch": false,
  "durMs": 32287,
  "animType": "solution" // Stickman bijak/berpikir
 }
];

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const PREVIEW = has('--preview');
const W = PREVIEW ? 640 : 1280;
const H = PREVIEW ? 360 : 720;
const FPS = PREVIEW ? 15 : 30;
const S = W / 1280;
const px = (v) => Math.max(1, Math.round(v * S));
const ONLY = val('--scene', null) ? parseInt(val('--scene', '0'), 10) : null;

const log = (...a) => console.log(...a);
const die = (m) => { console.error('\n[GAGAL] ' + m + '\n'); process.exit(1); };
const norm = (s) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '');
const run = (cmd, a, opt = {}) => cp.spawnSync(cmd, a, { stdio: 'inherit', ...opt });
const out = (cmd, a) => cp.spawnSync(cmd, a, { encoding: 'utf8' });

let cum = 0;
const scenes = SCENES.map((s, i) => {
  const startMs = cum; cum += s.durMs;
  const f0 = Math.round(startMs * FPS / 1000);
  const f1 = Math.round(cum * FPS / 1000);
  return { ...s, idx: i + 1, startMs, endMs: cum, f0, f1, frames: f1 - f0, t0: f0 / FPS, dur: (f1 - f0) / FPS };
});
const totalMs = cum;

if (has('--peta')) {
  log(`Total ${(totalMs / 1000).toFixed(3)} dtk, ${scenes.length} scene\n`);
  scenes.forEach((sc) => log(`SCENE ${sc.idx} [${sc.label}] durasi ${(sc.durMs/1000).toFixed(3)}s`));
  process.exit(0);
}

/* ---------- Cek Alat & Folder ---------- */
const homeDl = [
  process.env.AI_DIR,
  '/storage/emulated/0/Download',
  path.join(os.homedir(), 'storage', 'downloads'),
  path.join(os.homedir(), 'storage', 'shared', 'Download'),
  process.cwd(),
].filter(Boolean);

function findAudio(dir, key) {
  let names = [];
  try { names = fs.readdirSync(dir); } catch (e) { return null; }
  const hit = names.find((n) => /\.mp3$/i.test(n) && norm(n) === key);
  return hit ? path.join(dir, hit) : null;
}
let DIR = null;
for (const d of homeDl) {
  if (scenes.every((sc) => findAudio(d, sc.audioKey))) { DIR = d; break; }
}
if (!DIR) die('File narasi (.mp3) tidak lengkap di folder Download.');
scenes.forEach((sc) => { sc.audio = findAudio(DIR, sc.audioKey); });

const FONT = [process.env.FONT, '/system/fonts/Roboto-Regular.ttf', '/system/fonts/NotoSans-Regular.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'].find(fs.existsSync);
const FONT_BOLD = [process.env.FONT_BOLD, '/system/fonts/Roboto-Bold.ttf', '/system/fonts/NotoSans-Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(fs.existsSync) || FONT;
if (!FONT) die('Font tidak ditemukan.');

const WORK = process.env.AI_WORK || path.join(os.homedir(), 'render_ai');
const TXT = path.join(WORK, 'txt');
fs.mkdirSync(TXT, { recursive: true });
const OUT = process.env.AI_OUT || path.join(DIR, PREVIEW ? 'video_stickman_preview.mp4' : 'video_stickman_ai.mp4');
const tag = `${PREVIEW ? 'p' : 'f'}_stickman`;
const qp = (p) => `'${p}'`;
const f3 = (n) => n.toFixed(3);
function textFile(name, content) {
  const p = path.join(TXT, name + '.txt');
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/* ---------- Generator Animasi Stickman Minimalis via FFmpeg Filters ---------- */
function buildSegment(sc) {
  const acc = sc.accent;
  const seg = path.join(WORK, `seg_${tag}_${sc.idx}.mp4`);
  const g = [];
  const cx = W / 2, cy = H / 2 + px(20);

  // Latar Belakang Gelap Elegan
  g.push(`[0:v]format=gbrp[bg]`);

  // Gelombang suara minimalis di bawah
  const wh = px(80), wy = H - px(120);
  g.push(`[1:a]aformat=channel_layouts=mono,showwaves=s=${W}x${wh}:mode=line:rate=${FPS}:colors=${acc}:scale=sqrt,format=rgba,pad=${W}:${H}:0:${wy}:black,format=gbrp[wv]`);
  g.push(`[bg][wv]blend=all_mode=addition:all_opacity=0.8[b1]`);

  // Konstruksi Stickman Minimalis & Ikon Interaktif berdasarkan Animasi Type
  let cur = 'b1';
  let n = 0;
  const ov = (srcSpec, xe, ye) => {
    n++;
    g.push(`${srcSpec}[s${n}]`);
    g.push(`[${cur}][s${n}]overlay=x='${xe}':y='${ye}':eof_action=pass[o${n}]`);
    cur = `o${n}`;
  };

  // Kepala Stickman (Lingkaran) berdenyut/bergerak tipis mengikuti waktu
  const headSize = px(50);
  const hx = Math.round(cx - headSize/2);
  const hy = Math.round(cy - px(110));
  ov(`color=c=${acc}@0.9:s=${headSize}x${headSize}:r=${FPS}`, `${hx}+sin(t*3)*${px(5)}`, `${hy}`);

  // Badan Stickman (Garis Vertikal Utama)
  ov(`color=c=${acc}@0.9:s=${px(6)}x${px(90)}:r=${FPS}`, `${Math.round(cx - px(3))}`, `${hy + headSize}`);

  // Tangan & Kaki Animasi Sederhana Berdasarkan Tema Scene
  if (sc.animType === 'question') {
    // Tangan menunjuk / tanda tanya
    ov(`color=c=${acc}@0.9:s=${px(60)}x${px(6)}:r=${FPS}`, `${Math.round(cx - px(60))}`, `${hy + headSize + px(20)}`);
  } else if (sc.animType === 'deepfake') {
    // Efek Glitch / Topeng Ganda
    ov(`color=c=0xffffff@0.4:s=${headSize}x${headSize}:r=${FPS}`, `${hx + px(30) + Math.sin(t*20)*px(10)}`, `${hy}`);
  } else {
    // Tangan standar bergerak aktif
    ov(`color=c=${acc}@0.9:s=${px(50)}x${px(6)}:r=${FPS}`, `${Math.round(cx - px(50) + Math.sin(t*5)*px(15))}`, `${hy + headSize + px(30)}`);
  }

  // Label Judul Scene di Bagian Atas (Pengganti teks panjang)
  const f = [];
  f.push(`drawbox=x=${px(40)}:y=${px(40)}:w=${W - px(80)}:h=${px(60)}:color=0x000000@0.5:t=fill`);
  f.push(`drawbox=x=${px(40)}:y=${px(40)}:w=${W - px(80)}:h=${px(60)}:color=${acc}@0.4:t=${px(2)}`);
  
  const tagFile = textFile(`tag_${sc.idx}`, sc.label);
  f.push(`drawfontfile=${qp(FONT_BOLD)}:textfile=${qp(tagFile)}:fontsize=${px(28)}:fontcolor=${acc}:x=(w-text_w)/2:y=${px(55)}`);
  
  // Nomor Scene
  const cntFile = textFile(`cnt_${sc.idx}`, `BAGIAN ${sc.idx} / ${scenes.length}`);
  f.push(`drawtext=fontfile=${qp(FONT)}:textfile=${qp(cntFile)}:fontsize=${px(18)}:fontcolor=0x94a3b8:x=${px(60)}:y=${px(110)}`);

  f.push('format=yuv420p');
  g.push(`[${cur}]${f.join(',')}[vout]`);

  const a = ['-y', '-hide_banner', '-loglevel', 'error', '-stats',
    '-f', 'lavfi', '-i', `color=c=0x070b14:s=${W}x${H}:r=${FPS}`, '-i', sc.audio,
    '-filter_complex', g.join(';'),
    '-map', '[vout]', '-frames:v', String(sc.frames), '-r', String(FPS), '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', PREVIEW ? '28' : '23', '-pix_fmt', 'yuv420p', seg];
  return { seg, args: a };
}

/* ---------- Proses Eksekusi Render ---------- */
log(`\nMemulai Render Video Stickman Minimalis (${W}x${H} @${FPS}fps)\n`);
for (const sc of (ONLY ? scenes.filter(s => s.idx === ONLY) : scenes)) {
  const { seg, args: a } = buildSegment(sc);
  if (!has('--ulang') && fs.existsSync(seg)) { log(`[scene ${sc.idx}] Lewati (sudah ada)`); continue; }
  log(`[scene ${sc.idx}/${scenes.length}] Merender ${sc.label}...`);
  const r = run('ffmpeg', a);
  if (r.status !== 0) die(`Gagal render scene ${sc.idx}`);
}

if (ONLY) process.exit(0);

log('\nMenggabung video & audio akhir...');
const list = path.join(WORK, `concat_${tag}.txt`);
fs.writeFileSync(list, scenes.map((s) => `file '${path.join(WORK, `seg_${tag}_${s.idx}.mp4`)}'`).join('\n') + '\n');
const allV = path.join(WORK, `video_${tag}.mp4`);
run('ffmpeg', ['-y', '-hide_banner', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', allV]);

const allA = path.join(WORK, 'narasi_all.m4a');
const ain = []; const parts = [];
scenes.forEach((s, i) => { ain.push('-i', s.audio); parts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=mono[a${i}]`); });
run('ffmpeg', ['-y', '-hide_banner', ...ain, '-filter_complex', parts.join(';') + `;${scenes.map((_,i)=>`[a${i}]`).join('')}concat=n=${scenes.length}:v=0:a=1[aout]`, '-map', '[aout]','-c:a', 'aac', allA]);

run('ffmpeg', ['-y', '-hide_banner', '-i', allV, '-i', allA, '-c:v', 'copy', '-c:a', 'copy', '-shortest', OUT]);
log(`\nSELESAI! File tersimpan di:\n  ${OUT}\n`);
