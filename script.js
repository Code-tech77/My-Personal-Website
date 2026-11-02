/* ============================================================
   MOHAMMED ZUORIKI - PORTFOLIO SCRIPTS
   Three.js Particle Network + GSAP ScrollTrigger Animations
   ============================================================ */

(function () {
    "use strict";

    /* ---------- Constants ---------- */
    const PARTICLE_COUNT = window.innerWidth < 768 ? 60 : 120;
    const CONNECTION_DIST_SQ = 150 * 150; // squared distance, avoids sqrt
    const MAX_LINE_VERTICES = PARTICLE_COUNT * (PARTICLE_COUNT - 1) * 3;

    /* ---------- DOM References ---------- */
    const particleCanvas = document.getElementById("particleCanvas");
    const matrixCanvas = document.getElementById("matrixCanvas");
    const scrollProgress = document.getElementById("scrollProgress");
    const nav = document.getElementById("nav");
    const navToggle = document.getElementById("navToggle");
    const mobileNav = document.getElementById("mobileNav");

    /* ---------- Visibility gating ---------- */
    let isTabVisible = !document.hidden;
    let particleRafId = null;
    let matrixRafId = null;
    let matrixLastDraw = 0;
    const MATRIX_INTERVAL = 50; // ms between matrix draws

    document.addEventListener("visibilitychange", () => {
        isTabVisible = !document.hidden;
        if (isTabVisible) {
            if (!particleRafId) startParticleLoop();
            if (!matrixRafId) startMatrixLoop();
        }
    });

    /* ==========================================================
       1. THREE.JS PARTICLE NETWORK BACKGROUND
       ========================================================== */
    let particleAnimate = null;

    function initParticleNetwork() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.z = 300;

        const renderer = new THREE.WebGLRenderer({
            canvas: particleCanvas,
            antialias: true,
            alpha: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Particles
        const particlesGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const velocities = new Float32Array(PARTICLE_COUNT * 3);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 600;
            positions[i3 + 1] = (Math.random() - 0.5) * 600;
            positions[i3 + 2] = (Math.random() - 0.5) * 200;
            velocities[i3] = (Math.random() - 0.5) * 0.3;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
        }

        particlesGeometry.setAttribute(
            "position",
            new THREE.BufferAttribute(positions, 3)
        );

        const particlesMaterial = new THREE.PointsMaterial({
            color: 0xf5b800,
            size: 2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
        });

        const particles = new THREE.Points(particlesGeometry, particlesMaterial);
        scene.add(particles);

        // Pre-allocated line buffer (avoids per-frame GC)
        const linePositionsArray = new Float32Array(MAX_LINE_VERTICES);
        const linesGeometry = new THREE.BufferGeometry();
        const linesPosAttr = new THREE.BufferAttribute(linePositionsArray, 3);
        linesPosAttr.setUsage(THREE.DynamicDrawUsage);
        linesGeometry.setAttribute("position", linesPosAttr);
        linesGeometry.setDrawRange(0, 0);

        const linesMaterial = new THREE.LineBasicMaterial({
            color: 0xf5b800,
            transparent: true,
            opacity: 0.08,
            blending: THREE.AdditiveBlending,
        });

        const lines = new THREE.LineSegments(linesGeometry, linesMaterial);
        scene.add(lines);

        // Mouse tracking
        const mouse = { x: 0, y: 0 };
        document.addEventListener("mousemove", (e) => {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        // Resize handler
        function onResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);

        // Animation frame
        particleAnimate = function () {
            if (!isTabVisible) {
                particleRafId = null;
                return;
            }
            particleRafId = requestAnimationFrame(particleAnimate);

            const pos = particlesGeometry.attributes.position.array;

            // Update particle positions
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                pos[i3] += velocities[i3];
                pos[i3 + 1] += velocities[i3 + 1];
                pos[i3 + 2] += velocities[i3 + 2];

                if (Math.abs(pos[i3]) > 300) velocities[i3] *= -1;
                if (Math.abs(pos[i3 + 1]) > 300) velocities[i3 + 1] *= -1;
                if (Math.abs(pos[i3 + 2]) > 100) velocities[i3 + 2] *= -1;
            }

            particlesGeometry.attributes.position.needsUpdate = true;

            // Update connection lines using squared distance (no sqrt)
            let lineIdx = 0;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const i3 = i * 3;
                for (let j = i + 1; j < PARTICLE_COUNT; j++) {
                    const j3 = j * 3;
                    const dx = pos[i3] - pos[j3];
                    const dy = pos[i3 + 1] - pos[j3 + 1];
                    const dz = pos[i3 + 2] - pos[j3 + 2];
                    const distSq = dx * dx + dy * dy + dz * dz;

                    if (distSq < CONNECTION_DIST_SQ) {
                        linePositionsArray[lineIdx++] = pos[i3];
                        linePositionsArray[lineIdx++] = pos[i3 + 1];
                        linePositionsArray[lineIdx++] = pos[i3 + 2];
                        linePositionsArray[lineIdx++] = pos[j3];
                        linePositionsArray[lineIdx++] = pos[j3 + 1];
                        linePositionsArray[lineIdx++] = pos[j3 + 2];
                    }
                }
            }

            linesPosAttr.needsUpdate = true;
            linesGeometry.setDrawRange(0, lineIdx / 3);

            // Subtle camera movement following mouse
            camera.position.x += (mouse.x * 30 - camera.position.x) * 0.02;
            camera.position.y += (mouse.y * 30 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);

            renderer.render(scene, camera);
        };
    }

    function startParticleLoop() {
        if (particleAnimate && isTabVisible) {
            particleRafId = requestAnimationFrame(particleAnimate);
        }
    }

    /* ==========================================================
       2. MATRIX RAIN EFFECT (requestAnimationFrame, not setInterval)
       ========================================================== */
    let matrixDraw = null;

    function initMatrixRain() {
        const ctx = matrixCanvas.getContext("2d");
        let width = (matrixCanvas.width = window.innerWidth);
        let height = (matrixCanvas.height = window.innerHeight);

        const columns = Math.floor(width / 16);
        const drops = Array(columns).fill(1);
        const chars =
            "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

        matrixDraw = function (timestamp) {
            if (!isTabVisible) {
                matrixRafId = null;
                return;
            }
            matrixRafId = requestAnimationFrame(matrixDraw);

            // Throttle to ~20fps (50ms interval)
            if (timestamp - matrixLastDraw < MATRIX_INTERVAL) return;
            matrixLastDraw = timestamp;

            ctx.fillStyle = "rgba(10, 9, 6, 0.05)";
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#f5b800";
            ctx.font = "12px monospace";

            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * 16, drops[i] * 16);

                if (drops[i] * 16 > height && Math.random() > 0.98) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        window.addEventListener("resize", () => {
            width = matrixCanvas.width = window.innerWidth;
            height = matrixCanvas.height = window.innerHeight;
        });
    }

    function startMatrixLoop() {
        if (matrixDraw && isTabVisible) {
            matrixRafId = requestAnimationFrame(matrixDraw);
        }
    }

    /* ==========================================================
       3. TYPING EFFECT
       ========================================================== */
    function initTypingEffect() {
        const commandEl = document.getElementById("heroCommand");
        if (!commandEl) return;

        const commands = [
            "whoami",
            "az account show",
            "terraform plan",
            "docker compose up -d",
            "tailscale status",
        ];

        let cmdIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typingSpeed = 80;

        function type() {
            const currentCmd = commands[cmdIndex];

            if (isDeleting) {
                commandEl.textContent = currentCmd.substring(0, charIndex - 1);
                charIndex--;
                typingSpeed = 40;
            } else {
                commandEl.textContent = currentCmd.substring(0, charIndex + 1);
                charIndex++;
                typingSpeed = 80 + Math.random() * 40;
            }

            if (!isDeleting && charIndex === currentCmd.length) {
                typingSpeed = 2000;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                cmdIndex = (cmdIndex + 1) % commands.length;
                typingSpeed = 500;
            }

            setTimeout(type, typingSpeed);
        }

        type();
    }

    /* ==========================================================
       4. GSAP SCROLL ANIMATIONS
       ========================================================== */
    function initScrollAnimations() {
        gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

        // --- Hero Entrance ---
        const heroTl = gsap.timeline({ delay: 0.5 });
        heroTl
            .to(".hero-name-line", {
                opacity: 1,
                y: 0,
                duration: 0.8,
                stagger: 0.2,
                ease: "power3.out",
            })
            .to(
                ".hero-titles",
                { opacity: 1, duration: 0.6, ease: "power2.out" },
                "-=0.3"
            )
            .to(
                ".hero-stats",
                { opacity: 1, duration: 0.6, ease: "power2.out" },
                "-=0.2"
            )
            .to(
                ".hero-scroll-indicator",
                { opacity: 1, duration: 0.6, ease: "power2.out" },
                "-=0.1"
            );

        // --- Counter Animation ---
        heroTl.add(() => {
            document.querySelectorAll(".hero-stat-value").forEach((el) => {
                const target = parseInt(el.dataset.count, 10);
                const counter = { v: 0 };
                gsap.to(counter, {
                    v: target,
                    duration: 1.5,
                    ease: "power2.out",
                    onUpdate: () => {
                        el.textContent = Math.round(counter.v).toLocaleString("en-GB");
                    },
                });
            });
        }, "-=0.6");

        // --- Nav visibility ---
        if (nav) {
            ScrollTrigger.create({
                trigger: "#about",
                start: "top 80%",
                onEnter: () => nav.classList.add("visible"),
                onLeaveBack: () => nav.classList.remove("visible"),
            });
        }

        // --- Active nav link highlighting ---
        const sections = [
            "about", "ventures", "experience", "projects",
            "homelabs", "credentials", "skills", "contact",
        ];
        sections.forEach((id) => {
            ScrollTrigger.create({
                trigger: `#${id}`,
                start: "top center",
                end: "bottom center",
                onEnter: () => setActiveNav(id),
                onEnterBack: () => setActiveNav(id),
            });
        });

        // --- Reveal text animations ---
        gsap.utils.toArray(".reveal-text").forEach((el) => {
            gsap.to(el, {
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%",
                    toggleActions: "play none none none",
                },
                opacity: 1,
                y: 0,
                duration: 0.8,
                ease: "power3.out",
            });
        });

        // --- Reveal items with stagger ---
        const revealGroups = [
            ".about-highlights",
            ".ventures-grid",
            ".timeline",
            ".projects-grid",
            ".homelabs-grid",
            ".education-main",
            ".credentials-grid",
            ".skills-grid",
            ".contact-links",
        ];

        revealGroups.forEach((groupSelector) => {
            const group = document.querySelector(groupSelector);
            if (!group) return;
            const items = group.querySelectorAll(".reveal-item");
            if (items.length === 0) return;

            gsap.to(items, {
                scrollTrigger: {
                    trigger: group,
                    start: "top 85%",
                    toggleActions: "play none none none",
                },
                opacity: 1,
                y: 0,
                duration: 0.7,
                stagger: 0.12,
                ease: "power3.out",
            });
        });

        // Also handle standalone reveal-items (like contact terminal)
        gsap.utils.toArray(".reveal-item").forEach((el) => {
            if (el.closest(".about-highlights, .ventures-grid, .timeline, .projects-grid, .homelabs-grid, .education-main, .credentials-grid, .skills-grid, .contact-links")) return;
            gsap.to(el, {
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%",
                    toggleActions: "play none none none",
                },
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: "power3.out",
            });
        });

        // --- Section title parallax ---
        gsap.utils.toArray(".section-title").forEach((title) => {
            gsap.from(title, {
                scrollTrigger: {
                    trigger: title,
                    start: "top 90%",
                    end: "top 40%",
                    scrub: 1,
                },
                y: 30,
                opacity: 0.3,
            });
        });

        // --- Section line grow ---
        gsap.utils.toArray(".section-line").forEach((line) => {
            gsap.from(line, {
                scrollTrigger: {
                    trigger: line,
                    start: "top 85%",
                    toggleActions: "play none none none",
                },
                width: 0,
                duration: 0.8,
                ease: "power2.out",
            });
        });

        // --- Journey line draw ---
        const journeyLine = document.querySelector(".journey-line");
        if (journeyLine) {
            gsap.from(journeyLine, {
                scrollTrigger: {
                    trigger: ".journey-path",
                    start: "top 80%",
                    end: "bottom 40%",
                    scrub: 1,
                },
                scaleY: 0,
                transformOrigin: "top center",
            });
        }

        // --- Timeline line draw ---
        const timelineLine = document.querySelector(".timeline-line");
        if (timelineLine) {
            gsap.from(timelineLine, {
                scrollTrigger: {
                    trigger: ".timeline",
                    start: "top 80%",
                    end: "bottom 40%",
                    scrub: 1,
                },
                scaleY: 0,
                transformOrigin: "top center",
            });
        }

        // --- Skill bars animation ---
        gsap.utils.toArray(".skill-fill, .lang-fill").forEach((bar) => {
            const targetWidth = bar.dataset.width;
            if (!targetWidth) return;

            ScrollTrigger.create({
                trigger: bar,
                start: "top 90%",
                once: true,
                onEnter: () => {
                    bar.style.width = targetWidth;
                },
            });
        });

        // --- Project cards hover glow follow ---
        document.querySelectorAll(".project-card").forEach((card) => {
            card.addEventListener("mousemove", (e) => {
                const rect = card.getBoundingClientRect();
                const glow = card.querySelector(".project-card-glow");
                if (glow) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    glow.style.left = x - rect.width + "px";
                    glow.style.top = y - rect.height + "px";
                }
            });
        });

        // --- Parallax backgrounds on sections ---
        gsap.utils.toArray(".section").forEach((section) => {
            gsap.to(section, {
                scrollTrigger: {
                    trigger: section,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                },
                backgroundPositionY: "50%",
            });
        });

        // --- Hero parallax on scroll ---
        gsap.fromTo(".hero-content",
            { y: 0, opacity: 1 },
            {
                scrollTrigger: {
                    trigger: ".hero",
                    start: "top top",
                    end: "bottom top",
                    scrub: true,
                    invalidateOnRefresh: true,
                },
                y: 150,
                opacity: 0,
                immediateRender: false,
            }
        );

        // --- About card float effect ---
        gsap.to(".about-card", {
            scrollTrigger: {
                trigger: ".about-card",
                start: "top bottom",
                end: "bottom top",
                scrub: true,
            },
            y: -20,
        });
    }

    /* ==========================================================
       5. SCROLL PROGRESS BAR
       ========================================================== */
    function initScrollProgress() {
        if (!scrollProgress) return;
        window.addEventListener("scroll", () => {
            const scrollTop = window.scrollY;
            const docHeight =
                document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            scrollProgress.style.width = scrollPercent + "%";
        });
    }

    /* ==========================================================
       6. NAV ACTIVE LINK
       ========================================================== */
    function setActiveNav(sectionId) {
        document.querySelectorAll(".nav-link").forEach((link) => {
            link.classList.toggle(
                "active",
                link.getAttribute("data-section") === sectionId
            );
        });
    }

    /* ==========================================================
       7. SMOOTH SCROLL FOR NAV LINKS
       ========================================================== */
    function initSmoothScroll() {
        document
            .querySelectorAll('.nav-link, .mobile-nav-link')
            .forEach((link) => {
                link.addEventListener("click", (e) => {
                    const targetId = link.getAttribute("href");
                    if (!targetId.startsWith("#")) return;
                    e.preventDefault();
                    const target = document.querySelector(targetId);
                    if (target) {
                        gsap.to(window, {
                            scrollTo: { y: target, offsetY: 64 },
                            duration: 1,
                            ease: "power3.inOut",
                        });
                    }
                    // Close mobile nav if open
                    if (mobileNav) mobileNav.classList.remove("open");
                    if (navToggle) navToggle.classList.remove("active");
                });
            });
    }

    /* ==========================================================
       8. MOBILE NAV TOGGLE
       ========================================================== */
    function initMobileNav() {
        if (!navToggle || !mobileNav) return;
        navToggle.addEventListener("click", () => {
            const isOpen = mobileNav.classList.toggle("open");
            navToggle.classList.toggle("active");
            const spans = navToggle.querySelectorAll("span");
            if (isOpen) {
                spans[0].style.transform = "rotate(45deg) translate(5px, 5px)";
                spans[1].style.opacity = "0";
                spans[2].style.transform = "rotate(-45deg) translate(5px, -5px)";
            } else {
                spans[0].style.transform = "none";
                spans[1].style.opacity = "1";
                spans[2].style.transform = "none";
            }
        });
    }

    /* ==========================================================
       9. GLITCH ON SCROLL (section titles)
       ========================================================== */
    function initGlitchOnScroll() {
        const glitchTexts = document.querySelectorAll(".glitch-text");
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("glitch-active");
                    }
                });
            },
            { threshold: 0.5 }
        );

        glitchTexts.forEach((el) => observer.observe(el));
    }

    /* ==========================================================
       INIT
       ========================================================== */
    function init() {
        initParticleNetwork();
        initMatrixRain();
        initTypingEffect();
        initScrollProgress();
        initSmoothScroll();
        initMobileNav();
        initGlitchOnScroll();

        // Start animation loops
        startParticleLoop();
        startMatrixLoop();

        // Wait for all GSAP plugins to be ready
        if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined" && typeof ScrollToPlugin !== "undefined") {
            initScrollAnimations();
        } else {
            window.addEventListener("load", initScrollAnimations);
        }
    }

    // Start when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();


/* ---------- Journey gallery lightbox ---------- */
(function () {
    const box = document.getElementById("galleryLightbox");
    const items = Array.from(document.querySelectorAll(".gallery-item"));
    if (!box || !items.length) return;
    const img = document.getElementById("glImg");
    const title = document.getElementById("glTitle");
    const tag = document.getElementById("glTag");
    let index = 0;
    let lastFocus = null;

    function show(i) {
        index = (i + items.length) % items.length;
        const item = items[index];
        const src = item.querySelector("img");
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        title.innerHTML = item.dataset.title;
        tag.textContent = item.dataset.tag;
    }
    function open(i) {
        lastFocus = document.activeElement;
        show(i);
        box.hidden = false;
        document.body.style.overflow = "hidden";
        box.querySelector(".gl-close").focus();
    }
    function close() {
        box.hidden = true;
        img.src = "";
        document.body.style.overflow = "";
        if (lastFocus) lastFocus.focus();
    }
    items.forEach((item, i) => {
        item.addEventListener("click", () => open(i));
        item.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); }
        });
    });
    box.querySelector(".gl-close").addEventListener("click", close);
    box.querySelector(".gl-prev").addEventListener("click", () => show(index - 1));
    box.querySelector(".gl-next").addEventListener("click", () => show(index + 1));
    box.addEventListener("click", (e) => { if (e.target === box) close(); });
    document.addEventListener("keydown", (e) => {
        if (box.hidden) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") show(index - 1);
        if (e.key === "ArrowRight") show(index + 1);
    });
})();
