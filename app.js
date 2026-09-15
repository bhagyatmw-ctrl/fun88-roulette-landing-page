/**
 * FUN88 Live Casino — 4-State Game Flow & 2-Round Logic Orchestrator
 * 
 * Round 1: User places bet -> Spins -> MUST LOSE -> In-Scene HUD feedback -> Transition to Image 2 for Round 2.
 * Round 2: User places bet -> Spins -> MUST WIN -> Transition to Image 4 (Winning celebration & 488% bonus).
 */

document.addEventListener('DOMContentLoaded', () => {
  const audio = window.casinoAudio;

  // Persistent Top Nav Elements
  const soundToggleBtn = document.getElementById('sound-toggle-btn');
  const soundIconOn = document.getElementById('sound-icon-on');
  const soundIconOff = document.getElementById('sound-icon-off');
  const roundStatusLabel = document.getElementById('round-status-label');
  const helpToggleBtn = document.getElementById('help-toggle-btn');
  const rulesModal = document.getElementById('rules-modal');
  const btnCloseRules = document.getElementById('btn-close-rules');
  const creditsVal = document.getElementById('credits-val');

  // Views Stack
  const views = {
    intro: document.getElementById('view-intro'),
    betting: document.getElementById('view-betting'),
    spin: document.getElementById('view-spin'),
    win: document.getElementById('view-win')
  };

  // State 1 (Intro) Elements
  const btnEnterGame = document.getElementById('btn-enter-game');

  // State 2 (Betting) Elements
  const bettingStepBadge = document.getElementById('betting-step-badge');
  const bettingInstruction = document.getElementById('betting-instruction');
  const betPillBtns = document.querySelectorAll('.bet-pill-3d');
  const numbersPreviewContainer = document.getElementById('numbers-preview-pills');
  const btnSpinWheel = document.getElementById('btn-spin-wheel');

  // State 3 (Live Spin) Elements
  const spinStatusLabel = document.getElementById('spin-status-label');
  const spinBetVal = document.getElementById('spin-bet-val');
  const spinLossHud = document.getElementById('spin-loss-hud');
  const spinLossBadge = document.getElementById('spin-loss-badge');
  const spinLossBadgeNum = document.getElementById('spin-loss-badge-num');
  const spinLossDesc = document.getElementById('spin-loss-desc');
  const btnLossContinue = document.getElementById('btn-loss-continue');

  // State 4 (Winning) Elements
  const winResultBadge = document.getElementById('win-result-badge');
  const winResultNum = document.getElementById('win-result-num');
  const winNumberDesc = document.getElementById('win-number-desc');
  const bonusCountdown = document.getElementById('bonus-countdown');
  const btnClaimBonus = document.getElementById('btn-claim-bonus');

  // Game Logic State
  let currentRound = 1; // 1 = Must Lose, 2 = Must Win
  let selectedBet = null; // 'ODD' | 'EVEN' | 'ZERO'
  let isSpinning = false;
  let hasInteracted = false;
  let autoContinueTimer = null;
  let userCredits = 1042; // Live balance matching studio HUD

  function updateCreditsDisplay() {
    if (creditsVal) {
      creditsVal.textContent = `₹${userCredits.toLocaleString('en-IN')}`;
    }
  }

  // European Number Pools
  const EVEN_NUMBERS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
  const ODD_NUMBERS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35];
  const ALL_NON_ZERO = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

  // Initialize Live Roulette Canvas Engine
  const liveRoulette = new window.LiveRouletteEngine('live-roulette-canvas', {
    onSpinStart: () => {
      isSpinning = true;
      audio.startWheelSpin();
    },
    onBallBounce: (pitch, vol) => {
      audio.playBallBounce(pitch, vol);
    },
    onSpinComplete: (winningNumber) => {
      isSpinning = false;
      audio.stopWheelSpin();
      audio.playBallLand();

      setTimeout(() => {
        handleRoundOutcome(winningNumber);
      }, 700);
    }
  });

  // Render Mini Table Preview Numbers (0-36)
  renderMiniNumbersGrid();

  // Initialize Ambient Dust & Confetti Particle Systems
  initAmbientParticles();
  const celebration = initCelebrationParticles();

  // -------------------------------------------------------------
  // VIEW SWITCHER STATE MACHINE
  // -------------------------------------------------------------
  function showView(viewId) {
    if (!views[viewId]) return;

    Object.keys(views).forEach(key => {
      if (key === viewId) {
        views[key].classList.add('active');
      } else {
        views[key].classList.remove('active');
      }
    });

    if (viewId === 'spin') {
      setTimeout(() => liveRoulette.resize(), 60);
    }
  }

  // -------------------------------------------------------------
  // USER AUDIO CONTEXT UNLOCK & SOUND TOGGLE
  // -------------------------------------------------------------
  function unlockAudio() {
    if (!hasInteracted) {
      hasInteracted = true;
      audio.ensureContext();
    }
  }

  document.body.addEventListener('click', unlockAudio, { once: true });
  document.body.addEventListener('touchstart', unlockAudio, { once: true });

  soundToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    const muted = audio.toggleMute();
    updateSoundIcon(muted);
    audio.playClick();
  });

  function updateSoundIcon(muted) {
    if (muted) {
      soundIconOn.style.display = 'none';
      soundIconOff.style.display = 'block';
    } else {
      soundIconOn.style.display = 'block';
      soundIconOff.style.display = 'none';
    }
  }

  // -------------------------------------------------------------
  // RULES & PAYOUTS MODAL INTERACTION
  // -------------------------------------------------------------
  if (helpToggleBtn && rulesModal) {
    helpToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unlockAudio();
      audio.playClick();
      rulesModal.classList.add('active');
    });
  }

  if (btnCloseRules && rulesModal) {
    btnCloseRules.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.playClick();
      rulesModal.classList.remove('active');
    });
  }

  if (rulesModal) {
    rulesModal.addEventListener('click', (e) => {
      if (e.target === rulesModal) {
        audio.playClick();
        rulesModal.classList.remove('active');
      }
    });
  }

  // -------------------------------------------------------------
  // STATE 1 -> STATE 2 (Intro -> Betting)
  // -------------------------------------------------------------
  btnEnterGame.addEventListener('click', () => {
    unlockAudio();
    audio.playClick();
    showView('betting');
  });

  // -------------------------------------------------------------
  // STATE 2: BET SELECTION (ODD / EVEN / ZERO)
  // -------------------------------------------------------------
  betPillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSpinning) return;
      unlockAudio();
      audio.playChipSelect();

      const betOption = btn.dataset.bet;
      selectedBet = betOption;

      // Update button visual styles
      betPillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update Covered Numbers Grid Highlight
      highlightMiniNumbers(betOption);
      liveRoulette.setSelection(betOption);

      // Enable Spin Button
      btnSpinWheel.disabled = false;
      bettingInstruction.innerHTML = `You selected <strong>${betOption}</strong>. Click below to spin the physical wheel!`;
    });
  });

  function getRandomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // -------------------------------------------------------------
  // STATE 2 -> STATE 3 (Betting -> Live Spin)
  // -------------------------------------------------------------
  btnSpinWheel.addEventListener('click', () => {
    if (isSpinning || !selectedBet) return;
    unlockAudio();
    audio.playClick();

    // Deduct bet amount from live credit balance
    userCredits = Math.max(0, userCredits - 100);
    updateCreditsDisplay();

    // Hide any previous loss hud
    if (spinLossHud) spinLossHud.classList.remove('active');

    // Calculate Outcome based on strict 2-Round Game Flow
    let outcomeNumber;

    if (currentRound === 1) {
      // ---------------------------------------------------------
      // ROUND 1: MUST LOSE (Landed outside chosen category)
      // ---------------------------------------------------------
      if (selectedBet === 'ODD') {
        // User selected ODD -> Lands on EVEN
        outcomeNumber = getRandomFrom(EVEN_NUMBERS);
      } else if (selectedBet === 'EVEN') {
        // User selected EVEN -> Lands on ODD
        outcomeNumber = getRandomFrom(ODD_NUMBERS);
      } else if (selectedBet === 'ZERO') {
        // User selected ZERO -> Lands on non-zero
        outcomeNumber = getRandomFrom(ALL_NON_ZERO);
      } else {
        outcomeNumber = getRandomFrom(ODD_NUMBERS);
      }
    } else {
      // ---------------------------------------------------------
      // ROUND 2: MUST WIN (Landed inside chosen category)
      // ---------------------------------------------------------
      if (selectedBet === 'ODD') {
        outcomeNumber = getRandomFrom(ODD_NUMBERS);
      } else if (selectedBet === 'EVEN') {
        outcomeNumber = getRandomFrom(EVEN_NUMBERS);
      } else if (selectedBet === 'ZERO') {
        outcomeNumber = 0;
      } else {
        outcomeNumber = getRandomFrom(EVEN_NUMBERS);
      }
    }

    spinBetVal.textContent = selectedBet;
    spinStatusLabel.textContent = 'BALL IN PLAY...';

    // Transition smoothly into State 3
    showView('spin');

    // Trigger physical roulette launch after camera settles
    setTimeout(() => {
      liveRoulette.spinTo(outcomeNumber);
    }, 450);
  });

  // -------------------------------------------------------------
  // SPIN RESULT HANDLER
  // -------------------------------------------------------------
  function handleRoundOutcome(resultNumber) {
    const isRed = RED_NUMBERS.has(resultNumber);
    const isZero = resultNumber === 0;
    const colorName = isZero ? 'GREEN' : (isRed ? 'RED' : 'BLACK');
    const badgeClass = isZero ? 'green' : (isRed ? 'red' : 'black');

    if (currentRound === 1) {
      // =========================================================
      // ROUND 1 RESULT: LOSS -> In-Scene HUD -> Back to Image 2
      // =========================================================
      audio.playLose();

      spinStatusLabel.textContent = `LANDED ON ${resultNumber} ${colorName}`;

      if (spinLossBadgeNum) spinLossBadgeNum.textContent = resultNumber;
      if (spinLossBadge) spinLossBadge.className = `loss-badge-inline ${badgeClass}`;
      if (spinLossDesc) spinLossDesc.textContent = `${resultNumber} ${colorName}`;

      // Show in-scene blended banner
      if (spinLossHud) spinLossHud.classList.add('active');

      // Auto-continue to Round 2 after 4.5s if button not clicked
      autoContinueTimer = setTimeout(() => {
        goToRound2();
      }, 4500);

    } else {
      // =========================================================
      // ROUND 2 RESULT: WIN -> Smooth Transition to Image 4
      // =========================================================
      audio.playWin();
      celebration.startCoinExplosion();

      // Add winning payout to credits
      const winPayout = selectedBet === 'ZERO' ? 3600 : 200;
      userCredits += winPayout;
      updateCreditsDisplay();

      spinStatusLabel.textContent = `WINNER! ${resultNumber} ${colorName}`;

      winResultNum.textContent = resultNumber;
      winResultBadge.className = `win-result-circle ${badgeClass}`;
      winNumberDesc.innerHTML = `Winning Number <strong>${resultNumber} ${colorName}</strong> matches your bet!`;

      // Transition to State 4 (Image 4 celebration view)
      setTimeout(() => {
        showView('win');
        startBonusCountdown();
      }, 1000);
    }
  }

  // -------------------------------------------------------------
  // TRANSITION TO ROUND 2 (Back to Image 2 Betting)
  // -------------------------------------------------------------
  function goToRound2() {
    if (autoContinueTimer) clearTimeout(autoContinueTimer);
    audio.playClick();

    if (spinLossHud) spinLossHud.classList.remove('active');

    currentRound = 2;
    roundStatusLabel.textContent = 'FINAL ROUND (2/2)';
    bettingStepBadge.textContent = 'FINAL ROUND 2 OF 2';
    bettingInstruction.textContent = 'Final lucky spin! Select ODD, EVEN or ZERO to win your prize:';

    // Reset bet selection for round 2
    selectedBet = null;
    betPillBtns.forEach(b => b.classList.remove('active'));
    highlightMiniNumbers(null);
    btnSpinWheel.disabled = true;

    // Transition back to Image 2
    showView('betting');
  }

  btnLossContinue.addEventListener('click', goToRound2);

  // -------------------------------------------------------------
  // BONUS COUNTDOWN TIMER (4:59)
  // -------------------------------------------------------------
  function startBonusCountdown() {
    let timeLeft = 4 * 60 + 59;
    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timer);
        bonusCountdown.textContent = '00:00';
        return;
      }
      const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
      const secs = (timeLeft % 60).toString().padStart(2, '0');
      bonusCountdown.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  // -------------------------------------------------------------
  // CLAIM BONUS CTA ACTION
  // -------------------------------------------------------------
  btnClaimBonus.addEventListener('click', (e) => {
    e.preventDefault();
    audio.playClick();
    audio.playBonusReveal();
    celebration.startContinuousShower();
  });

  // -------------------------------------------------------------
  // MINI NUMBERS TABLE PREVIEW HELPER
  // -------------------------------------------------------------
  function renderMiniNumbersGrid() {
    if (!numbersPreviewContainer) return;
    numbersPreviewContainer.innerHTML = '';

    for (let i = 0; i <= 36; i++) {
      const badge = document.createElement('div');
      const isRed = RED_NUMBERS.has(i);
      const isZero = i === 0;

      badge.className = `mini-badge ${isZero ? 'zero' : (isRed ? 'red' : 'black')}`;
      badge.textContent = i;
      badge.dataset.num = i;
      numbersPreviewContainer.appendChild(badge);
    }
  }

  function highlightMiniNumbers(option) {
    const badges = numbersPreviewContainer.querySelectorAll('.mini-badge');
    badges.forEach(b => {
      const n = parseInt(b.dataset.num, 10);
      b.classList.remove('highlighted');
      if (option === 'ODD' && n !== 0 && n % 2 !== 0) {
        b.classList.add('highlighted');
      } else if (option === 'EVEN' && n !== 0 && n % 2 === 0) {
        b.classList.add('highlighted');
      } else if (option === 'ZERO' && n === 0) {
        b.classList.add('highlighted');
      }
    });
  }

  // -------------------------------------------------------------
  // AMBIENT GOLD DUST PARTICLES
  // -------------------------------------------------------------
  function initAmbientParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w, h;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const count = 40;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2 + 0.8,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -Math.random() * 0.4 - 0.1,
        alpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
        pulseVal: Math.random() * Math.PI
      });
    }

    function animate() {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < count; i++) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.pulseVal += p.pulseSpeed;

        if (p.y < -10) p.y = h + 10;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const dynamicAlpha = Math.max(0, p.alpha * (0.6 + 0.4 * Math.sin(p.pulseVal)));

        ctx.save();
        ctx.fillStyle = `rgba(255, 215, 0, ${dynamicAlpha})`;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = p.size * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      requestAnimationFrame(animate);
    }
    animate();
  }

  // -------------------------------------------------------------
  // GOLD COIN & CONFETTI CELEBRATION SHOWER
  // -------------------------------------------------------------
  function initCelebrationParticles() {
    const canvas = document.getElementById('celebration-canvas');
    if (!canvas) return { startCoinExplosion: () => {}, startContinuousShower: () => {} };
    const ctx = canvas.getContext('2d');

    let w, h;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let activeParticles = [];
    let isContinuous = false;

    class CoinParticle {
      constructor(x, y, isExplosion = true) {
        this.x = x;
        this.y = y;
        this.radius = Math.random() * 7 + 6;
        this.color = Math.random() > 0.3 ? '#FFD700' : '#FFF275';

        if (isExplosion) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 12 + 4;
          this.vx = Math.cos(angle) * speed;
          this.vy = Math.sin(angle) * speed - 6;
        } else {
          this.vx = (Math.random() - 0.5) * 4;
          this.vy = Math.random() * 5 + 3;
        }

        this.gravity = 0.28;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.18;
        this.scaleY = Math.random();
        this.scaleSpeed = Math.random() * 0.08 + 0.04;
        this.alpha = 1;
        this.life = 0;
        this.maxLife = Math.random() * 120 + 100;
      }

      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.rotSpeed;
        this.scaleY = Math.sin(this.life * this.scaleSpeed);
        this.life++;

        if (this.life > this.maxLife - 30) {
          this.alpha = Math.max(0, (this.maxLife - this.life) / 30);
        }

        return this.y < h + 50 && this.alpha > 0;
      }

      draw(c) {
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.scale(1, Math.abs(this.scaleY));

        c.fillStyle = this.color;
        c.shadowColor = '#FFD700';
        c.shadowBlur = 8;
        c.globalAlpha = this.alpha;

        c.beginPath();
        c.arc(0, 0, this.radius, 0, Math.PI * 2);
        c.fill();

        // Inner coin ring
        c.strokeStyle = '#996805';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(0, 0, this.radius * 0.7, 0, Math.PI * 2);
        c.stroke();

        c.restore();
      }
    }

    function loop() {
      ctx.clearRect(0, 0, w, h);

      if (isContinuous && Math.random() < 0.4) {
        for (let i = 0; i < 3; i++) {
          activeParticles.push(new CoinParticle(Math.random() * w, -20, false));
        }
      }

      activeParticles = activeParticles.filter(p => {
        const alive = p.update();
        if (alive) p.draw(ctx);
        return alive;
      });

      requestAnimationFrame(loop);
    }
    loop();

    return {
      startCoinExplosion: () => {
        for (let i = 0; i < 90; i++) {
          activeParticles.push(new CoinParticle(w / 2, h / 2, true));
        }
      },
      startContinuousShower: () => {
        isContinuous = true;
      }
    };
  }
});
