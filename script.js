/* Raffle Prize Chooser – performant script.js (with confetti from winner label)
 * - Pre-renders the entire wheel (slices + labels) to an offscreen canvas.
 * - During spin: only rotates and drawImages the bitmap with requestAnimationFrame.
 * - Winner is chosen before the spin; easing animates to the exact target slice.
 * - Confetti bursts from the on-screen location of the winner’s label.
 * - Keeps the UI and visuals consistent with your existing HTML/CSS.
 */

(() => {
  // ---------- DOM ----------
  const numInput = document.getElementById("numParticipants");
  const form = document.getElementById("participantForm");
  const pickBtn = document.getElementById("pickWinner");
  const resetBtn = document.getElementById("resetBtn");
  const canvas = document.getElementById("wheelCanvas");
  const resultEl = document.getElementById("winnerResult");

  // ---------- Canvas / Drawing State ----------
  let ctx = null;
  let cssW = 0;          // canvas CSS width
  let cssH = 0;          // canvas CSS height
  let dpr = 1;           // device pixel ratio (clamped)
  let spinning = false;  // lock while animating

  // Offscreen pre-render of full wheel (all slices + labels)
  let offscreen = null;
  let offctx = null;
  let bitmapSize = 800;     // backing pixels for the pre-rendered wheel
  let cachedSlices = null;  // [{name, start, end, color}]
  let labelFontPx = 14;     // base label font size (adjusted if needed)
  let labelRadius = 0;      // label-polar radius used when drawing labels

  // Cache: participants hash to avoid unnecessary rebuilds
  let lastBuildKey = "";

  // Spin bookkeeping (for confetti location)
  let lastSpinFinalAngle = 0; // radians
  let lastSpinWinnerIndex = -1;
  let lastDrawSize = 0;       // CSS pixels used to draw offscreen bitmap

  // ---------- Utilities ----------
  function clampDPR() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function setupVisibleCanvas() {
    if (!ctx) ctx = canvas.getContext("2d");
    // Use the rendered size in layout (CSS pixels)
    cssW = Math.max(1, Math.floor(canvas.clientWidth || 300));
    cssH = Math.max(1, Math.floor(canvas.clientHeight || 300));
    dpr = clampDPR();
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr); // Now draw in CSS pixels
  }

  function pickColor(i, n) {
    // Pleasant evenly spaced HSL; alternates light/dark slightly to mimic roulette feel
    const hue = (i * (360 / Math.max(1, n))) % 360;
    const light = i % 2 === 0 ? 58 : 48;
    return `hsl(${hue}, 70%, ${light}%)`;
  }

  function sanitizeName(v) {
    return (v || "").toString().trim();
  }

  function asPositiveNumber(v, fallback = 1) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function buildParticipantsFromForm() {
    const rows = form.querySelectorAll("[data-row]");
    const list = [];
    rows.forEach((row) => {
      const name = sanitizeName(row.querySelector('input[data-name]').value);
      const weight = asPositiveNumber(row.querySelector('input[data-weight]').value, 1);
      if (name) list.push({ name, weight });
    });
    return list;
  }

  function hashParticipants(list) {
    // Simple hash key to detect changes (order sensitive)
    return list.map((p) => `${p.name}::${p.weight}`).join("|");
  }

  // ---------- Pre-render Wheel ----------
  function buildWheelBitmap(participants) {
    if (!participants.length) {
      offscreen = null;
      offctx = null;
      cachedSlices = null;
      return;
    }

    // Avoid redundant rebuild if nothing changed
    const key = hashParticipants(participants);
    if (key === lastBuildKey && offscreen && cachedSlices) return;
    lastBuildKey = key;

    offscreen = document.createElement("canvas");
    offscreen.width = bitmapSize;
    offscreen.height = bitmapSize;
    offctx = offscreen.getContext("2d");

    const cx = bitmapSize / 2;
    const cy = bitmapSize / 2;
    const pad = 8;
    const radius = (bitmapSize / 2) - pad;

    const totalWeight = participants.reduce((s, p) => s + (p.weight || 1), 0);
    let angle = -Math.PI / 2; // start at top

    cachedSlices = participants.map((p, i) => {
      const wedge = (p.weight || 1) / totalWeight * Math.PI * 2;
      const start = angle;
      const end = angle + wedge;
      angle = end;
      return { name: p.name, start, end, color: pickColor(i, participants.length) };
    });

    // Clear and draw slices
    offctx.clearRect(0, 0, bitmapSize, bitmapSize);

    cachedSlices.forEach((s) => {
      offctx.beginPath();
      offctx.moveTo(cx, cy);
      offctx.arc(cx, cy, radius, s.start, s.end);
      offctx.closePath();
      offctx.fillStyle = s.color;
      offctx.fill();

      // Thin white separator stroke for clean look
      offctx.strokeStyle = "#ffffff";
      offctx.lineWidth = Math.max(1, bitmapSize * 0.0025);
      offctx.stroke();
    });

    // Labels (upright)
    offctx.save();
    offctx.translate(cx, cy);
    offctx.textAlign = "center";
    offctx.textBaseline = "middle";
    // Adjust label font based on slice count for legibility
    const adjPx = Math.max(10, Math.min(18, Math.floor(14 - (participants.length * 0.02))));
    labelFontPx = adjPx;
    offctx.fillStyle = "#000";
    offctx.font = `${adjPx}px Poppins, sans-serif`;

    labelRadius = radius * 0.65;
    cachedSlices.forEach((s) => {
      const mid = (s.start + s.end) / 2;
      offctx.save();
      offctx.rotate(mid);
      offctx.translate(labelRadius, 0);
      offctx.rotate(Math.PI / 2); // keep text upright
      const name = s.name.length > 24 ? s.name.slice(0, 21) + "…" : s.name;
      offctx.fillText(name, 0, 0);
      offctx.restore();
    });
    offctx.restore();

    // Optional outer circle ring for tidiness (subtle)
    offctx.beginPath();
    offctx.arc(cx, cy, radius, 0, Math.PI * 2);
    offctx.strokeStyle = "#ffffff";
    offctx.lineWidth = Math.max(2, bitmapSize * 0.003);
    offctx.stroke();
  }

  // ---------- Pointer ----------
  function drawPointer(ctx2) {
    // Downward-pointing triangle at the top-center, above the wheel
    const w = cssW;
    const tipX = w / 2;
    const tipY = 10; // pixels from top edge
    const baseY = 2;
    const half = 8;

    ctx2.save();
    ctx2.beginPath();
    ctx2.moveTo(tipX, tipY);
    ctx2.lineTo(tipX - half, baseY);
    ctx2.lineTo(tipX + half, baseY);
    ctx2.closePath();
    ctx2.fillStyle = "#333";
    ctx2.fill();
    ctx2.lineWidth = 2;
    ctx2.strokeStyle = "#fff";
    ctx2.stroke();
    ctx2.restore();
  }

  // ---------- Spin Animation ----------
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function chooseWinnerIndex(participants) {
    // Weighted random selection by cumulative weight
    const total = participants.reduce((s, p) => s + (p.weight || 1), 0);
    let r = Math.random() * total;
    for (let i = 0; i < participants.length; i++) {
      r -= (participants[i].weight || 1);
      if (r <= 0) return i;
    }
    return participants.length - 1; // fallback
  }

  function spinToWinner(winnerIndex, onDone) {
    if (!cachedSlices || !offscreen) return;

    setupVisibleCanvas();

    const size = Math.min(cssW, cssH) - 8; // CSS pixels
    lastDrawSize = size;
    const cx = cssW / 2;
    const cy = cssH / 2;

    // Compute target angle so the winner's mid-angle lands at top (-90deg)
    const s = cachedSlices[winnerIndex];
    const mid = (s.start + s.end) / 2;
    const pointerAngle = -Math.PI / 2;
    const current = 0; // we always start rotation from 0
    const extraTurns = 7; // full revolutions for drama
    const target =
      current + (Math.PI * 2) * extraTurns + (pointerAngle - mid);

    const duration = 3200; // ms
    let startTs = null;

    function frame(ts) {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = easeOutCubic(t);
      const angle = current + (target - current) * eased;

      // Clear frame
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr); // maintain CSS px coords
      ctx.clearRect(0, 0, cssW, cssH);

      // Draw rotated wheel bitmap
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.drawImage(
        offscreen,
        -size / 2,
        -size / 2,
        size,
        size
      );
      ctx.restore();

      // Draw pointer static on top
      drawPointer(ctx);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Persist final state for confetti position calc
        lastSpinFinalAngle = angle;
        onDone && onDone();
      }
    }

    requestAnimationFrame(frame);
  }

  // ---------- Confetti at winner label ----------
  function confettiAtWinnerLabel() {
    const confetti = window.confetti;
    if (!confetti || !cachedSlices || lastSpinWinnerIndex < 0) return;

    // Compute on-screen coordinates (CSS pixels) of the winner label center
    const cx = cssW / 2;
    const cy = cssH / 2;
    const scale = lastDrawSize / bitmapSize; // offscreen px -> screen CSS px
    const winnerSlice = cachedSlices[lastSpinWinnerIndex];
    const mid = (winnerSlice.start + winnerSlice.end) / 2;

    // Vector from center to label in offscreen coordinates
    const vx = labelRadius * Math.cos(mid);
    const vy = labelRadius * Math.sin(mid);

    // Rotate by the final spin angle (because we rotated the whole wheel)
    const a = lastSpinFinalAngle;
    const rx = vx * Math.cos(a) - vy * Math.sin(a);
    const ry = vx * Math.sin(a) + vy * Math.cos(a);

    // Scale to on-screen size and translate to canvas center
    const labelX = cx + rx * scale;
    const labelY = cy + ry * scale;

    // Convert canvas-local (CSS px) to viewport [0..1] for confetti origin
    const rect = canvas.getBoundingClientRect();
    const clientX = rect.left + (labelX * dpr); // canvas is scaled by DPR internally, but rect is CSS px; we drew in CSS px, so remove dpr here.
    const clientY = rect.top + (labelY * dpr);
    // Actually, since we drew in CSS px (ctx scaled by dpr), labelX/labelY are CSS px.
    // So remove dpr factor:
    const clientXF = rect.left + labelX;
    const clientYF = rect.top + labelY;

    const originX = clientXF / window.innerWidth;
    const originY = clientYF / window.innerHeight;

    // Clamp origin into safe bounds
    const ox = Math.max(0, Math.min(1, originX));
    const oy = Math.max(0, Math.min(1, originY));

    // Fire two bursts from the label position
    confetti({
      particleCount: 120,
      spread: 70,
      origin: { x: ox, y: oy },
      startVelocity: 45,
      scalar: 0.9
    });
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { x: ox, y: oy },
        startVelocity: 40,
        scalar: 0.9
      });
    }, 250);
  }

  // ---------- Public API (wired in HTML) ----------
  window.generateInputs = function generateInputs() {
    const n = Math.max(1, Number(numInput.value || 0));
    form.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const row = document.createElement("div");
      row.setAttribute("data-row", "");
      // Name
      const name = document.createElement("input");
      name.type = "text";
      name.placeholder = `Name ${i + 1}`;
      name.setAttribute("data-name", "");
      name.autocomplete = "off";
      // Weight
      const weight = document.createElement("input");
      weight.type = "number";
      weight.min = "1";
      weight.placeholder = "Weight";
      weight.value = "1";
      weight.setAttribute("data-weight", "");

      row.appendChild(name);
      row.appendChild(weight);
      form.appendChild(row);
    }

    // Reveal UI controls (same look/flow as before)
    pickBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
    // Keep canvas hidden until we actually spin (preserves current visual flow)
    canvas.style.display = "none";
    resultEl.textContent = "";
  };

  window.pickWinner = function pickWinner() {
    if (spinning) return;

    const participants = buildParticipantsFromForm();
    if (!participants.length) {
      resultEl.textContent = "Please enter at least one name.";
      return;
    }

    // Build wheel bitmap (only if list changed)
    buildWheelBitmap(participants);

    // Decide winner first (weighted, unbiased)
    const winnerIndex = chooseWinnerIndex(participants);
    const winnerName = participants[winnerIndex].name;

    // Prepare canvas and reveal it
    canvas.style.display = "block";
    setupVisibleCanvas();

    spinning = true;
    pickBtn.disabled = true;
    resultEl.textContent = ""; // will show after spin
    lastSpinWinnerIndex = winnerIndex;

    spinToWinner(winnerIndex, () => {
      spinning = false;
      pickBtn.disabled = false;
      resultEl.textContent = `Winner: ${winnerName}`;

      // Celebrate once FROM THE WINNER LABEL POSITION
      confettiAtWinnerLabel();
    });
  };

  window.resetApp = function resetApp() {
    if (spinning) return;
    form.innerHTML = "";
    numInput.value = "";
    resultEl.textContent = "";
    pickBtn.style.display = "none";
    resetBtn.style.display = "none";
    canvas.style.display = "none";

    // Clear caches
    cachedSlices = null;
    offscreen = null;
    offctx = null;
    lastBuildKey = "";
    lastSpinWinnerIndex = -1;
    // Clear visible canvas
    if (ctx) {
      setupVisibleCanvas();
      ctx.clearRect(0, 0, cssW, cssH);
    }
  };

  // Handle resize to keep canvas crisp without doing expensive work
  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (canvas.style.display !== "none") {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        setupVisibleCanvas();
        // Redraw last static wheel (if any) without recomputing slices
        if (offscreen && cachedSlices) {
          ctx.clearRect(0, 0, cssW, cssH);
          const size = Math.min(cssW, cssH) - 8;
          lastDrawSize = size;
          ctx.save();
          ctx.translate(cssW / 2, cssH / 2);
          // Draw last frame without rotation (since we don't store last angle here)
          ctx.drawImage(offscreen, -size / 2, -size / 2, size, size);
          ctx.restore();
          drawPointer(ctx);
        }
      });
    }
  });

  // ---------- (Optional) Randomness audit helper ----------
  // Run in DevTools console, e.g.:
  //   _auditWeights([{name:'A',weight:1},{name:'B',weight:3}], 100000)
  // It will return observed frequencies vs expected.
  window._auditWeights = function _auditWeights(participants, trials = 100000) {
    const counts = participants.map(() => 0);
    for (let i = 0; i < trials; i++) {
      const idx = (function choose(ps) {
        const total = ps.reduce((s, p) => s + (p.weight || 1), 0);
        let r = Math.random() * total;
        for (let j = 0; j < ps.length; j++) {
          r -= (ps[j].weight || 1);
          if (r <= 0) return j;
        }
        return ps.length - 1;
      })(participants);
      counts[idx]++;
    }
    const totalW = participants.reduce((s,p)=>s+(p.weight||1),0);
    const expected = participants.map(p => (p.weight||1)/totalW);
    const observed = counts.map(c => c / trials);
    return { counts, observed, expected };
  };
})();
