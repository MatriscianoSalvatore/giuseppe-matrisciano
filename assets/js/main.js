/* Giuseppe Matrisciano — portfolio interactions (no dependencies) */
(() => {
	"use strict";

	const $ = (s, c = document) => c.querySelector(s);
	const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
	const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
	const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
	const safe = (name, fn) => { try { fn(); } catch (e) { console.error("[" + name + "]", e); } };

	const root = document.documentElement;
	const onScroll = [];   // functions run once per animation frame while scrolling
	const onResize = [];

	/* ---------- Intro ---------- */
	safe("intro", () => {
		requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add("is-ready")));
	});

	/* ---------- Reveal on scroll ---------- */
	safe("reveal", () => {
		const els = $$(".rv");
		if (!("IntersectionObserver" in window) || reduce) { els.forEach((el) => el.classList.add("in")); return; }
		// stagger siblings that enter together
		els.forEach((el) => {
			const sibs = Array.from(el.parentElement.children).filter((c) => c.classList.contains("rv"));
			const i = sibs.indexOf(el);
			if (i > 0) el.style.setProperty("--d", Math.min(i, 5) * 0.08 + "s");
		});
		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
			});
		}, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
		els.forEach((el) => io.observe(el));
	});

	/* ---------- Scroll progress + nav hide/show ---------- */
	safe("nav", () => {
		const bar = $(".progress");
		const nav = $("#nav");
		let last = window.scrollY;
		onScroll.push(() => {
			const y = window.scrollY;
			const max = root.scrollHeight - window.innerHeight;
			bar.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
			const down = y > last + 4, up = y < last - 4;
			if (y < 120 || up) nav.classList.remove("is-hidden");
			else if (down && !menuOpen()) nav.classList.add("is-hidden");
			if (down || up) last = y;
		});

		const burger = $(".burger"), menu = $("#menu");
		const menuOpen = () => menu.classList.contains("is-open");
		const setMenu = (open) => {
			menu.hidden = false;
			menu.classList.toggle("is-open", open);
			burger.setAttribute("aria-expanded", String(open));
			burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
			document.body.style.overflow = open ? "hidden" : "";
			$$("a", menu).forEach((a) => (a.tabIndex = open ? 0 : -1));
		};
		setMenu(false);
		burger.addEventListener("click", () => setMenu(!menuOpen()));
		menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
		document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen()) { setMenu(false); burger.focus(); } });
		onResize.push(() => { if (window.innerWidth > 900 && menuOpen()) setMenu(false); });
	});

	/* ---------- Statement: words light up as you scroll ---------- */
	safe("scrub", () => {
		const el = $("[data-scrub]");
		if (!el) return;
		const words = [];
		const split = (node) => {
			Array.from(node.childNodes).forEach((n) => {
				if (n.nodeType === 3) {
					const frag = document.createDocumentFragment();
					n.textContent.split(/(\s+)/).forEach((part) => {
						if (!part) return;
						if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
						const s = document.createElement("span");
						s.className = "w"; s.textContent = part; words.push(s); frag.appendChild(s);
					});
					n.replaceWith(frag);
				} else if (n.nodeType === 1) split(n);
			});
		};
		split(el);
		if (reduce) { words.forEach((w) => w.classList.add("on")); return; }
		let lit = -1;
		const update = () => {
			const r = el.getBoundingClientRect();
			const vh = window.innerHeight;
			const p = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.38), 0, 1);
			const n = Math.round(p * words.length);
			if (n === lit) return;
			lit = n;
			words.forEach((w, i) => w.classList.toggle("on", i < n));
		};
		onScroll.push(update); update();
	});

	/* ---------- Counters ---------- */
	safe("counters", () => {
		const els = $$("[data-count]");
		if (reduce || !("IntersectionObserver" in window)) return;
		const fmt = (el, v) => {
			const d = +(el.dataset.decimals || 0);
			return (el.dataset.prefix || "") + v.toFixed(d) + (el.dataset.suffix || "");
		};
		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				if (!e.isIntersecting) return;
				io.unobserve(e.target);
				const el = e.target, to = parseFloat(el.dataset.count), t0 = performance.now(), dur = 1500;
				const tick = (t) => {
					const k = clamp((t - t0) / dur, 0, 1);
					el.textContent = fmt(el, to * (1 - Math.pow(1 - k, 4)));
					if (k < 1) requestAnimationFrame(tick); else el.textContent = fmt(el, to);
				};
				requestAnimationFrame(tick);
			});
		}, { threshold: 0.6 });
		els.forEach((el) => { el.textContent = fmt(el, 0); io.observe(el); });
	});

	/* ---------- Tone words fill in ---------- */
	safe("tone", () => {
		const tone = $(".tone");
		if (!tone || !("IntersectionObserver" in window)) { tone && tone.classList.add("in"); return; }
		// .tone is also an .rv element: the reveal observer adds .in, which starts the fill
	});

	/* ---------- Journey: pinned horizontal scroll ---------- */
	safe("journey", () => {
		const j = $(".journey");
		if (!j) return;
		const sticky = $(".journey-sticky", j), track = $(".journey-track", j), route = $(".route", j);
		const stops = $$("[data-stop]", track);
		const dots = $$(".route li", j);
		const mq = matchMedia("(min-width: 1000px) and (min-height: 620px)");
		let pinned = false, dist = 0, centers = [];

		const setup = () => {
			const want = mq.matches && !reduce;
			pinned = want;
			j.classList.toggle("is-pinned", want);
			if (!want) { j.style.height = ""; track.style.transform = ""; return; }
			track.style.transform = "none";
			const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
			const lastEl = track.lastElementChild;
			const total = lastEl.offsetLeft + lastEl.offsetWidth + pad;
			dist = Math.max(1, total - window.innerWidth);
			j.style.height = window.innerHeight + dist + "px";
			centers = stops.map((s) => clamp((s.offsetLeft + s.offsetWidth / 2 - window.innerWidth / 2) / dist, 0, 1));
			update();
		};

		const update = () => {
			if (!pinned) return;
			const p = clamp(-j.getBoundingClientRect().top / dist, 0, 1);
			track.style.transform = "translate3d(" + (-p * dist).toFixed(1) + "px,0,0)";
			// map scroll progress onto the 5 evenly spaced route stops
			const n = centers.length;
			let f = 0;
			if (p >= centers[n - 1]) f = (n - 1) / n + (1 / n) * (centers[n - 1] >= 1 ? 1 : (p - centers[n - 1]) / (1 - centers[n - 1]));
			else if (p > centers[0]) {
				for (let i = 0; i < n - 1; i++) {
					if (p <= centers[i + 1]) { f = (i + (p - centers[i]) / (centers[i + 1] - centers[i])) / n; break; }
				}
			} else f = 0;
			route.style.setProperty("--p", f.toFixed(4));
			dots.forEach((d, i) => d.classList.toggle("on", p >= centers[i] - 0.02));
		};

		// keyboard users: bring a focused element's panel into view
		track.addEventListener("focusin", (e) => {
			if (!pinned) return;
			const panel = e.target.closest(".panel");
			if (!panel) return;
			const target = clamp((panel.offsetLeft + panel.offsetWidth / 2 - window.innerWidth / 2) / dist, 0, 1);
			window.scrollTo({ top: j.offsetTop + target * dist, behavior: "auto" });
		});

		onScroll.push(update);
		onResize.push(setup);
		mq.addEventListener ? mq.addEventListener("change", setup) : mq.addListener(setup);
		setup();
		window.addEventListener("load", setup);
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
	});

	/* ---------- Journey arches: drawing first, then flip to the photo ---------- */
	safe("flip", () => {
		const flips = $$(".flip");
		if (!flips.length) return;
		const timers = new WeakMap();
		const set = (f, on) => { f.classList.toggle("is-flipped", on); f.setAttribute("aria-pressed", String(on)); };
		flips.forEach((f) => f.addEventListener("click", () => {
			clearTimeout(timers.get(f));
			set(f, !f.classList.contains("is-flipped"));
			root.classList.add("flips-known");   // the visitor has found the gesture: stop hinting
		}));
		if (reduce || !("IntersectionObserver" in window)) return;
		// arriving at a city shows its drawing, then turns it over; leaving resets it
		const io = new IntersectionObserver((entries) => {
			entries.forEach((e) => {
				const f = e.target;
				clearTimeout(timers.get(f));
				if (e.intersectionRatio >= 0.8) {
					f.classList.add("is-inview");   // pulses the flip icon
					timers.set(f, setTimeout(() => set(f, true), 1100));
				} else if (e.intersectionRatio === 0) {
					f.classList.remove("is-inview");
					set(f, false);
				}
			});
		}, { threshold: [0, 0.8] });
		flips.forEach((f) => io.observe(f));
	});

	/* ---------- Custom cursor, magnetic buttons, hero parallax ---------- */
	safe("pointer", () => {
		if (!fine || reduce) return;
		const cur = $(".cursor"), label = $(".cursor-label");
		root.classList.add("has-cursor");
		let x = -100, y = -100, cx = -100, cy = -100, raf = 0;
		const loop = () => {
			cx += (x - cx) * 0.22; cy += (y - cy) * 0.22;
			cur.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0)";
			raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 ? requestAnimationFrame(loop) : 0;
		};
		window.addEventListener("pointermove", (e) => {
			if (e.pointerType && e.pointerType !== "mouse") return;
			x = e.clientX; y = e.clientY;
			cur.classList.add("is-on");
			if (!raf) raf = requestAnimationFrame(loop);
			const t = e.target instanceof Element ? e.target : null;
			const lab = t && t.closest("[data-cursor]");
			const link = t && t.closest("a, button, [role='tab']");
			cur.classList.toggle("is-label", !!lab);
			cur.classList.toggle("is-link", !lab && !!link);
			if (lab) label.textContent = lab.dataset.cursor;
		}, { passive: true });
		document.addEventListener("pointerleave", () => cur.classList.remove("is-on"));
		window.addEventListener("blur", () => cur.classList.remove("is-on"));

		$$("[data-magnetic]").forEach((el) => {
			el.addEventListener("pointermove", (e) => {
				const r = el.getBoundingClientRect();
				el.style.translate = ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + "px " + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px";
			});
			el.addEventListener("pointerleave", () => { el.style.translate = ""; });
			el.style.transition = (getComputedStyle(el).transition || "") + ", translate .5s cubic-bezier(.2,.7,.1,1)";
		});

		const hero = $(".hero");
		if (hero) {
			hero.addEventListener("pointermove", (e) => {
				const r = hero.getBoundingClientRect();
				hero.style.setProperty("--mx", (((e.clientX - r.left) / r.width - 0.5) * -34).toFixed(1) + "px");
				hero.style.setProperty("--my", (((e.clientY - r.top) / r.height - 0.5) * -24).toFixed(1) + "px");
			}, { passive: true });
		}
	});

	/* ---------- Case dialogs ---------- */
	safe("dialogs", () => {
		$$("[data-dialog]").forEach((btn) => {
			btn.addEventListener("click", () => {
				const d = document.getElementById(btn.dataset.dialog);
				if (!d) return;
				if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
				d.scrollTop = 0;
			});
		});
		$$("dialog.case").forEach((d) => {
			const close = () => (typeof d.close === "function" ? d.close() : d.removeAttribute("open"));
			$(".case-close", d).addEventListener("click", close);
			d.addEventListener("click", (e) => { if (e.target === d) close(); });
		});
		// a link from another page (work.html#dlg-rimowa) opens that case straight away
		const fromHash = () => {
			const d = /^#dlg-[\w-]+$/.test(location.hash) && document.getElementById(location.hash.slice(1));
			if (d && !d.open && typeof d.showModal === "function") { d.showModal(); d.scrollTop = 0; }
		};
		fromHash();
		window.addEventListener("hashchange", fromHash);
	});

	/* ---------- Research quiz ---------- */
	safe("quiz", () => {
		const quiz = $("#quiz");
		if (!quiz) return;
		const opts = $$(".quiz-options button", quiz), res = $(".quiz-result", quiz), verdict = $(".quiz-verdict", quiz);
		const lines = {
			men: "That's the common assumption. The data disagreed.",
			women: "A bold guess. The data still disagreed.",
			same: "Good instinct. And now there's evidence for it."
		};
		opts.forEach((b) => b.addEventListener("click", () => {
			opts.forEach((o) => { o.classList.toggle("is-picked", o === b); o.setAttribute("aria-pressed", String(o === b)); });
			quiz.classList.add("is-done");
			verdict.textContent = lines[b.dataset.guess];
			res.hidden = true; void res.offsetWidth; res.hidden = false;   // replay the entrance
		}));
		$(".quiz-reset", quiz).addEventListener("click", () => {
			opts.forEach((o) => { o.classList.remove("is-picked"); o.removeAttribute("aria-pressed"); });
			quiz.classList.remove("is-done"); res.hidden = true; opts[0].focus();
		});
	});

	/* ---------- Education accordion ---------- */
	safe("accordion", () => {
		const items = $$(".acc-item");
		items.forEach((item) => {
			const btn = $("h3 button", item);
			btn.addEventListener("click", () => {
				const open = !item.classList.contains("is-open");
				items.forEach((it) => {
					const on = it === item && open;
					it.classList.toggle("is-open", on);
					$("h3 button", it).setAttribute("aria-expanded", String(on));
				});
			});
		});
	});

	/* ---------- Q&A ---------- */
	safe("qa", () => {
		const answers = [
			"I enjoy understanding why people buy certain products, and how companies can use that information to improve their products, strengthen their brands and create better customer experiences. Marketing combines creativity with analytical thinking, and that's what I enjoy the most.",
			"I wanted to understand consumer behavior and how people make financial and purchasing decisions. I learned about research, data analysis and consumer analytics, and those experiences made me realize I wanted to apply those skills in marketing.",
			"I wanted to improve my English, experience a different culture and receive an American education. Studying here has made me more independent and has given me opportunities I would not have had in Italy.",
			"It offers exactly the type of program I was looking for: marketing strategy, consumer insights, digital marketing and AI together, with a focus on real business applications instead of only theory.",
			"Working as a Digital Marketing Manager in an international company: developing and managing digital campaigns, working with creative and analytics teams, and using consumer insights and data to make better marketing decisions.",
			"Technology or luxury, because I enjoy innovation, branding and consumer-focused marketing. But I'm open to different industries, as long as I can keep learning and growing in marketing.",
			"No. AI is a very useful tool, but it cannot replace people. Marketing also requires creativity, communication and understanding human emotions. The best results will come from combining AI with human creativity."
		];
		const tabs = $$(".qa-list button"), panel = $("#qa-answer");
		if (!tabs.length || !panel) return;
		const text = $(".qa-text", panel);
		let timer = 0;
		const select = (i, focus) => {
			tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
			panel.setAttribute("aria-labelledby", tabs[i].id);
			if (focus) tabs[i].focus();
			clearTimeout(timer);
			if (reduce) { text.textContent = answers[i]; return; }
			text.classList.add("is-out");
			timer = setTimeout(() => { text.textContent = answers[i]; text.classList.remove("is-out"); }, 260);
		};
		tabs.forEach((t, i) => {
			t.addEventListener("click", () => select(i));
			t.addEventListener("keydown", (e) => {
				const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
				if (!d) return;
				e.preventDefault(); select((i + d + tabs.length) % tabs.length, true);
			});
		});
	});

	/* ---------- Gallery: filter + lightbox ---------- */
	safe("gallery", () => {
		const shots = $$(".shot"), filters = $$(".filters button"), lb = $("#lightbox");
		if (!shots.length || !lb) return;
		const img = $("img", lb), cap = $("figcaption", lb), count = $(".lb-count", lb);
		let list = shots.slice(), idx = 0, opener = null;

		filters.forEach((f) => f.addEventListener("click", () => {
			filters.forEach((o) => { o.classList.toggle("is-active", o === f); o.setAttribute("aria-pressed", String(o === f)); });
			const set = f.dataset.filter;
			list = [];
			shots.forEach((s, i) => {
				const show = set === "all" || s.dataset.set === set;
				s.classList.toggle("is-out", !show);
				if (show) { list.push(s); s.style.animation = "none"; void s.offsetWidth; s.style.animation = ""; s.style.animationDelay = Math.min(list.length, 10) * 0.04 + "s"; }
			});
		}));

		const show = (i) => {
			idx = (i + list.length) % list.length;
			const s = list[idx];
			img.style.animation = "none"; void img.offsetWidth; img.style.animation = "";
			img.src = s.dataset.full;
			img.alt = $("img", s).alt;
			cap.textContent = s.dataset.cap || "";
			count.textContent = String(idx + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
			const next = list[(idx + 1) % list.length];
			if (next) { const pre = new Image(); pre.src = next.dataset.full; }
		};
		const open = (s) => {
			opener = s; lb.hidden = false; document.body.style.overflow = "hidden";
			show(list.indexOf(s)); $(".lb-close", lb).focus();
		};
		const close = () => { lb.hidden = true; document.body.style.overflow = ""; img.removeAttribute("src"); opener && opener.focus(); };

		shots.forEach((s) => s.addEventListener("click", () => open(s)));
		$(".lb-close", lb).addEventListener("click", close);
		$(".lb-prev", lb).addEventListener("click", () => show(idx - 1));
		$(".lb-next", lb).addEventListener("click", () => show(idx + 1));
		lb.addEventListener("click", (e) => { if (e.target === lb || e.target.tagName === "FIGURE") close(); });
		document.addEventListener("keydown", (e) => {
			if (lb.hidden) return;
			if (e.key === "Escape") close();
			else if (e.key === "ArrowRight") show(idx + 1);
			else if (e.key === "ArrowLeft") show(idx - 1);
			else if (e.key === "Tab") {   // keep focus inside the viewer
				const f = $$("button", lb), first = f[0], last = f[f.length - 1];
				if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
				else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
			}
		});
		let sx = 0;
		lb.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
		lb.addEventListener("touchend", (e) => {
			const dx = e.changedTouches[0].clientX - sx;
			if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
		}, { passive: true });
	});

	/* ---------- Business card: tilt + flip ---------- */
	safe("bizcard", () => {
		const card = $("#bizcard");
		if (!card) return;
		card.addEventListener("click", () => {
			const on = card.classList.toggle("is-flipped");
			card.setAttribute("aria-pressed", String(on));
			card.classList.remove("is-tilting");
		});
		if (!fine || reduce) return;
		card.addEventListener("pointermove", (e) => {
			const r = card.getBoundingClientRect();
			const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
			card.classList.add("is-tilting");
			card.style.setProperty("--ry", (px * 16).toFixed(2) + "deg");
			card.style.setProperty("--rx", (py * -14).toFixed(2) + "deg");
		});
		card.addEventListener("pointerleave", () => {
			card.classList.remove("is-tilting");
			card.style.setProperty("--ry", "0deg"); card.style.setProperty("--rx", "0deg");
		});
	});

	/* ---------- Copy email, clock, year ---------- */
	safe("misc", () => {
		const toast = $("#toast");
		let tt = 0;
		const say = (msg) => { toast.textContent = msg; toast.classList.add("is-on"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("is-on"), 2200); };
		const copy = $("#copy-email");
		if (copy) copy.addEventListener("click", async () => {
			const email = "gimatri00@gmail.com";
			try { await navigator.clipboard.writeText(email); say("Email copied. Talk soon!"); }
			catch (_) { say(email); }
		});

		const time = $("#miami-time");
		if (time && window.Intl) {
			const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
			const tick = () => { time.textContent = "Miami, FL " + f.format(new Date()); };
			tick(); setInterval(tick, 30000);
		}
		const year = $("#year");
		if (year) year.textContent = new Date().getFullYear();
	});

	/* ---------- Introduction video: silent while you scroll past; full screen, sound and keys on request ---------- */
	safe("intro-video", () => {
		const v = $("#intro-video"), btn = $("#intro-sound");
		if (!v) return;
		const frame = v.parentElement, size = $("#intro-size");
		const fsNow = () => document.fullscreenElement || document.webkitFullscreenElement;
		let live = false;      // started with sound at least once
		let asking = false;    // full screen requested, not answered yet
		let idle = 0, wait = 0;
		const isBig = () => frame.classList.contains("is-cinema") || fsNow() === v || asking;

		if (reduce) v.controls = true;
		else if ("IntersectionObserver" in window) {
			new IntersectionObserver(([e]) => {
				if (!e.isIntersecting) { if (!isBig()) v.pause(); }
				else if (v.muted && !live) v.play().catch(() => {});
			}, { threshold: .5 }).observe(frame);
		}

		const wake = () => {
			frame.classList.remove("is-idle");
			clearTimeout(idle);
			idle = setTimeout(() => { if (!v.paused) frame.classList.add("is-idle"); }, 2600);
		};

		// Big = the video takes the whole screen, with the browser's own full-screen player, so that its full-screen
		// button shows the right icon and leaves full screen. Only where the browser does not grant it does the frame
		// fill the window instead, with its own close button: doing both made the picture grow in two steps.
		const cinema = (on) => {
			if (on) {
				// The block around the video slides in when it is first seen. While it is still moving (or not shown yet)
				// it would hold the full-window frame inside itself: settle it first.
				const box = frame.closest(".rv");
				if (box) { box.style.transition = "none"; box.style.transform = "none"; box.style.opacity = "1"; box.classList.add("in"); }
			}
			frame.classList.toggle("is-cinema", on);
			if (!on) frame.classList.remove("is-idle");
			document.body.style.overflow = on ? "hidden" : "";
			if (size) size.setAttribute("aria-label", on ? "Close full screen" : "Full screen");
		};
		const fallback = () => {
			if (!asking) return;
			asking = false; clearTimeout(wait);
			if (fsNow() !== v) cinema(true);
		};
		const open = () => {
			if (size) size.hidden = false;
			v.tabIndex = 0;
			const ask = v.requestFullscreen || v.webkitRequestFullscreen;
			asking = true; clearTimeout(wait);
			if (!ask) fallback();
			else {
				wait = setTimeout(fallback, 1800);      // no answer at all (some in-app browsers): the window will do
				try { const r = ask.call(v); if (r && r.catch) r.catch(fallback); } catch (e) { fallback(); }
			}
			v.focus({ preventScroll: true });
			wake();
		};
		const exitOne = () => {
			const out = document.exitFullscreen || document.webkitExitFullscreen;
			if (out) { try { const r = out.call(document); if (r && r.catch) r.catch(() => {}); } catch (e) { /* already out */ } }
		};
		const close = () => {
			asking = false; clearTimeout(wait);
			cinema(false);
			if (fsNow()) exitOne();
			v.focus({ preventScroll: true });
		};
		const onFs = () => {
			if (fsNow() !== v) return;
			asking = false; clearTimeout(wait);      // granted: the window version is not needed
			cinema(false);
		};
		document.addEventListener("fullscreenchange", onFs);
		document.addEventListener("webkitfullscreenchange", onFs);
		document.addEventListener("fullscreenerror", fallback);
		document.addEventListener("webkitfullscreenerror", fallback);

		const start = () => {
			live = true;
			v.muted = false; v.loop = false; v.controls = true; v.tabIndex = 0;
			try { v.currentTime = 0; } catch (e) { /* not seekable yet */ }
			v.play().catch(() => {});
		};

		if (btn) btn.addEventListener("click", () => {
			btn.hidden = true;
			// iPhone: only the video itself can go full screen, in the system player.
			if (!(frame.requestFullscreen || frame.webkitRequestFullscreen) && v.webkitEnterFullscreen) {
				start();
				try { v.webkitEnterFullscreen(); } catch (e) { /* not ready yet: it plays in the page */ }
				return;
			}
			// On a screen sharper than Full HD, play the high-resolution file instead of the light preview.
			const hq = v.dataset.hq;
			if (hq && screen.width * (window.devicePixelRatio || 1) >= 2200 && v.getAttribute("src") !== hq) v.src = hq;
			open();      // full screen has to be asked for inside the click itself
			start();
		});
		if (size) size.addEventListener("click", () => (isBig() ? close() : open()));
		["pointermove", "pointerdown"].forEach((n) => frame.addEventListener(n, wake, { passive: true }));
		// The browser's own controls keep the keyboard once they are touched (arrows then move the timeline by 1%,
		// Esc never reaches the page). So after every use of them, focus goes back to the video itself.
		let held = false, back = 0;
		const refocus = () => {
			clearTimeout(back);
			back = setTimeout(() => {
				if (live && !held && (isBig() || document.activeElement === v)) v.focus({ preventScroll: true });
			}, 160);
		};
		frame.addEventListener("gotpointercapture", () => { held = true; }, true);
		frame.addEventListener("lostpointercapture", () => { held = false; refocus(); }, true);
		frame.addEventListener("pointerup", (e) => { if (e.target !== size) refocus(); });
		["play", "pause", "seeked", "volumechange"].forEach((n) => v.addEventListener(n, refocus));
		v.addEventListener("pause", () => { clearTimeout(idle); frame.classList.remove("is-idle"); });
		v.addEventListener("play", wake);

		// Keyboard, as in any player: space, arrows, M, F, Esc. Active in full screen, or when the video has focus.
		const jump = (d) => { if (isFinite(v.duration)) v.currentTime = Math.max(0, Math.min(v.duration - .05, v.currentTime + d)); };
		window.addEventListener("keydown", (e) => {
			if (!live || e.metaKey || e.ctrlKey || e.altKey) return;
			const big = isBig() || !!fsNow();
			if (!big && document.activeElement !== v) return;
			const k = e.key, onButton = e.target === size;
			if (onButton && (k === " " || k === "Enter")) return;      // let the button do its job
			let used = true;
			if (k === " " || k === "Spacebar" || k === "k" || k === "K") { if (v.paused) v.play().catch(() => {}); else v.pause(); }
			else if (k === "ArrowRight") jump(e.shiftKey ? 10 : 5);
			else if (k === "ArrowLeft") jump(e.shiftKey ? -10 : -5);
			else if (k === "ArrowUp") { v.muted = false; v.volume = Math.min(1, Math.round((v.volume + .1) * 10) / 10); }
			else if (k === "ArrowDown") v.volume = Math.max(0, Math.round((v.volume - .1) * 10) / 10);
			else if (k === "m" || k === "M") v.muted = !v.muted;
			else if (k === "f" || k === "F") { if (isBig()) close(); else open(); }
			else if (k === "Home" || k === "0") jump(-1e4);
			else if (k === "Escape" && isBig()) close();
			else if (k === "Tab" && big) {      // keep focus inside; in the real full screen the close button is not on screen
				if (size && fsNow() !== v) (document.activeElement === size ? v : size).focus();
			}
			else used = false;
			if (used) { e.preventDefault(); e.stopPropagation(); wake(); }
		}, true);
	});

	/* ---------- Frame-throttled scroll / resize ---------- */
	let ticking = false;
	const run = () => { ticking = false; onScroll.forEach((fn) => safe("scroll", fn)); };
	window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
	let rt = 0;
	window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { onResize.forEach((fn) => safe("resize", fn)); run(); }, 120); });
	run();
})();
