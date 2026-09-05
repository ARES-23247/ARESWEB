// Pollen - Dynamic Appalachian Background
// Renders Day, Sunset, and Night with the Green Bank Radio Telescope and Point Pleasant Bridge

class BackgroundRenderer {
  constructor() {
    this.timeOfDay = 0.0; // 0.0 = Day, 0.5 = Sunset, 1.0 = Night
    this.targetTimeOfDay = 0.0;
    this.transitionSpeed = 0.015;

    this.stars = [];
    this.fireflies = [];
    this.pollenMotes = [];
    this.clouds = [];
    this.ridgeSeeds = [0.35, 0.55, 0.75];

    this.initParticles();
  }

  initParticles() {
    // Generate twinkling stars
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.55,
        size: Math.random() * 1.8 + 0.8,
        twinkleSpeed: Math.random() * 0.05 + 0.02,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Floating summer clouds
    this.clouds = [
      { x: 0.1, y: 0.12, scale: 0.9, speed: 0.00015 },
      { x: 0.45, y: 0.18, scale: 1.2, speed: 0.00018 },
      { x: 0.8, y: 0.09, scale: 0.8, speed: 0.00012 }
    ];

    // Floating daytime pollen motes
    this.pollenMotes = [];
    for (let i = 0; i < 30; i++) {
      this.pollenMotes.push({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 2.2 + 1,
        speedX: (Math.random() - 0.5) * 0.0006,
        speedY: (Math.random() - 0.5) * 0.0004 - 0.0002,
        phase: Math.random() * Math.PI * 2
      });
    }

    // Nighttime fireflies (lightning bugs)
    this.fireflies = [];
    for (let i = 0; i < 24; i++) {
      this.fireflies.push({
        x: Math.random(),
        y: 0.4 + Math.random() * 0.5,
        radius: Math.random() * 2.5 + 1.5,
        pulseSpeed: Math.random() * 0.04 + 0.02,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.0005,
        vy: (Math.random() - 0.5) * 0.0004
      });
    }
  }

  setTimeTarget(target) {
    this.targetTimeOfDay = Math.max(0, Math.min(1, target));
  }

  update(dt = 1) {
    // Smooth transition between Day -> Sunset -> Night
    if (Math.abs(this.timeOfDay - this.targetTimeOfDay) > 0.001) {
      this.timeOfDay += (this.targetTimeOfDay - this.timeOfDay) * this.transitionSpeed * dt;
    } else {
      this.timeOfDay = this.targetTimeOfDay;
    }

    // Update clouds
    this.clouds.forEach(cloud => {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 1.2) cloud.x = -0.2;
    });

    // Update pollen motes
    this.pollenMotes.forEach(mote => {
      mote.phase += 0.02 * dt;
      mote.x += mote.speedX * dt + Math.sin(mote.phase) * 0.0003;
      mote.y += mote.speedY * dt;
      if (mote.y < 0) mote.y = 1;
      if (mote.x < 0) mote.x = 1;
      if (mote.x > 1) mote.x = 0;
    });

    // Update fireflies
    this.fireflies.forEach(fly => {
      fly.phase += fly.pulseSpeed * dt;
      fly.x += fly.vx * dt + Math.sin(fly.phase * 0.7) * 0.0004;
      fly.y += fly.vy * dt + Math.cos(fly.phase * 0.5) * 0.0003;
      if (fly.y < 0.35) fly.y = 0.85;
      if (fly.y > 0.95) fly.y = 0.4;
      if (fly.x < 0) fly.x = 1;
      if (fly.x > 1) fly.x = 0;
    });
  }

  // Linear color interpolation helper
  lerpColor(c1, c2, factor) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * factor),
      Math.round(c1[1] + (c2[1] - c1[1]) * factor),
      Math.round(c1[2] + (c2[2] - c1[2]) * factor)
    ];
  }

  rgb(c, a = 1.0) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
  }

  draw(ctx, width, height) {
    const t = this.timeOfDay;

    // Palette definition: Day (0), Sunset (0.5), Night (1.0)
    const daySkyTop = [100, 181, 246];    // #64b5f6
    const daySkyBot = [255, 249, 196];    // #fff9c4
    const sunSkyTop = [183, 28, 28];      // #b71c1c
    const sunSkyBot = [255, 179, 0];      // #ffb300
    const niteSkyTop = [7, 11, 28];       // #070b1c
    const niteSkyBot = [40, 22, 60];      // #28163c

    let curSkyTop, curSkyBot;
    if (t <= 0.5) {
      const f = t / 0.5;
      curSkyTop = this.lerpColor(daySkyTop, sunSkyTop, f);
      curSkyBot = this.lerpColor(daySkyBot, sunSkyBot, f);
    } else {
      const f = (t - 0.5) / 0.5;
      curSkyTop = this.lerpColor(sunSkyTop, niteSkyTop, f);
      curSkyBot = this.lerpColor(sunSkyBot, niteSkyBot, f);
    }

    // 1. Render Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, this.rgb(curSkyTop));
    skyGrad.addColorStop(1, this.rgb(curSkyBot));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars (Fade in at night)
    if (t > 0.3) {
      const starAlpha = Math.min(1, (t - 0.3) / 0.7);
      ctx.save();
      this.stars.forEach(star => {
        const twinkle = 0.5 + 0.5 * Math.sin(Date.now() * star.twinkleSpeed * 0.05 + star.phase);
        ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha * twinkle * 0.9})`;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 3. Sun & Moon
    ctx.save();
    if (t < 0.8) {
      // Sun sinking as day progresses
      const sunAlpha = Math.max(0, 1 - t / 0.8);
      const sunY = height * (0.2 + t * 0.5);
      const sunX = width * (0.75 - t * 0.2);

      // Sun glow
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 90);
      sunGlow.addColorStop(0, `rgba(255, 245, 157, ${sunAlpha * 0.9})`);
      sunGlow.addColorStop(0.5, `rgba(255, 179, 0, ${sunAlpha * 0.4})`);
      sunGlow.addColorStop(1, 'rgba(255, 152, 0, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 90, 0, Math.PI * 2);
      ctx.fill();

      // Sun core
      ctx.fillStyle = `rgba(255, 253, 231, ${sunAlpha})`;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t > 0.4) {
      // Moon rising in the east
      const moonAlpha = Math.min(1, (t - 0.4) / 0.6);
      const moonX = width * 0.82;
      const moonY = height * 0.16;

      ctx.fillStyle = `rgba(255, 255, 230, ${moonAlpha * 0.85})`;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 22, 0, Math.PI * 2);
      ctx.fill();

      // Crescent shadow
      ctx.fillStyle = this.rgb(curSkyTop, moonAlpha * 0.9);
      ctx.beginPath();
      ctx.arc(moonX + 8, moonY - 4, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Summer Clouds (Visible mostly in day & sunset)
    if (t < 0.9) {
      const cloudAlpha = Math.max(0, 0.85 - t * 0.8);
      ctx.save();
      this.clouds.forEach(cloud => {
        const cx = cloud.x * width;
        const cy = cloud.y * height;
        const s = cloud.scale;

        // Cloud color tinted by sunset
        const cloudCol = t > 0.2
          ? `rgba(255, 204, 188, ${cloudAlpha})`
          : `rgba(255, 255, 255, ${cloudAlpha})`;

        ctx.fillStyle = cloudCol;
        ctx.beginPath();
        ctx.arc(cx, cy, 26 * s, 0, Math.PI * 2);
        ctx.arc(cx + 25 * s, cy - 10 * s, 32 * s, 0, Math.PI * 2);
        ctx.arc(cx + 55 * s, cy, 24 * s, 0, Math.PI * 2);
        ctx.arc(cx + 35 * s, cy + 8 * s, 28 * s, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // 5. Appalachian Mountain Ridges
    this.drawMountainRidge(ctx, width, height, 0.48, 110, [121, 134, 203], [142, 36, 170], [13, 19, 43], 0);
    this.drawMountainRidge(ctx, width, height, 0.60, 90, [77, 182, 172], [106, 27, 154], [10, 24, 38], 1);
    this.drawMountainRidge(ctx, width, height, 0.72, 75, [104, 159, 56], [74, 20, 140], [6, 17, 26], 2);

    // 6. West Virginia Night Landmarks (Green Bank Telescope & Point Pleasant Bridge)
    if (t > 0.35) {
      const landmarkAlpha = Math.min(1, (t - 0.35) / 0.65);
      ctx.save();
      ctx.globalAlpha = landmarkAlpha;
      this.drawGreenBankTelescope(ctx, width * 0.18, height * 0.54, 0.85);
      this.drawPointPleasantBridge(ctx, width * 0.72, height * 0.64, 0.75);
      ctx.restore();
    }

    // 7. Ambient Motes (Pollen by Day, Fireflies by Night)
    ctx.save();
    if (t < 0.7) {
      const pAlpha = Math.max(0, 1 - t / 0.7);
      this.pollenMotes.forEach(mote => {
        ctx.fillStyle = `rgba(255, 238, 88, ${pAlpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(mote.x * width, mote.y * height, mote.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (t > 0.3) {
      const fAlpha = Math.min(1, (t - 0.3) / 0.7);
      this.fireflies.forEach(fly => {
        const glow = 0.4 + 0.6 * Math.sin(Date.now() * fly.pulseSpeed * 0.05 + fly.phase);
        const fx = fly.x * width;
        const fy = fly.y * height;

        // Firefly green-yellow halo
        const rad = fly.radius * (1.8 + glow);
        const flyGlow = ctx.createRadialGradient(fx, fy, 1, fx, fy, rad);
        flyGlow.addColorStop(0, `rgba(220, 255, 100, ${fAlpha * glow * 0.8})`);
        flyGlow.addColorStop(1, 'rgba(170, 255, 0, 0)');
        ctx.fillStyle = flyGlow;
        ctx.beginPath();
        ctx.arc(fx, fy, rad, 0, Math.PI * 2);
        ctx.fill();

        // Firefly tiny bright core
        ctx.fillStyle = `rgba(255, 255, 210, ${fAlpha * glow})`;
        ctx.beginPath();
        ctx.arc(fx, fy, fly.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  // Mountain ridge drawing with smooth sine curves
  drawMountainRidge(ctx, width, height, yRatio, amp, dayCol, sunCol, niteCol, index) {
    const t = this.timeOfDay;
    let col;
    if (t <= 0.5) {
      col = this.lerpColor(dayCol, sunCol, t / 0.5);
    } else {
      col = this.lerpColor(sunCol, niteCol, (t - 0.5) / 0.5);
    }

    ctx.save();
    ctx.fillStyle = this.rgb(col);
    ctx.beginPath();

    const startY = height * yRatio;
    ctx.moveTo(0, height);
    ctx.lineTo(0, startY);

    const steps = 30;
    const freq = (index + 1) * 0.7;
    for (let i = 0; i <= steps; i++) {
      const px = (i / steps) * width;
      const wave = Math.sin((i / steps) * Math.PI * 2 * freq + index) * amp * 0.5 +
                   Math.cos((i / steps) * Math.PI * 4 * freq) * amp * 0.25;
      ctx.lineTo(px, startY + wave);
    }

    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Green Bank Radio Telescope (Robert C. Byrd GBT)
  drawGreenBankTelescope(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const silColor = '#0b1426'; // Deep silhouette
    ctx.strokeStyle = silColor;
    ctx.fillStyle = silColor;
    ctx.lineWidth = 2.5;

    // Base & Support Towers
    ctx.beginPath();
    ctx.moveTo(-28, 40);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-18, 40);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(28, 40);
    ctx.lineTo(12, 10);
    ctx.lineTo(8, 10);
    ctx.lineTo(18, 40);
    ctx.fill();

    // Horizontal track & turntable
    ctx.fillRect(-34, 38, 68, 5);

    // Dish Support Pivot Arm
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(0, -6);
    ctx.lineTo(10, 10);
    ctx.stroke();

    // Massive Parabolic Dish (100-meter dish curve pointing skyward)
    ctx.beginPath();
    ctx.ellipse(4, -18, 42, 16, -0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#101e38';
    ctx.fill();
    ctx.strokeStyle = '#22385e';
    ctx.stroke();

    // Dish interior contour
    ctx.beginPath();
    ctx.ellipse(4, -18, 38, 12, -0.28, 0, Math.PI * 2);
    ctx.strokeStyle = '#385785';
    ctx.stroke();

    // Off-axis Feed Arm extending high above the dish
    ctx.strokeStyle = silColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -12);
    ctx.lineTo(-14, -48);
    ctx.lineTo(-6, -46);
    ctx.stroke();

    // Receiver cabin at the feed tip
    ctx.fillStyle = '#162846';
    ctx.fillRect(-18, -52, 8, 7);

    // Blinking red beacon on tip
    const blink = 0.5 + 0.5 * Math.sin(Date.now() * 0.006);
    ctx.fillStyle = `rgba(255, 30, 30, ${0.4 + blink * 0.6})`;
    ctx.beginPath();
    ctx.arc(-14, -53, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Point Pleasant Bridge (Silver Bridge Memorial Silhouette)
  drawPointPleasantBridge(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bridgeCol = '#0d182b';
    ctx.strokeStyle = bridgeCol;
    ctx.fillStyle = bridgeCol;
    ctx.lineWidth = 2;

    // Two Main Truss Towers
    const towerH = 48;
    const spanDist = 65;

    [-spanDist / 2, spanDist / 2].forEach(tx => {
      // Pier foundation in the water
      ctx.fillRect(tx - 6, 26, 12, 16);

      // Tower verticals & cross-bracing
      ctx.beginPath();
      ctx.moveTo(tx - 4, 26);
      ctx.lineTo(tx - 2, 26 - towerH);
      ctx.lineTo(tx + 2, 26 - towerH);
      ctx.lineTo(tx + 4, 26);
      ctx.stroke();

      // Cross braces
      ctx.beginPath();
      ctx.moveTo(tx - 3, 26 - 15);
      ctx.lineTo(tx + 3, 26 - 32);
      ctx.moveTo(tx + 3, 26 - 15);
      ctx.lineTo(tx - 3, 26 - 32);
      ctx.stroke();
    });

    // Bridge Deck
    ctx.fillRect(-spanDist - 25, 24, spanDist * 2 + 50, 4);

    // Suspension Eyebar Cables
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-spanDist - 25, 24);
    ctx.quadraticCurveTo(-spanDist / 2 - 12, 26 - towerH - 4, -spanDist / 2, 26 - towerH);
    ctx.quadraticCurveTo(0, 16, spanDist / 2, 26 - towerH);
    ctx.quadraticCurveTo(spanDist / 2 + 12, 26 - towerH - 4, spanDist + 25, 24);
    ctx.stroke();

    // Vertical suspender rods
    ctx.lineWidth = 1;
    for (let sx = -spanDist / 2 + 10; sx < spanDist / 2; sx += 11) {
      const sagY = 26 - towerH + Math.pow((sx / (spanDist / 2)), 2) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, sagY);
      ctx.lineTo(sx, 24);
      ctx.stroke();
    }

    // Warm deck lights
    const lightAlpha = 0.7 + 0.3 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = `rgba(255, 215, 64, ${lightAlpha})`;
    for (let lx = -spanDist - 15; lx <= spanDist + 15; lx += 18) {
      ctx.beginPath();
      ctx.arc(lx, 23, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

window.BackgroundRenderer = BackgroundRenderer;
