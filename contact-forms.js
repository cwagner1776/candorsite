/**
 * contact-forms.js — sends Candor's contact + corrections forms to Formspree
 * via a background request, so the visitor stays on the page and the existing
 * inline "Sent ✓" feedback still works.
 *
 * SETUP (one time):
 *   1. Create a free account at https://formspree.io
 *   2. Create a new form; copy its endpoint, which looks like:
 *        https://formspree.io/f/abcdwxyz
 *   3. Paste that full URL between the quotes on the FORMSPREE_ENDPOINT line below.
 *   4. Commit + push. The first real submission triggers a one-time
 *      confirmation email from Formspree — click the link in it once, and
 *      after that every submission lands in your inbox.
 *
 * Any <form data-formspree> on the page is handled automatically.
 */
(function () {
  'use strict';

  // ⬇️⬇️⬇️  PASTE YOUR FORMSPREE ENDPOINT HERE  ⬇️⬇️⬇️
  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';
  // ⬆️⬆️⬆️  (replace YOUR_FORM_ID with the id from your Formspree form)  ⬆️⬆️⬆️

  function setButton(btn, text) {
    if (!btn) return;
    var span = btn.querySelector('span');
    if (span) span.textContent = text;
    else btn.textContent = text;
  }

  function getButtonText(btn) {
    if (!btn) return '';
    var span = btn.querySelector('span');
    return span ? span.textContent : btn.textContent;
  }

  function wire(form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var btn = form.querySelector('.submit-btn');
      var original = getButtonText(btn);
      var successText = form.getAttribute('data-success-text') || 'Sent ✓';

      // If the Formspree endpoint hasn't been set yet, don't disrupt visitors:
      // show the original cosmetic success state and warn the owner in the console.
      if (FORMSPREE_ENDPOINT.indexOf('YOUR_FORM_ID') !== -1) {
        console.warn(
          '[contact-forms] Formspree endpoint not set — messages are NOT being delivered. ' +
          'Paste your endpoint into contact-forms.js to start receiving email.'
        );
        setButton(btn, successText);
        if (btn) btn.style.background = 'var(--accent)';
        return;
      }

      setButton(btn, 'Sending…');
      if (btn) btn.disabled = true;

      fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          if (res.ok) {
            setButton(btn, successText);
            if (btn) btn.style.background = 'var(--accent)';
            form.reset();
            return;
          }
          return res.json().then(function (data) {
            var msg =
              data && data.errors && data.errors[0] && data.errors[0].message
                ? data.errors[0].message
                : 'Submission failed';
            throw new Error(msg);
          });
        })
        .catch(function () {
          setButton(btn, 'Couldn’t send — try again');
          if (btn) btn.disabled = false;
          setTimeout(function () {
            setButton(btn, original);
          }, 3500);
        });
    });
  }

  function init() {
    var forms = document.querySelectorAll('form[data-formspree]');
    for (var i = 0; i < forms.length; i++) wire(forms[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
