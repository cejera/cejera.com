(function () {
    const menuButton = document.querySelector('[data-menu-toggle]');
    const navigation = document.querySelector('[data-navigation]');

    if (menuButton && navigation) {
        const closeMenu = () => {
            menuButton.setAttribute('aria-expanded', 'false');
            navigation.setAttribute('data-visible', 'false');
        };

        menuButton.addEventListener('click', () => {
            const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
            menuButton.setAttribute('aria-expanded', String(!isOpen));
            navigation.setAttribute('data-visible', String(!isOpen));
        });

        navigation.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMenu();
                menuButton.focus();
            }
        });
    }

    const header = document.querySelector('[data-site-header]');
    if (header) {
        const updateHeader = () => {
            header.classList.toggle('is-scrolled', window.scrollY > 40);
        };
        updateHeader();
        window.addEventListener('scroll', updateHeader, { passive: true });
    }

    document.querySelectorAll('[data-current-year]').forEach((node) => {
        node.textContent = String(new Date().getFullYear());
    });

    const footerNavigationIcons = new Map([
        ['/', 'home'],
        ['/projetos/', 'archive'],
        ['/moda/', 'shirt'],
        ['/design/', 'paintbrush'],
        ['/musica/', 'music'],
        ['/sobre/', 'info'],
        ['/contato/', 'mail'],
        ['/clubinho/', 'lock']
    ]);

    document.querySelectorAll('footer .footer-links a[href]').forEach((link) => {
        if (link.querySelector('svg')) return;
        const iconName = footerNavigationIcons.get(new URL(link.href, window.location.origin).pathname);
        if (!iconName) return;

        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        icon.classList.add('cejera-icon', 'footer-nav-icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('focusable', 'false');
        use.setAttribute('href', `/assets/icons/cejera-system-v2.svg#${iconName}`);
        icon.append(use);
        link.prepend(icon);
    });

    const studioMap = document.querySelector('#studio-map[data-map-query]');
    const googleMapsKey = document.querySelector('meta[name="google-maps-api-key"]')?.content.trim();
    if (studioMap && googleMapsKey) {
        const query = encodeURIComponent(studioMap.dataset.mapQuery);
        studioMap.src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(googleMapsKey)}&q=${query}`;
    }

    document.querySelectorAll('.btn, .club-link, .button-technical, .button-paper').forEach((button) => {
        button.addEventListener('pointerdown', () => {
            button.classList.remove('is-pressing');
            window.requestAnimationFrame(() => {
                button.classList.add('is-pressing');
                window.setTimeout(() => button.classList.remove('is-pressing'), 190);
            });
        });
    });

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealItems = document.querySelectorAll('[data-reveal]');

    if (revealItems.length) {
        if (reducedMotion || !('IntersectionObserver' in window)) {
            revealItems.forEach((item) => item.classList.add('is-visible'));
        } else {
            const revealObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.14 });

            revealItems.forEach((item) => revealObserver.observe(item));
        }
    }

    const floatStage = document.querySelector('[data-float-stage]');
    if (floatStage && !reducedMotion && window.matchMedia('(pointer: fine)').matches) {
        let frameId = 0;
        let targetX = 0;
        let targetY = 0;
        let currentX = 0;
        let currentY = 0;

        const animateLayers = () => {
            currentX += (targetX - currentX) * 0.08;
            currentY += (targetY - currentY) * 0.08;
            floatStage.style.setProperty('--pointer-x', currentX.toFixed(3));
            floatStage.style.setProperty('--pointer-y', currentY.toFixed(3));
            frameId = window.requestAnimationFrame(animateLayers);
        };

        floatStage.addEventListener('pointermove', (event) => {
            const rect = floatStage.getBoundingClientRect();
            targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
            targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
            if (!frameId) frameId = window.requestAnimationFrame(animateLayers);
        });

        floatStage.addEventListener('pointerleave', () => {
            targetX = 0;
            targetY = 0;
        });
    }

    document.querySelectorAll('[data-waitlist-trigger]').forEach((trigger) => {
        trigger.addEventListener('click', () => {
            const selector = trigger.getAttribute('data-waitlist-target') || '[data-waitlist-target]';
            const target = document.querySelector(selector);
            if (!target) return;

            target.scrollIntoView({
                behavior: reducedMotion ? 'auto' : 'smooth',
                block: 'center'
            });
            target.classList.remove('is-waitlist-highlight');
            void target.offsetWidth;
            target.classList.add('is-waitlist-highlight');

            window.setTimeout(() => {
                target.querySelector('input[type="email"]')?.focus({ preventScroll: true });
            }, reducedMotion ? 0 : 620);
            window.setTimeout(() => target.classList.remove('is-waitlist-highlight'), 2600);
        });
    });

    const exitIntent = document.querySelector('[data-exit-intent]');
    if (exitIntent && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        const closeButtons = exitIntent.querySelectorAll('[data-exit-close]');
        const focusTarget = exitIntent.querySelector('[data-exit-close]');
        let isShown = false;

        try {
            isShown = window.sessionStorage.getItem('cejera-exit-intent-seen') === '1';
        } catch (_) {
            isShown = false;
        }

        const closeExitIntent = () => {
            exitIntent.hidden = true;
        };

        const showExitIntent = (event) => {
            if (isShown || event.clientY > 0) return;
            isShown = true;
            exitIntent.hidden = false;
            try {
                window.sessionStorage.setItem('cejera-exit-intent-seen', '1');
            } catch (_) {
                // O aviso continua funcionando mesmo quando o storage está indisponível.
            }
            window.requestAnimationFrame(() => focusTarget?.focus());
        };

        document.documentElement.addEventListener('mouseleave', showExitIntent);
        closeButtons.forEach((button) => button.addEventListener('click', closeExitIntent));
        exitIntent.addEventListener('click', (event) => {
            if (event.target === exitIntent) closeExitIntent();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !exitIntent.hidden) closeExitIntent();
        });
    }
})();
