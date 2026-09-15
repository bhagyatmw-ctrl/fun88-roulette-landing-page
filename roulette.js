/**
 * FUN88 Live European Roulette Wheel Canvas Engine
 * 
 * Rock-Solid True Top-Down Circular Physics Engine:
 * - Single source of truth center (cx, cy) shared by all layers with zero wobble/precession
 * - True top-down circular geometry (no elliptical tilt or scaling inside rotation transforms)
 * - Complete 3D roulette object: Hardwood bowl, 16 sphere studs, 8 gold deflectors, ball track, rotating rotor & machined brass turret
 * - Independent 3D physical ivory ball: Multi-stage orbit, deflector bounces, pocket frets rattling, and locked pocket settle
 * - Strict 2-round game logic synchronization with ODD / EVEN / ZERO selections
 */

const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

class LiveRouletteEngine {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas ${canvasId} not found`);
      return;
    }
    this.ctx = this.canvas.getContext('2d');
    this.options = Object.assign({
      onSpinStart: null,
      onBallBounce: null,
      onSpinComplete: null
    }, options);

    this.isSpinning = false;
    this.targetNumber = null;
    this.winningNumber = null;
    this.selectedOption = null;

    // Single source of truth for wheel rotation (0 = pocket '0' at top -PI/2)
    this.wheelAngle = 0;
    this.startWheelAngle = 0;
    this.finalWheelAngle = 0;

    // Ball physics state (launches near presenter's hand ~10 o'clock / -145 deg)
    this.ballAngle = -Math.PI * 0.78;
    this.startBallAngle = 0;
    this.finalBallAngle = 0;
    this.ballRadiusRatio = 0.745;
    this.ballHeight = 0;
    this.ballVisible = false;

    this.spinStartTime = 0;
    this.spinDuration = 7200; // ms

    this.lastBounceTime = 0;
    this.bounceCount = 0;

    // Load Complete Self-Contained 3D Master Roulette Assets
    this.bowlImage = new Image();
    this.bowlImageLoaded = false;
    this.bowlImage.onload = () => { this.bowlImageLoaded = true; };
    this.bowlImage.src = 'roulette-bowl-master.png';

    this.rotorImage = new Image();
    this.rotorImageLoaded = false;
    this.rotorImage.onload = () => { this.rotorImageLoaded = true; };
    this.rotorImage.src = 'roulette-rotor-master.png';

    this.turretImage = new Image();
    this.turretImageLoaded = false;
    this.turretImage.onload = () => { this.turretImageLoaded = true; };
    this.turretImage.src = 'roulette-turret-master.png';

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.initAnimationLoop();
  }

  resize() {
    if (!this.canvas) return;
    const viewSpin = document.getElementById('view-spin') || this.canvas.parentElement;
    if (!viewSpin) return;

    const cw = viewSpin.clientWidth || window.innerWidth;
    const ch = viewSpin.clientHeight || window.innerHeight;

    this.width = cw;
    this.height = ch;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    this.canvas.style.width = `${cw}px`;
    this.canvas.style.height = `${ch}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    const isMobile = cw <= 768;
    let imgW, imgH, norm_cx, norm_cy, norm_r_full;
    if (isMobile) {
      imgW = 324;
      imgH = 576;
      norm_cx = (491.5 - 330.0) / 324.0; // 0.4984568
      norm_cy = 441.5 / 576.0;           // 0.7664930
      norm_r_full = 242.0 / 324.0;       // 0.7469136
    } else {
      imgW = 1024;
      imgH = 576;
      norm_cx = 491.5 / 1024.0;          // 0.4799805
      norm_cy = 441.5 / 576.0;           // 0.7664930
      norm_r_full = 242.0 / 1024.0;      // 0.2363281
    }

    const imgAspect = imgW / imgH;
    const containerAspect = cw / ch;

    let renderedW, renderedH, renderedX, renderedY;
    if (containerAspect >= imgAspect) {
      renderedW = cw;
      renderedH = cw / imgAspect;
      renderedX = 0;
      renderedY = (ch - renderedH) * 0.5;
    } else {
      renderedH = ch;
      renderedW = ch * imgAspect;
      renderedY = 0;
      renderedX = (cw - renderedW) * 0.5;
    }

    // Single source of truth for the center coordinate
    this.centerX = Math.round(renderedX + renderedW * norm_cx);
    this.centerY = Math.round(renderedY + renderedH * norm_cy);
    this.radiusFull = Math.round(renderedW * norm_r_full);
  }

  setSelection(option) {
    this.selectedOption = option;
  }

  spinTo(targetNumber, duration) {
    if (this.isSpinning) return;

    this.isSpinning = true;
    this.ballVisible = true;
    this.targetNumber = targetNumber;
    this.spinDuration = duration || 7200;
    this.spinStartTime = performance.now();
    this.winningNumber = null;

    const twoPi = Math.PI * 2;
    const pocketCount = 37;
    const pocketAngleStep = twoPi / pocketCount;

    // Target pocket index in European sequence
    const targetIdx = ROULETTE_NUMBERS.indexOf(targetNumber);
    // On roulette-rotor-master.png, pocket '0' is centered at -PI/2 (top)
    const targetPocketLocalAngle = i_to_angle(targetIdx, pocketAngleStep);

    // Stop position at top pointer (-PI/2)
    const jitter = (Math.random() - 0.5) * (pocketAngleStep * 0.20);
    const finalPocketStopAngle = -Math.PI / 2 + jitter;

    // Wheel spins clockwise (5 to 6 full spins)
    const wheelFullSpins = (5 + Math.floor(Math.random() * 2)) * twoPi;
    let deltaWheel = (finalPocketStopAngle - targetPocketLocalAngle - this.wheelAngle) % twoPi;
    while (deltaWheel < 0) {
      deltaWheel += twoPi;
    }
    this.startWheelAngle = this.wheelAngle;
    this.finalWheelAngle = this.startWheelAngle + wheelFullSpins + deltaWheel;

    // Ball launches from presenter hand (~ -145 deg) and orbits counter-clockwise (9 to 11 full spins)
    const ballFullSpins = (9 + Math.floor(Math.random() * 3)) * twoPi;
    let deltaBall = (finalPocketStopAngle - this.ballAngle) % twoPi;
    while (deltaBall > 0) {
      deltaBall -= twoPi;
    }
    this.startBallAngle = this.ballAngle;
    this.finalBallAngle = this.startBallAngle - ballFullSpins + deltaBall;

    this.lastBounceTime = 0;
    this.bounceCount = 0;

    if (this.options.onSpinStart) {
      this.options.onSpinStart();
    }
  }

  initAnimationLoop() {
    const loop = (timestamp) => {
      this.update(timestamp);
      this.render(timestamp);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(timestamp) {
    if (!this.isSpinning) {
      return;
    }

    const elapsed = timestamp - this.spinStartTime;
    const progress = Math.min(1, elapsed / this.spinDuration);

    // 1. Wheel deceleration physics (smooth ease-out cubic)
    const wheelEase = 1 - Math.pow(1 - progress, 3.2);
    this.wheelAngle = this.startWheelAngle + (this.finalWheelAngle - this.startWheelAngle) * wheelEase;

    // 2. Ball deceleration physics (smooth ease-out quartic)
    const ballEase = 1 - Math.pow(1 - progress, 4.3);
    const freeBallAngle = this.startBallAngle + (this.finalBallAngle - this.startBallAngle) * ballEase;

    // 3. Target pocket global angle
    const targetIdx = ROULETTE_NUMBERS.indexOf(this.targetNumber);
    const pocketAngleStep = (Math.PI * 2) / 37;
    const targetPocketLocalAngle = i_to_angle(targetIdx, pocketAngleStep);
    const targetPocketGlobalAngle = this.wheelAngle + targetPocketLocalAngle;

    // 4. Physical Ball Orbit Decay (Calibrated to unified 3D wheel geometry)
    if (progress < 0.50) {
      // High-speed outer ball track orbit (in the recessed metallic bowl track)
      this.ballRadiusRatio = 0.795;
      this.ballHeight = 0;
      this.ballAngle = freeBallAngle;
    } else if (progress < 0.76) {
      // Deflector diamond bounce zone (drops inward with realistic physical hops)
      const dropProgress = (progress - 0.50) / 0.26;
      this.ballRadiusRatio = 0.795 - (0.795 - 0.66) * dropProgress;
      this.ballHeight = Math.abs(Math.sin(dropProgress * Math.PI * 8)) * 6.5 * (1 - dropProgress);
      this.ballAngle = freeBallAngle;

      if (timestamp - this.lastBounceTime > 110 && this.bounceCount < 14) {
        this.lastBounceTime = timestamp;
        this.bounceCount++;
        if (this.options.onBallBounce) {
          this.options.onBallBounce(1.0 - dropProgress * 0.25, 0.45);
        }
      }
    } else if (progress < 0.92) {
      // Rattling across cast brass pocket frets
      const fretProgress = (progress - 0.76) / 0.16;
      this.ballRadiusRatio = 0.66 - (0.66 - 0.53) * fretProgress;
      this.ballHeight = Math.abs(Math.sin(fretProgress * Math.PI * 11)) * 3.2 * (1 - fretProgress);

      const blend = Math.min(1, Math.max(0, (progress - 0.78) / 0.14));
      let diff = (targetPocketGlobalAngle - freeBallAngle) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      this.ballAngle = freeBallAngle + diff * blend;

      if (timestamp - this.lastBounceTime > 135 && this.bounceCount < 22) {
        this.lastBounceTime = timestamp;
        this.bounceCount++;
        if (this.options.onBallBounce) {
          this.options.onBallBounce(0.85, 0.35);
        }
      }
    } else {
      // Firmly settled in winning pocket (locked with zero relative slide)
      this.ballRadiusRatio = 0.53;
      this.ballHeight = 0;
      this.ballAngle = targetPocketGlobalAngle;
    }

    if (progress >= 1) {
      this.isSpinning = false;
      this.winningNumber = this.targetNumber;
      if (this.options.onSpinComplete) {
        this.options.onSpinComplete(this.winningNumber);
      }
    }
  }

  render(timestamp) {
    const ctx = this.ctx;
    const cx = this.centerX;
    const cy = this.centerY;
    const rFull = this.radiusFull;
    // Scale 1024x1024 master assets so bezel (R=498) matches rFull, with outer drop shadow extending to rWheel
    const rWheel = Math.round(rFull * (512.0 / 498.0));

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();

    // 1. Stationary Outer Bowl (Walnut wood rim, 16 sphere studs, 8 diamond deflectors, ball track, outer drop shadow)
    if (this.bowlImageLoaded) {
      ctx.drawImage(this.bowlImage, cx - rWheel, cy - rWheel, rWheel * 2, rWheel * 2);
    }

    // 2. Rotating Rotor Core (37 European pockets, number ring, mahogany cone, 8 gold spoke inlays)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.wheelAngle);
    if (this.rotorImageLoaded) {
      ctx.drawImage(this.rotorImage, -rWheel, -rWheel, rWheel * 2, rWheel * 2);
    }
    ctx.restore();

    // 3. Highlight Winning Pocket (Golden Spotlight attached to rotating wheel)
    if (this.winningNumber !== null) {
      this.drawWinningSpotlight(ctx, cx, cy, rWheel, timestamp);
    }

    // 4. Motionless Center Spindle Turret (Rock-solid pivot pinned to exact (cx, cy) with 0.0px wobble)
    if (this.turretImageLoaded) {
      ctx.drawImage(this.turretImage, cx - rWheel, cy - rWheel, rWheel * 2, rWheel * 2);
    }

    // 5. 3D Physical Ivory Ball
    if (this.ballVisible) {
      this.drawBall(ctx, cx, cy, rFull);
    }

    ctx.restore();
  }

  /** Photorealistic 3D Ivory Ball with physical lighting, bounce light & layered shadow */
  drawBall(ctx, cx, cy, rFull) {
    const dist = rFull * this.ballRadiusRatio;
    const bx = cx + Math.cos(this.ballAngle) * dist;
    const by = cy + Math.sin(this.ballAngle) * dist - this.ballHeight;
    const ballSize = Math.max(5.5, Math.round(rFull * 0.030));

    ctx.save();
    
    // 1. Layered, Warm-Tinted Drop Shadow (Contact + Ambient)
    const shOffX = 2.2 + this.ballHeight * 0.4;
    const shOffY = 3.2 + this.ballHeight * 0.8;
    const shSpread = ballSize * (1.0 + this.ballHeight * 0.08);

    // Broad ambient shadow
    ctx.fillStyle = 'rgba(18, 10, 6, 0.35)';
    ctx.beginPath();
    ctx.ellipse(bx + shOffX, by + shOffY, shSpread * 1.3, shSpread * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tight contact shadow
    if (this.ballHeight < 2.0) {
      ctx.fillStyle = 'rgba(12, 6, 4, 0.65)';
      ctx.beginPath();
      ctx.ellipse(bx + 1.2, by + 1.8, ballSize * 0.9, ballSize * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Physical Ivory Ball Shading (Key light at -135 deg top-left + warm wood bounce light)
    const ballGrad = ctx.createRadialGradient(
      bx - ballSize * 0.32, by - ballSize * 0.32, ballSize * 0.05,
      bx, by, ballSize
    );
    ballGrad.addColorStop(0, '#fbf8f0');       // Pale warm cream
    ballGrad.addColorStop(0.25, '#f4eee0');    // Natural ivory
    ballGrad.addColorStop(0.65, '#ded5c0');    // Midtone ivory
    ballGrad.addColorStop(0.88, '#a69a84');    // Terminator
    ballGrad.addColorStop(1.0, '#5a4f3e');     // Dark shadow

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
    ctx.fill();

    // 3. Warm Wood Bounce Light on bottom-right underside
    const bounceGrad = ctx.createRadialGradient(
      bx + ballSize * 0.45, by + ballSize * 0.45, ballSize * 0.05,
      bx + ballSize * 0.45, by + ballSize * 0.45, ballSize * 0.65
    );
    bounceGrad.addColorStop(0, 'rgba(145, 85, 45, 0.35)');
    bounceGrad.addColorStop(1, 'rgba(145, 85, 45, 0)');
    ctx.fillStyle = bounceGrad;
    ctx.beginPath();
    ctx.arc(bx, by, ballSize, 0, Math.PI * 2);
    ctx.fill();

    // 4. Physically Shaped Specular Hotspot (Soft halo + tight champagne core)
    const specGrad = ctx.createRadialGradient(
      bx - ballSize * 0.32, by - ballSize * 0.32, 0,
      bx - ballSize * 0.32, by - ballSize * 0.32, ballSize * 0.45
    );
    specGrad.addColorStop(0, 'rgba(255, 252, 242, 0.90)');
    specGrad.addColorStop(0.35, 'rgba(250, 240, 215, 0.45)');
    specGrad.addColorStop(1, 'rgba(240, 225, 190, 0)');
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(bx - ballSize * 0.32, by - ballSize * 0.32, ballSize * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /** Soft amber illumination on winning pocket */
  drawWinningSpotlight(ctx, cx, cy, rWheel, timestamp) {
    const pulse = 0.5 + 0.5 * Math.sin(timestamp * 0.007);
    const targetIdx = ROULETTE_NUMBERS.indexOf(this.winningNumber);
    const pocketAngleStep = (Math.PI * 2) / 37;
    const targetPocketAngle = this.wheelAngle + i_to_angle(targetIdx, pocketAngleStep);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(targetPocketAngle);

    const a1 = -pocketAngleStep / 2;
    const a2 = pocketAngleStep / 2;
    const rIn = rWheel * (236.0 / 512.0);
    const rOut = rWheel * (366.0 / 512.0);

    // Soft warm amber illumination inside the pocket
    ctx.fillStyle = `rgba(235, 190, 85, ${0.25 + pulse * 0.22})`;
    ctx.beginPath();
    ctx.arc(0, 0, rOut, a1, a2);
    ctx.arc(0, 0, rIn, a2, a1, true);
    ctx.closePath();
    ctx.fill();

    // Subtle edge highlight
    ctx.strokeStyle = `rgba(245, 215, 125, ${0.60 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(215, 165, 60, 0.5)';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.restore();
  }
}

function i_to_angle(idx, step) {
  // On roulette-rotor-master.png, index 0 is centered at -PI/2 (12 o'clock)
  return -Math.PI / 2 + (idx * step);
}

window.LiveRouletteEngine = LiveRouletteEngine;
