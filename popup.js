document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab.url.includes('pustaka.ut.ac.id')) {
    alert('Harap buka halaman pembaca modul di pustaka.ut.ac.id terlebih dahulu!');
    return;
  }

  const statusEl = document.getElementById('status');
  const btn = document.getElementById('startBtn');
  
  btn.disabled = true;
  statusEl.innerText = 'Memuat library & bersiap...';

  // Suntikkan library jsPDF terlebih dahulu ke halaman aktif
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['jspdf.umd.min.js']
  }, () => {
    // Jalankan skrip utama otomatisasi
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: runAutoDownloader
    }, (results) => {
      btn.disabled = false;
      if (chrome.runtime.lastError) {
        statusEl.innerText = 'Error: ' + chrome.runtime.lastError.message;
      } else {
        statusEl.innerText = 'Selesai! PDF berhasil diunduh.';
      }
    });
  });
});

// Fungsi utama yang akan berjalan di dalam halaman web Pustaka UT
async function runAutoDownloader() {
  const statusDiv = document.getElementById('status') || createStatusBox();
  
  function updateStatus(text) {
    console.log(text);
    statusDiv.innerText = text;
  }

  function createStatusBox() {
    const div = document.createElement('div');
    div.id = 'status';
    div.style.cssText = 'position:fixed; top:20px; right:20px; background:black; color:white; padding:10px 15px; z-index:99999; border-radius:5px; font-family:sans-serif; font-size:14px;';
    document.body.appendChild(div);
    return div;
  }

  // Ambil judul modul dari header web untuk nama file PDF
  let titleEl = document.querySelector('header') || document.querySelector('title');
  let docTitle = titleEl ? titleEl.innerText.trim().replace(/[\/\\?%*:|"<>]/g, '-') : 'Modul-Pustaka-UT';
  if (docTitle.length > 50) docTitle = "Modul-Pustaka-UT";

  updateStatus('Memulai proses otomatisasi...');

  let images = [];
  let maxPages = 200; // Batas aman maksimal halaman agar tidak infinite loop
  let currentPage = 1;

  // Fungsi jeda waktu (delay) agar halaman sempat merender sempurna setelah diklik Next
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Load html2canvas secara dinamis jika belum ada di halaman
  if (typeof html2canvas === 'undefined') {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  while (currentPage <= maxPages) {
    updateStatus(`Merekam halaman ${currentPage}...`);
    
    // Screenshot area modul
    let canvas = await html2canvas(document.body, {
      scale: 1.5, // Kualitas ketajaman gambar
      useCORS: true,
      logging: false,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    });

    images.push(canvas.toDataURL('image/jpeg', 0.85));

    // Cari tombol Next
    let nextBtn = document.querySelector('button[aria-label*="Next"], .next-page, .fa-chevron-right, button:has(> .fa-angle-right), .right-arrow') || 
                  Array.from(document.querySelectorAll('button, div')).find(el => el.innerText.trim() === '>' || el.title?.toLowerCase().includes('next'));

    if (!nextBtn) {
      const buttons = document.querySelectorAll('button');
      for (let btn of buttons) {
        let rect = btn.getBoundingClientRect();
        if (rect.left > window.innerWidth / 2 && rect.top > window.innerHeight / 3 && rect.top < (window.innerHeight / 3) * 2) {
          nextBtn = btn;
          break;
        }
      }
    }

    if (!nextBtn || nextBtn.disabled || nextBtn.classList.contains('disabled')) {
      updateStatus('Tombol Next habis atau sudah di halaman terakhir.');
      break;
    }

    // Klik tombol Next
    nextBtn.click();
    currentPage++;
    
    // Tunggu halaman berpindah dan termuat sempurna
    await sleep(1500); 
  }

  updateStatus('Menggabungkan gambar menjadi PDF...');

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < images.length; i++) {
      if (i > 0) pdf.addPage();
      pdf.addImage(images[i], 'JPEG', 0, 0, pageWidth, pageHeight);
    }

    pdf.save(`${docTitle}.pdf`);
    updateStatus('Selesai! PDF berhasil diunduh.');
    setTimeout(() => statusDiv.remove(), 4000);
  } catch (err) {
    updateStatus('Gagal membuat PDF: ' + err.message);
  }
}
