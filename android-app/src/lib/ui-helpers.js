/**
 * Modern Web UI helpers:
 * 1. Light-dismiss modal dialog fallback for browsers without <dialog closedby="any">
 * 2. :user-invalid / :user-valid WeakMap interaction tracker fallback
 * 3. Client-side image compression for vaccination booklet photo attachments
 */

/**
 * Registers the light-dismiss backdrop click fallback on a <dialog closedby="any"> element
 * for engines that do not yet support `HTMLDialogElement.prototype.closedBy`.
 */
export function wireLightDismissDialog(dialog) {
  if (!dialog) return;
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      dialog.close();
    });
  }
}

/**
 * Tracks user interaction on form inputs using a WeakMap so validation feedback
 * is only shown after interaction/blur (fallback for `:user-invalid`).
 */
export function initUserInvalidFallback(root = document) {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    if (typeof input.checkValidity !== 'function') return;
    const isValid = input.checkValidity();
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);
    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;
    if (event.type === 'reset') {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }
    if (!input || typeof input.checkValidity !== 'function') return;

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) updateState(input);
    } else if (event.type === 'blur') {
      const state = dirtyState.get(input);
      if (state && state.hasInteracted) {
        state.hasBlurred = true;
        updateState(input);
      }
    } else if (event.type === 'invalid') {
      dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
      updateState(input);
    }
  };

  root.addEventListener('input', handleEvent, true);
  root.addEventListener('change', handleEvent, true);
  root.addEventListener('blur', handleEvent, true);
  root.addEventListener('invalid', handleEvent, true);
  root.addEventListener('reset', handleEvent, true);
}

/**
 * Compresses an uploaded image file (e.g. photo of a physical cjepna iskaznica)
 * into a compact JPEG Data URL (max 720px) so it fits comfortably in local storage.
 */
export function compressImageFile(file, maxDim = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Odaberite slikovnu datoteku.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Čitanje slike nije uspjelo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Neispravan format slike.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
