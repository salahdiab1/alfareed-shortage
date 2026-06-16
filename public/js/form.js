'use strict';

const WORKER_KEY = 'alfareed_worker';

const PRESET_NAMES = ['سعد','جواد','احمد','عبد الله','عماد','محمد عيسى'];

const formCard         = document.getElementById('formCard');
const successCard      = document.getElementById('successCard');
const reportForm       = document.getElementById('reportForm');
const workerSelect     = document.getElementById('workerSelect');
const workerCustomInput= document.getElementById('workerNameCustom');
const productNameInput = document.getElementById('productName');
const notesInput       = document.getElementById('notes');
const priorityInput    = document.getElementById('priorityInput');
const priorityBtns     = document.querySelectorAll('.priority-btn');
const photoInput       = document.getElementById('photoInput');
const photoPlaceholder = document.getElementById('photoPlaceholder');
const photoPreview     = document.getElementById('photoPreview');
const previewImg       = document.getElementById('previewImg');
const removePhotoBtn   = document.getElementById('removePhoto');
const submitBtn        = document.getElementById('submitBtn');
const btnText          = submitBtn.querySelector('.btn-text');
const btnSpinner       = submitBtn.querySelector('.btn-spinner');
const anotherBtn       = document.getElementById('anotherBtn');

let compressedFile = null;

function getWorkerName() {
  if (workerSelect.value === '__other__') return workerCustomInput.value.trim();
  return workerSelect.value;
}

// Restore from localStorage
const savedName = localStorage.getItem(WORKER_KEY);
if (savedName) {
  if (PRESET_NAMES.includes(savedName)) {
    workerSelect.value = savedName;
  } else {
    workerSelect.value = '__other__';
    workerCustomInput.value = savedName;
    workerCustomInput.hidden = false;
  }
}

// Show/hide custom input when selecting "اسم آخر"
workerSelect.addEventListener('change', () => {
  const isOther = workerSelect.value === '__other__';
  workerCustomInput.hidden = !isOther;
  if (isOther) workerCustomInput.focus();
  clearFieldError('workerNameError', workerSelect);
});

workerCustomInput.addEventListener('input', () => {
  clearFieldError('workerNameError', workerCustomInput);
});

// Priority toggle
priorityBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    priorityBtns.forEach(b => b.classList.remove('selected-urgent', 'selected-normal'));
    const val = btn.dataset.value;
    btn.classList.add(val === 'urgent' ? 'selected-urgent' : 'selected-normal');
    priorityInput.value = val;
    clearFieldError('priorityError');
  });
});

// Photo upload
photoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    compressedFile = await compressImage(file);
    previewImg.src = URL.createObjectURL(compressedFile);
    photoPlaceholder.hidden = true;
    photoPreview.hidden = false;
  } catch (err) {
    console.error('Image compression failed:', err);
  }
});

removePhotoBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  compressedFile = null;
  photoInput.value = '';
  previewImg.src = '';
  photoPlaceholder.hidden = false;
  photoPreview.hidden = true;
});

// Clear errors on input change
productNameInput.addEventListener('input', () => clearFieldError('productNameError', productNameInput));
notesInput.addEventListener('input', () => clearFieldError('notesError', notesInput));

// Submit
submitBtn.addEventListener('click', async () => {
  clearFieldError('submitError');
  submitBtn.classList.remove('btn-error');

  if (!validateForm()) {
    submitBtn.classList.add('btn-error');
    return;
  }

  localStorage.setItem(WORKER_KEY, getWorkerName());

  const formData = new FormData();
  formData.append('worker_name', getWorkerName());
  formData.append('product',     productNameInput.value.trim());
  formData.append('notes',       notesInput.value.trim());
  formData.append('priority',    priorityInput.value);
  if (compressedFile) formData.append('photo', compressedFile);

  setLoading(true);

  try {
    const res  = await fetch('/api/reports', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'حدث خطأ في الخادم');
    showSuccess();
  } catch (err) {
    setLoading(false);
    submitBtn.classList.add('btn-error');
    const msg = err.message === 'Failed to fetch'
      ? 'تعذر الاتصال بالخادم، تحقق من الشبكة'
      : err.message || 'حدث خطأ في الخادم، حاول مرة أخرى';
    showFieldError('submitError', msg);
  }
});

// Another report
anotherBtn.addEventListener('click', resetForm);

// --- Helpers ---

function validateForm() {
  let valid = true;

  if (!getWorkerName()) {
    showFieldError('workerNameError', workerSelect.value === '__other__' ? 'أدخل اسمك' : 'اختر اسمك');
    (workerSelect.value === '__other__' ? workerCustomInput : workerSelect).classList.add('input-error');
    valid = false;
  } else {
    clearFieldError('workerNameError', workerSelect);
    workerCustomInput.classList.remove('input-error');
  }

  if (!productNameInput.value.trim()) {
    showFieldError('productNameError', 'هذا الحقل مطلوب');
    productNameInput.classList.add('input-error');
    valid = false;
  } else {
    clearFieldError('productNameError', productNameInput);
  }

  if (!priorityInput.value) {
    showFieldError('priorityError', 'اختر الأولوية');
    valid = false;
  } else {
    clearFieldError('priorityError');
  }

  return valid;
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function clearFieldError(id, input) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
  if (input) input.classList.remove('input-error');
}

function setLoading(on) {
  submitBtn.disabled = on;
  btnText.hidden = on;
  btnSpinner.hidden = !on;
}

function showSuccess() {
  formCard.hidden = true;
  successCard.hidden = false;
}

function resetForm() {
  productNameInput.value = '';
  notesInput.value       = '';
  priorityInput.value    = '';
  priorityBtns.forEach(b => b.classList.remove('selected-urgent', 'selected-normal'));
  compressedFile = null;
  photoInput.value = '';
  previewImg.src = '';
  photoPlaceholder.hidden = false;
  photoPreview.hidden = true;

  ['workerNameError','productNameError','notesError','priorityError','submitError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  [workerSelect, workerCustomInput, productNameInput, notesInput].forEach(el => el.classList.remove('input-error'));

  setLoading(false);
  successCard.hidden = true;
  formCard.hidden = false;
  productNameInput.focus();
}

// --- Image Compression ---
async function compressImage(file, maxWidth = 1200, quality = 0.75, maxSizeKB = 300) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio  = Math.min(maxWidth / img.width, 1);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        let q = quality;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (blob.size / 1024 > maxSizeKB && q > 0.4) {
              q -= 0.05;
              tryCompress();
            } else {
              resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
            }
          }, 'image/jpeg', q);
        };
        tryCompress();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
