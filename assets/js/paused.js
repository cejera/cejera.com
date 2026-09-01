(() => {
    let lastFocused = null;

    const getOverlay = (selector) => document.querySelector(selector || '[data-paused-overlay]');

    const openOverlay = (overlay) => {
        if (!overlay) return;
        lastFocused = document.activeElement;
        overlay.classList.add('is-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('paused-open');
        const closeButton = overlay.querySelector('[data-paused-close]');
        window.setTimeout(() => closeButton?.focus({ preventScroll: true }), 200);
    };

    const closeOverlay = (overlay) => {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('paused-open');
        lastFocused?.focus?.();
    };

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-paused-trigger]');
        if (trigger) {
            event.preventDefault();
            event.stopImmediatePropagation();
            openOverlay(getOverlay(trigger.dataset.pausedTrigger));
            return;
        }

        const close = event.target.closest('[data-paused-close]');
        if (close) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeOverlay(close.closest('[data-paused-overlay]'));
            return;
        }

        const overlay = event.target.matches?.('[data-paused-overlay]') ? event.target : null;
        if (overlay) closeOverlay(overlay);
    }, true);

    document.addEventListener('keydown', (event) => {
        const overlay = document.querySelector('[data-paused-overlay].is-open');
        if (!overlay) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeOverlay(overlay);
            return;
        }

        if (event.key !== 'Tab') return;
        const focusable = [...overlay.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-paused-overlay][data-paused-auto="true"]').forEach(openOverlay);
    });
})();
