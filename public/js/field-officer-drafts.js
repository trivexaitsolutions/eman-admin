// Server-side encrypted drafts; the browser only coordinates saving/resuming.
(function () {
  window.createFieldOfficerDraft = function ({ kind, form, existing, currentStep, setStep }) {
    let draftId = existing?.id || null;
    let saveTimer;
    let saveChain = Promise.resolve();
    const status = document.getElementById('draftSaveStatus');
    const idField = form.querySelector('input[name="draftId"]');
    if (idField && draftId) idField.value = String(draftId);
    if (existing?.fields) {
      for (const [key, rawValue] of Object.entries(existing.fields)) {
        const values = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue || '')];
        const elements = Array.from(form.elements).filter(el => el.name === key || el.name === `${key}[]`);
        for (const element of elements) {
          if (element.type === 'checkbox' || element.type === 'radio') element.checked = values.includes(element.value);
          else if (element.type !== 'file') element.value = values[0];
        }
      }
    }
    const setStatus = message => { if (status) status.textContent = message; };

    // Keep the saved draft ID in the page URL. Without this, refreshing the
    // add-worker/add-customer page opens a blank form and the next save creates
    // a second draft instead of updating the existing one.
    function syncDraftUrl(id) {
      if (!id || !window.history || typeof window.history.replaceState !== 'function') return;
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get('draft') === String(id)) return;
        url.searchParams.set('draft', String(id));
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      } catch (error) {
        console.warn('Could not keep the draft ID in the page URL:', error);
      }
    }

    function snapshot() {
      const data = new FormData(form);
      const fields = {};
      for (const [rawKey, value] of data.entries()) {
        if (typeof value !== 'string') continue; // videos have a separate upload
        const key = rawKey.replace(/\[\]$/, '');
        if (key === 'draftId' || /otp/i.test(key)) continue;
        if (key === 'skillIds' || key === 'nakaIds') {
          if (!fields[key]) fields[key] = [];
          fields[key].push(value);
        } else fields[key] = value;
      }
      return fields;
    }

    function save(step = currentStep()) {
      if (existing?.isEdit) return Promise.resolve(true);
      clearTimeout(saveTimer);
      const fields = snapshot();
      setStatus('Saving draft...');
      // Sequential writes prevent a delayed autosave overwriting a later step.
      saveChain = saveChain.catch(() => null).then(async () => {
        const response = await fetch('/field-agent/drafts/save', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: draftId, kind, step, fields }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Draft could not be saved.');
        const result = await response.json();
        draftId = result.id;
        if (idField) idField.value = String(draftId);
        syncDraftUrl(draftId);
        setStatus('Saved · Continue later from Saved Drafts');
        return true;
      }).catch(err => { setStatus(`Not saved: ${err.message}`); throw err; });
      return saveChain;
    }

    const shouldAutosave = event => {
      if (!event.target.name || event.target.type === 'file' || existing?.isEdit) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { save().catch(() => {}); }, 1200);
    };
    form.addEventListener('input', shouldAutosave);
    form.addEventListener('change', shouldAutosave);

    // For a resumed registration, keep OTP/payment verification independent
    // of the draft; authentication and proof must be redone on final submit.
    if (existing?.step && existing.step > 1) setStep(existing.step);
    return {
      save,
      getId: () => draftId,
      async uploadVideo(file) {
        if (!file) return false;
        await save();
        const data = new FormData();
        data.append('draftId', String(draftId));
        data.append('videoConsent', file);
        setStatus('Saving compressed consent video...');
        const response = await fetch('/field-agent/drafts/video', { method: 'POST', body: data, credentials: 'same-origin' });
        if (!response.ok) throw new Error('Consent video could not be saved.');
        setStatus('Consent video saved with draft');
        return true;
      },
    };
  };
})();
