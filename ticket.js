/**
 * TripInn Holidays — Digital Travel Pass Controller
 * Apple Design System & Mobile-First Implementation
 * Renders traveler details onto Template_bg.png (1024 × 1536 px)
 * Displays the ticket immediately on load, and enables instant PNG download & native sharing.
 */

const SECRET_KEY = 'tripinn-super-secret-key-2026';
const TICKET_TEMPLATE = 'Template_bg.png';

// Cache loaded template image and current state
let cachedTemplateImage = null;
let currentTicketBlob = null;
let currentTicketData = null;
let isExporting = false;

// ============================================================================
// 1. Read and Decrypt Ticket Link
// ============================================================================

function getHashParam(key) {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  return new URLSearchParams(hash).get(key);
}

function decryptData(cipher, key) {
  if (!cipher || typeof cipher !== 'string') return null;

  const candidates = [cipher];

  try {
    const decoded = decodeURIComponent(cipher);
    if (decoded !== cipher) candidates.push(decoded);
  } catch {}

  for (const candidate of candidates) {
    try {
      const bytes = CryptoJS.AES.decrypt(candidate, key);
      const result = bytes.toString(CryptoJS.enc.Utf8);

      if (!result) continue;

      const data = JSON.parse(result);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data;
      }
    } catch {}
  }

  console.warn('Ticket decryption failed for cipher candidate.');
  return null;
}

// ============================================================================
// 2. Data Normalization Helper
// ============================================================================

function isDateString(str) {
  if (!str) return false;
  const s = String(str).toLowerCase();
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return months.some(m => s.includes(m)) || /\d{1,2}[-/.]\d{1,2}/.test(s) || (/\d{4}/.test(s) && s.includes('-'));
}

function isDurationString(str) {
  if (!str) return false;
  const s = String(str).toLowerCase();
  return s.includes('day') || s.includes('night') || /\d+\s*[dn]\b/.test(s) || /\d+d\/\d+n/.test(s);
}

function normalizeTicketData(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const name = String(raw.n || raw.name || raw.traveler || 'KARTHIK SUBRAMANIAN').trim();
  const ticketId = String(raw.i || raw.ticketId || raw.id || 'TRIPINN-KD-01').trim();
  const phone = String(raw.p || raw.phone || '').trim();

  let trip = '';
  let date = '';
  let duration = '';
  let tag = String(raw.g || raw.tag || '').trim();

  if (raw.trip || raw.destination) trip = raw.trip || raw.destination;
  if (raw.date || raw.dates) date = raw.date || raw.dates;
  if (raw.duration) duration = raw.duration;

  // Short keys resolution
  if (!trip) {
    if (raw.t && !isDateString(raw.t) && !isDurationString(raw.t) && raw.t !== 'HILL STATION GETAWAY') {
      trip = raw.t;
    } else if (raw.d && !isDateString(raw.d)) {
      trip = raw.d;
    }
  }

  if (!date) {
    if (raw.d && isDateString(raw.d)) {
      date = raw.d;
    } else if (raw.u && isDateString(raw.u)) {
      date = raw.u;
    }
  }

  if (!duration) {
    if (raw.u && isDurationString(raw.u)) {
      duration = raw.u;
    } else if (raw.v && isDurationString(raw.v)) {
      duration = raw.v;
    }
  }

  if (!tag) {
    if (raw.t && (raw.t === 'HILL STATION GETAWAY' || raw.t === 'VACATION GETAWAY')) {
      tag = raw.t;
    }
  }

  // Fallbacks
  if (!trip) trip = 'KODAIKANAL';
  if (!date) date = '17 Oct - 20 Oct, 2026';
  if (!duration) duration = '3 Days / 2 Nights';

  return { name, ticketId, phone, trip, date, duration, tag };
}

// ============================================================================
// 3. Load Template Asset
// ============================================================================

function loadTemplateImage(src) {
  if (cachedTemplateImage) {
    return Promise.resolve(cachedTemplateImage);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      cachedTemplateImage = img;
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load ticket template image from: ${src}`));
    };

    img.src = src;
  });
}

// ============================================================================
// 4. Typography Helpers
// ============================================================================

function drawFittedText(context, text, x, baselineY, maxWidth, initialSize, weight = '700', fontName = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif') {
  const value = String(text || '').trim();
  let size = initialSize;

  context.font = `${weight} ${size}px ${fontName}`;

  while (context.measureText(value).width > maxWidth && size > 12) {
    size -= 1;
    context.font = `${weight} ${size}px ${fontName}`;
  }

  context.fillText(value, x, baselineY, maxWidth);
  return size;
}

// ============================================================================
// 5. Core Ticket Renderer
// ============================================================================

async function renderTicketCanvas(template, rawData) {
  const data = normalizeTicketData(rawData);

  const canvas = document.getElementById('offscreenTicketCanvas') || document.createElement('canvas');
  canvas.width = template.naturalWidth || template.width || 1024;
  canvas.height = template.naturalHeight || template.height || 1536;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
  }

  // Draw background template image
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

  // 5B. Destination & Tag Pill
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 52px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  const destX = 172;
  const destY = 478;
  const rawTrip = String(data.trip || 'KODAIKANAL').trim();
  const destName = rawTrip.replace(/\s*\([^)]*\)/, '').trim().toUpperCase();

  drawFittedText(ctx, destName, destX, destY, 650, 52, '900', '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif');

  // Pill badge below destination
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  const pillText = (
    data.tag ||
    (destName.includes('KODAI') ? 'HILL STATION GETAWAY' :
     destName.includes('MUNN') ? 'HILL STATION GETAWAY' :
     destName.includes('OOTY') ? 'HILL STATION GETAWAY' :
     'VACATION GETAWAY')
  ).toUpperCase();

  ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif';
  const textWidth = ctx.measureText(pillText).width;
  const pillPaddingX = 22;
  const pillWidth = textWidth + pillPaddingX * 2;
  const pillHeight = 34;
  const pillX = destX;
  const pillY = 498;
  const pillRadius = 17;

  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillRadius);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillHeight / 2 + 1);
  ctx.restore();

  // 5C. Customer Name
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111827';
  const customerName = String(data.name || 'KARTHIK SUBRAMANIAN').trim().toUpperCase();
  drawFittedText(ctx, customerName, 285, 736, 580, 34, '800', '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif');
  ctx.restore();

  // 5D. Travel Dates & Duration
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#111827';
  const travelDates = String(data.date || '17 Oct - 20 Oct, 2026').trim();
  drawFittedText(ctx, travelDates, 285, 846, 580, 30, '800', '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif');

  // Subtitle duration in parenthesis
  let durationStr = data.duration || '';
  if (!durationStr && data.trip) {
    const parenMatch = data.trip.match(/\(([^)]+)\)/);
    if (parenMatch) durationStr = parenMatch[1];
  }
  if (!durationStr) durationStr = '3 Days / 2 Nights';
  if (!durationStr.startsWith('(')) durationStr = `(${durationStr})`;

  ctx.fillStyle = '#475569';
  ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif';
  ctx.fillText(durationStr, 285, 878);
  ctx.restore();

  // 5E. White Barcode Card Container
  ctx.save();
  const cardWidth = 704;
  const cardHeight = 146;
  const cardX = (canvas.width - cardWidth) / 2;
  const cardY = 1085;
  const cardRadius = 24;

  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardWidth, cardHeight, cardRadius);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Barcode Generation
  const barcodeCode = String(data.ticketId || 'TRIPINN-01');

  if (typeof JsBarcode !== 'undefined') {
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, barcodeCode, {
      format: 'CODE128',
      displayValue: false,
      lineColor: '#0a0f1d',
      background: 'rgba(0,0,0,0)',
      width: 2,
      height: 68,
      margin: 0
    });

    const barcodeWidth = 600;
    const barcodeHeight = 68;
    const barcodeX = (canvas.width - barcodeWidth) / 2;
    const barcodeY = cardY + 24;
    ctx.drawImage(barcodeCanvas, barcodeX, barcodeY, barcodeWidth, barcodeHeight);
  }

  // Barcode text below barcode inside white card
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#1f2937';
  ctx.font = '700 17px ui-monospace, Menlo, Consolas, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText(barcodeCode, canvas.width / 2, cardY + 118);
  ctx.restore();

  // Export to Blob and DataURL
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const dataUrl = canvas.toDataURL('image/png');

  return { canvas, blob, dataUrl, normalizedData: data };
}

// ============================================================================
// 6. Display Ticket on Screen & Populate Pass Details
// ============================================================================

async function displayTicket(rawData) {
  const skeleton = document.getElementById('ticketSkeleton');
  const cardWrapper = document.getElementById('ticketCardWrapper');
  const displayImage = document.getElementById('ticketDisplayImage');
  const actionsPanel = document.getElementById('actionsPanel');
  const passDetailsCard = document.getElementById('passDetailsCard');

  try {
    const template = await loadTemplateImage(TICKET_TEMPLATE);
    if (document.fonts) {
      await document.fonts.ready;
    }

    const { blob, dataUrl, normalizedData } = await renderTicketCanvas(template, rawData);

    currentTicketBlob = blob;
    currentTicketData = normalizedData;

    if (displayImage) {
      displayImage.src = dataUrl;
    }

    // Populate Apple Inset Grouped Pass Details
    const passDetailTraveler = document.getElementById('passDetailTraveler');
    const passDetailTrip = document.getElementById('passDetailTrip');
    const passDetailDate = document.getElementById('passDetailDate');
    const passDetailDuration = document.getElementById('passDetailDuration');
    const passDetailId = document.getElementById('passDetailId');

    if (passDetailTraveler) passDetailTraveler.textContent = normalizedData.name;
    if (passDetailTrip) {
      const tagText = normalizedData.tag ? ` • ${normalizedData.tag}` : '';
      passDetailTrip.textContent = normalizedData.trip + tagText;
    }
    if (passDetailDate) passDetailDate.textContent = normalizedData.date;
    if (passDetailDuration) passDetailDuration.textContent = normalizedData.duration ? `(${normalizedData.duration})` : '';
    if (passDetailId) passDetailId.textContent = normalizedData.ticketId;

    // Reveal UI
    if (skeleton) skeleton.style.display = 'none';
    if (cardWrapper) cardWrapper.style.display = 'flex';
    if (actionsPanel) actionsPanel.style.display = 'flex';
    if (passDetailsCard) passDetailsCard.style.display = 'flex';

    const caption = document.getElementById('ticketCaption');
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    if (caption && isMobileDevice) {
      caption.style.display = 'flex';
    }

  } catch (error) {
    console.error('Failed to display ticket:', error);
    showErrorScreen('An unexpected error occurred while rendering your ticket. Please refresh the page.');
  }
}

// ============================================================================
// 7. Error Screen Handlers
// ============================================================================

function showErrorScreen(message) {
  const portalCard = document.getElementById('portalLandingCard');
  const ticketStage = document.getElementById('ticketStage');
  const errorContainer = document.getElementById('errorContainer');
  const errorMessageText = document.getElementById('errorMessageText');
  const skeleton = document.getElementById('ticketSkeleton');

  if (portalCard) portalCard.style.display = 'none';
  if (ticketStage) ticketStage.style.display = 'none';
  if (skeleton) skeleton.style.display = 'none';

  if (errorMessageText) {
    errorMessageText.textContent = message;
  }
  if (errorContainer) {
    errorContainer.style.display = 'block';
  }
}

function hideErrorScreen() {
  const errorContainer = document.getElementById('errorContainer');
  if (errorContainer) errorContainer.style.display = 'none';
}

// ============================================================================
// 8. Download Handler
// ============================================================================

async function handleDownload() {
  if (isExporting || !currentTicketBlob) return;

  const downloadBtn = document.getElementById('downloadTrigger');
  const btnText = downloadBtn ? downloadBtn.querySelector('.btn-text') : null;

  try {
    isExporting = true;
    if (downloadBtn) {
      downloadBtn.classList.add('is-loading');
      downloadBtn.disabled = true;
      if (btnText) btnText.textContent = 'Saving PNG...';
    }

    await new Promise(r => setTimeout(r, 60));

    const safeName = String(currentTicketData?.name || 'Customer')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `TripInn-Ticket-${safeName}.png`;

    const ticketUrl = URL.createObjectURL(currentTicketBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = ticketUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setTimeout(() => URL.revokeObjectURL(ticketUrl), 30000);

    showToast('Ticket PNG saved to device!', 'fa-solid fa-circle-check');

    if (btnText) btnText.textContent = 'Saved!';
    setTimeout(() => {
      if (btnText) btnText.textContent = 'Download Ticket (PNG)';
    }, 2000);

  } catch (error) {
    console.error('Download failed:', error);
    showToast('Could not download your ticket. Please try again.', 'fa-solid fa-circle-exclamation');
  } finally {
    isExporting = false;
    if (downloadBtn) {
      downloadBtn.classList.remove('is-loading');
      downloadBtn.disabled = false;
    }
  }
}

// ============================================================================
// 9. Clipboard & Dynamic Island Toast Helpers
// ============================================================================

let toastTimeout = null;
function showToast(message, icon = 'fa-solid fa-circle-check') {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'dynamic-toast-capsule';
    toast.innerHTML = `<div class="dynamic-toast-content"><i class="${icon} toast-icon"></i><span class="toast-message"></span></div>`;
    document.body.appendChild(toast);
  }

  const msgSpan = toast.querySelector('.toast-message');
  const iconEl = toast.querySelector('.toast-icon');
  if (msgSpan) msgSpan.textContent = message;
  if (iconEl) iconEl.className = `${icon} toast-icon`;

  toast.classList.add('show');

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('Clipboard writeText failed:', err);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    textarea.remove();
    return success;
  } catch {
    return false;
  }
}

const copyToClipboard = copyTextToClipboard;

async function copyImageToClipboard(blob) {
  if (!blob) return false;
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.warn('Clipboard image write failed:', err);
    }
  }
  return false;
}

// ============================================================================
// 10. Multi-View WhatsApp & Instagram Share Logic
// ============================================================================

function switchShareView(viewName) {
  const mainView = document.getElementById('shareMainView');
  const waView = document.getElementById('shareWhatsAppView');
  const instaView = document.getElementById('shareInstagramView');

  if (mainView) mainView.style.display = viewName === 'main' ? 'flex' : 'none';
  if (waView) waView.style.display = viewName === 'whatsapp' ? 'flex' : 'none';
  if (instaView) instaView.style.display = viewName === 'instagram' ? 'flex' : 'none';

  if (viewName === 'instagram') {
    const qrImg = document.getElementById('qrCodeImg');
    if (qrImg) {
      let mobileUrl = window.location.href;
      if (mobileUrl.includes('localhost') || mobileUrl.includes('127.0.0.1')) {
        mobileUrl = mobileUrl.replace('localhost', '192.168.1.6').replace('127.0.0.1', '192.168.1.6');
      }
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(mobileUrl)}`;
    }
  }

  if (viewName === 'whatsapp') {
    const waLink = document.getElementById('openWhatsAppDirectBtn');
    if (waLink) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      waLink.href = isMobile ? 'whatsapp://send' : 'https://web.whatsapp.com';
    }
  }
}

function openShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    switchShareView('main');
    modal.style.display = 'flex';
  }
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.style.display = 'none';
    switchShareView('main');
  }
}

async function shareToWhatsApp() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // If mobile with file sharing support, use native share sheet directly to WhatsApp
  if (isMobile && currentTicketBlob && navigator.share && typeof navigator.canShare === 'function') {
    const file = new File([currentTicketBlob], `TripInn-Ticket.png`, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        closeShareModal();
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
  }

  // Desktop or fallback: Copy image blob directly to clipboard and switch to WhatsApp guide
  const imgCopied = await copyImageToClipboard(currentTicketBlob);
  switchShareView('whatsapp');

  if (imgCopied) {
    showToast('Ticket image copied to clipboard! Paste (Ctrl+V) in WhatsApp chat.', 'fa-brands fa-whatsapp');
  } else {
    showToast('Click Open WhatsApp below to start your chat.', 'fa-brands fa-whatsapp');
  }
}

async function shareToInstagram() {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // If mobile with file sharing support, native share accepts pure image share
  if (isMobile && currentTicketBlob && navigator.share && typeof navigator.canShare === 'function') {
    const file = new File([currentTicketBlob], `TripInn-Ticket.png`, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        closeShareModal();
        await navigator.share({ files: [file] });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
  }

  // Desktop fallback: copy image and show Instagram guide with mobile QR code
  await copyImageToClipboard(currentTicketBlob);
  switchShareView('instagram');
  showToast('Scan QR code with your phone camera to share on Instagram Stories!', 'fa-brands fa-instagram');
}

// ============================================================================
// 11. Primary Share Button Handler (Mobile Native -> Modal Fallback)
// ============================================================================

async function handleShare() {
  try {
    if (!currentTicketData) return;

    if (!currentTicketBlob) {
      const template = await loadTemplateImage(TICKET_TEMPLATE);
      const res = await renderTicketCanvas(template, currentTicketData);
      currentTicketBlob = res.blob;
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // If mobile with file sharing support:
    if (isMobile && navigator.share && typeof navigator.canShare === 'function') {
      const customerName = currentTicketData?.name || 'Traveler';
      const safeName = String(customerName)
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_');

      const file = new File(
        [currentTicketBlob],
        `TripInn-Ticket-${safeName}.png`,
        { type: 'image/png' }
      );

      let canShareFiles = false;
      try {
        canShareFiles = navigator.canShare({ files: [file] });
      } catch {
        canShareFiles = false;
      }

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file]
          });
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // User closed sheet
          console.warn('Native file share cancelled or failed, opening sheet:', err);
        }
      }
    }

    // On desktop or when native file share is unavailable: open the Apple Bottom Sheet Modal!
    openShareModal();

  } catch (error) {
    console.error('Share failed:', error);
    openShareModal();
  }
}

// ============================================================================
// 12. Application Initialization & Event Wiring
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const downloadBtn = document.getElementById('downloadTrigger');
  const shareBtn = document.getElementById('shareTrigger');
  const headerStatusPill = document.getElementById('headerStatusPill');
  const headerStatusText = document.getElementById('headerStatusText');
  const headerBrandHome = document.getElementById('headerBrandHome');

  // Primary action buttons
  if (downloadBtn) downloadBtn.addEventListener('click', handleDownload);
  if (shareBtn) shareBtn.addEventListener('click', handleShare);

  // Brand logo in header returns to portal
  if (headerBrandHome) {
    headerBrandHome.style.cursor = 'pointer';
    headerBrandHome.addEventListener('click', () => {
      history.pushState('', document.title, window.location.pathname + window.location.search);
      showPortalView();
    });
  }

  // Copy Ticket ID in Pass Details Card
  const copyTicketIdBtn = document.getElementById('copyTicketIdBtn');
  if (copyTicketIdBtn) {
    copyTicketIdBtn.addEventListener('click', async () => {
      if (currentTicketData?.ticketId) {
        const ok = await copyTextToClipboard(currentTicketData.ticketId);
        if (ok) {
          showToast(`Copied Ticket ID: ${currentTicketData.ticketId}`, 'fa-regular fa-copy');
        }
      }
    });
  }

  // Wire Share Modal Options
  const closeShareModalBtn = document.getElementById('closeShareModal');
  const cancelShareSheetBtn = document.getElementById('cancelShareSheetBtn');
  const shareModal = document.getElementById('shareModal');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareInstagramBtn = document.getElementById('shareInstagramBtn');
  const savePhotosBtn = document.getElementById('savePhotosBtn');
  const copyImageBtn = document.getElementById('copyImageBtn');
  const copyLinkBtn = document.getElementById('copyLinkBtn');

  // Sub-view buttons
  const backFromWaBtn = document.getElementById('backFromWaBtn');
  const recopyWaBtn = document.getElementById('recopyWaBtn');
  const backFromInstaBtn = document.getElementById('backFromInstaBtn');
  const saveForInstaBtn = document.getElementById('saveForInstaBtn');
  const copyForInstaBtn = document.getElementById('copyForInstaBtn');

  if (closeShareModalBtn) closeShareModalBtn.addEventListener('click', closeShareModal);
  if (cancelShareSheetBtn) cancelShareSheetBtn.addEventListener('click', closeShareModal);

  if (shareModal) {
    shareModal.addEventListener('click', e => {
      if (e.target === shareModal) closeShareModal();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeShareModal();
  });

  if (shareWhatsAppBtn) shareWhatsAppBtn.addEventListener('click', shareToWhatsApp);
  if (shareInstagramBtn) shareInstagramBtn.addEventListener('click', shareToInstagram);

  if (savePhotosBtn) {
    savePhotosBtn.addEventListener('click', () => {
      closeShareModal();
      handleDownload();
    });
  }

  if (copyImageBtn) {
    copyImageBtn.addEventListener('click', async () => {
      closeShareModal();
      const success = await copyImageToClipboard(currentTicketBlob);
      if (success) {
        showToast('Ticket image copied to clipboard! Paste directly into chat.', 'fa-regular fa-copy');
      } else {
        handleDownload();
      }
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      closeShareModal();
      await copyTextToClipboard(window.location.href);
      showToast('Pass link copied to clipboard!', 'fa-solid fa-link');
    });
  }

  // Guide view sub-actions
  if (backFromWaBtn) {
    backFromWaBtn.addEventListener('click', () => switchShareView('main'));
  }
  if (recopyWaBtn) {
    recopyWaBtn.addEventListener('click', async () => {
      const success = await copyImageToClipboard(currentTicketBlob);
      if (success) {
        showToast('Ticket image copied to clipboard! Press Ctrl+V in WhatsApp.', 'fa-regular fa-copy');
      } else {
        showToast('Image clipboard access not available.', 'fa-solid fa-circle-exclamation');
      }
    });
  }

  if (backFromInstaBtn) {
    backFromInstaBtn.addEventListener('click', () => switchShareView('main'));
  }
  if (saveForInstaBtn) {
    saveForInstaBtn.addEventListener('click', () => {
      handleDownload();
      showToast('Ticket saved! Open Instagram app → Add to Story.', 'fa-brands fa-instagram');
    });
  }
  if (copyForInstaBtn) {
    copyForInstaBtn.addEventListener('click', async () => {
      const success = await copyImageToClipboard(currentTicketBlob);
      if (success) {
        showToast('Ticket image copied! Paste directly in Instagram Web DMs.', 'fa-regular fa-copy');
      } else {
        showToast('Image clipboard access not available.', 'fa-solid fa-circle-exclamation');
      }
    });
  }

  // Portal Navigation & Mode Switchers
  function showPortalView() {
    const portalCard = document.getElementById('portalLandingCard');
    const ticketStage = document.getElementById('ticketStage');
    const errorContainer = document.getElementById('errorContainer');
    const passDetailsCard = document.getElementById('passDetailsCard');

    if (errorContainer) errorContainer.style.display = 'none';
    if (ticketStage) ticketStage.style.display = 'none';
    if (passDetailsCard) passDetailsCard.style.display = 'none';
    if (portalCard) portalCard.style.display = 'flex';

    if (headerStatusPill) {
      headerStatusPill.className = 'status-pill portal';
    }
    if (headerStatusText) {
      headerStatusText.textContent = 'Official Portal';
    }
  }

  function showTicketView() {
    const portalCard = document.getElementById('portalLandingCard');
    const ticketStage = document.getElementById('ticketStage');
    const errorContainer = document.getElementById('errorContainer');

    if (portalCard) portalCard.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'none';
    if (ticketStage) ticketStage.style.display = 'flex';

    if (headerStatusPill) {
      headerStatusPill.className = 'status-pill verified';
    }
    if (headerStatusText) {
      headerStatusText.textContent = 'Verified Boarding Pass';
    }
  }

  function initPassFromHash() {
    const passParam = getHashParam('pass');

    if (passParam) {
      if (typeof CryptoJS === 'undefined') {
        showErrorScreen('Decryption library failed to load. Please check your internet connection and reload.');
        return;
      }

      const decrypted = decryptData(passParam, SECRET_KEY);
      if (decrypted) {
        showTicketView();
        displayTicket(decrypted);
      } else {
        showErrorScreen('The ticket link provided could not be decrypted or has expired. Please check your link.');
      }
    } else {
      showPortalView();
    }
  }

  // Portal Lookup Controls
  const lookupPassBtn = document.getElementById('lookupPassBtn');
  const passLinkInput = document.getElementById('passLinkInput');
  const clearPassBtn = document.getElementById('clearPassBtn');
  const pastePassBtn = document.getElementById('pastePassBtn');
  const lookupError = document.getElementById('lookupError');
  const backToPortalBtn = document.getElementById('backToPortalBtn');
  const returnToPortalBtn = document.getElementById('returnToPortalBtn');

  function handlePassLookup() {
    if (!passLinkInput) return;
    const rawVal = (passLinkInput.value || '').trim();
    if (!rawVal) {
      if (lookupError) {
        lookupError.textContent = 'Please enter or paste your booking link or pass token.';
        lookupError.style.display = 'block';
      }
      return;
    }

    const match = rawVal.match(/pass=([^&#]+)/);
    const token = match ? match[1] : rawVal;

    if (typeof CryptoJS === 'undefined') {
      if (lookupError) {
        lookupError.textContent = 'Decryption library is loading, please try again in a moment.';
        lookupError.style.display = 'block';
      }
      return;
    }

    const decrypted = decryptData(token, SECRET_KEY);
    if (decrypted) {
      if (lookupError) lookupError.style.display = 'none';
      window.location.hash = '#pass=' + token;
    } else {
      if (lookupError) {
        lookupError.textContent = 'Invalid ticket token. Please paste the full link sent by TripInn Holidays.';
        lookupError.style.display = 'block';
      }
    }
  }

  if (lookupPassBtn) lookupPassBtn.addEventListener('click', handlePassLookup);

  if (passLinkInput) {
    passLinkInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handlePassLookup();
      }
    });

    passLinkInput.addEventListener('input', () => {
      if (lookupError) lookupError.style.display = 'none';
      if (clearPassBtn) {
        clearPassBtn.style.display = passLinkInput.value ? 'flex' : 'none';
      }
    });
  }

  if (clearPassBtn) {
    clearPassBtn.addEventListener('click', () => {
      if (passLinkInput) {
        passLinkInput.value = '';
        passLinkInput.focus();
      }
      clearPassBtn.style.display = 'none';
      if (lookupError) lookupError.style.display = 'none';
    });
  }

  if (pastePassBtn && passLinkInput) {
    pastePassBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text) {
            passLinkInput.value = text.trim();
            if (clearPassBtn) clearPassBtn.style.display = 'flex';
            handlePassLookup();
            return;
          }
        }
      } catch (err) {
        console.warn('Clipboard readText failed or was denied:', err);
      }
      passLinkInput.focus();
      showToast('Please paste your link into the field.', 'fa-solid fa-paste');
    });
  }

  // Wire Sample Traveler Chips
  document.querySelectorAll('.sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const token = chip.getAttribute('data-token');
      if (token) {
        window.location.hash = '#pass=' + token;
      }
    });
  });

  if (backToPortalBtn) {
    backToPortalBtn.addEventListener('click', () => {
      history.pushState('', document.title, window.location.pathname + window.location.search);
      showPortalView();
    });
  }

  if (returnToPortalBtn) {
    returnToPortalBtn.addEventListener('click', () => {
      history.pushState('', document.title, window.location.pathname + window.location.search);
      showPortalView();
    });
  }

  window.addEventListener('hashchange', initPassFromHash);

  // Initialize view based on current hash
  initPassFromHash();
});