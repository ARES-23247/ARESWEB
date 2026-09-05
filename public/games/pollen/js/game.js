// Pollen - Main Game Loop & Coordinator
// Coordinates Matter.js Physics, Dynamic Weather, West Virginia Landmarks, and Game Modes

class PollenGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // High DPI scaling setup
    this.width = 600;
    this.height = 800;
    this.dpr = window.devicePixelRatio || 1;

    // Physics
    this.engine = null;
    this.world = null;
    this.runner = null;

    // Game state
    this.mode = 'solo'; // 'solo', 'pass', 'dave'
    this.state = 'menu'; // 'menu', 'aiming', 'falling', 'tumble', 'gameover'
    this.score = 0;
    this.crittersLanded = 0;
    this.currentTurn = 1; // 1 or 2 in Pass & Play
    this.isAiTurn = false;
    this.consecutiveRolls = 0;

    // Current & Next Pollinators
    this.currentPollinator = null;
    this.nextPollinator = null;
    this.activeBody = null;
    this.landedBodies = [];

    // Aiming coordinates
    this.dropX = this.width / 2;
    this.dropY = 85;
    this.dropAngle = 0;

    // Camera shake
    this.shakeAmount = 0;

    // Subsystems
    this.background = new window.BackgroundRenderer();
    this.flower = null;
    this.ui = new window.UIManager(this);
    this.rangerDave = new window.RangerDaveBot(this);

    this.initCanvas();
    this.initPhysics();
    this.bindInputs();
    this.startLoop();
  }

  initCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    window.addEventListener('resize', () => {
      const r = this.canvas.parentElement.getBoundingClientRect();
      this.width = r.width;
      this.height = r.height;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.ctx.scale(this.dpr, this.dpr);
      if (this.flower) {
        this.flower.centerX = this.width / 2;
        this.flower.groundY = this.height - 20;
        this.flower.flowerY = this.height * 0.58;
      }
    });
  }

  initPhysics() {
    const { Engine, World } = Matter;
    this.engine = Engine.create({
      gravity: { x: 0, y: 0.95 }
    });
    this.world = this.engine.world;

    // Build the flexible rhododendron flower
    const flowerY = this.height * 0.58;
    const groundY = this.height - 20;
    this.flower = new window.RhododendronFlower(this.world, this.width / 2, groundY, flowerY);

    // Collision events
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      this.handleCollision(event);
    });
  }

  bindInputs() {
    // Mouse movement across canvas
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isAiTurn || this.state !== 'aiming') return;
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      this.dropX = Math.max(60, Math.min(this.width - 60, clientX));
    });

    // Mouse scroll wheel rotation
    this.canvas.addEventListener('wheel', (e) => {
      if (this.isAiTurn || this.state !== 'aiming') return;
      e.preventDefault();
      this.dropAngle += e.deltaY * 0.002;
    }, { passive: false });

    // Mouse click to drop
    this.canvas.addEventListener('click', () => {
      if (this.isAiTurn || this.state !== 'aiming') return;
      window.audioManager.ensureContext();
      this.handleDropAction();
    });

    // Mobile touch move to aim
    this.canvas.addEventListener('touchmove', (e) => {
      if (this.isAiTurn || this.state !== 'aiming') return;
      if (e.touches.length > 0) {
        const rect = this.canvas.getBoundingClientRect();
        const touchX = e.touches[0].clientX - rect.left;
        this.dropX = Math.max(60, Math.min(this.width - 60, touchX));
      }
    }, { passive: true });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (this.isAiTurn || this.state !== 'aiming') return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.dropX = Math.max(60, this.dropX - 15);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.dropX = Math.min(this.width - 60, this.dropX + 15);
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'ArrowUp') {
        this.rotateDrop(-0.18);
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'ArrowDown') {
        this.rotateDrop(0.18);
      } else if (e.key === ' ' || e.key === 'Enter') {
        this.handleDropAction();
      }
    });
  }

  rotateDrop(delta) {
    this.dropAngle += delta;
  }

  startMode(mode) {
    this.mode = mode;
    this.restart();

    if (mode === 'dave') {
      this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.start), 4000);
    }
  }

  restart() {
    // Clear physics bodies of pollinators
    const { World, Composite } = Matter;
    this.landedBodies.forEach(b => World.remove(this.world, b));
    if (this.activeBody) World.remove(this.world, this.activeBody);

    this.landedBodies = [];
    this.activeBody = null;
    this.score = 0;
    this.crittersLanded = 0;
    this.consecutiveRolls = 0;
    this.currentTurn = 1;
    this.isAiTurn = false;
    this.shakeAmount = 0;

    // Reset flower
    this.flower.reset();

    // Reset day/night atmosphere
    this.background.setTimeTarget(0.0);

    // Roll initial pollinators
    this.currentPollinator = window.PollinatorFactory.getRandomType(this.consecutiveRolls);
    this.nextPollinator = window.PollinatorFactory.getRandomType(this.consecutiveRolls + 1);
    this.checkAtmosphereTriggers();

    this.dropX = this.width / 2;
    this.dropAngle = 0;
    this.state = 'aiming';

    this.ui.updateHUD(this.score, this.crittersLanded, this.mode, this.currentTurn, this.isAiTurn);
    this.ui.drawPreview(this.nextPollinator);
  }

  // Check if Mothman is appearing to shift atmosphere to sunset!
  checkAtmosphereTriggers() {
    if (this.currentPollinator.id === 'mothman' || this.nextPollinator.id === 'mothman') {
      // Shift to Sunset!
      this.background.setTimeTarget(0.5);
      window.audioManager.playMothmanArrival();

      if (this.mode === 'dave') {
        this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.mothmanAppear), 4500);
      }
    }
  }

  handleDropAction() {
    if (this.state !== 'aiming') return;
    this.dropPollinator();
  }

  dropPollinator() {
    this.state = 'falling';
    window.audioManager.playPluck(this.currentPollinator.id === 'mothman' ? 180 : 330);

    // Create Matter.js body at current aiming position & angle
    this.activeBody = window.PollinatorFactory.createBody(
      this.currentPollinator,
      this.dropX,
      this.dropY,
      this.dropAngle
    );

    Matter.World.add(this.world, this.activeBody);
  }

  handleCollision(event) {
    if (!this.activeBody || this.state !== 'falling') return;

    const pairs = event.pairs;
    for (let pair of pairs) {
      if (pair.bodyA === this.activeBody || pair.bodyB === this.activeBody) {
        // Active body made contact!
        this.onActiveBodyContact();
        break;
      }
    }
  }

  onActiveBodyContact() {
    // Settle check
    setTimeout(() => {
      if (this.state === 'falling' && this.activeBody) {
        this.settlePollinator();
      }
    }, 450);
  }

  settlePollinator() {
    if (!this.activeBody) return;

    this.activeBody.landed = true;
    this.landedBodies.push(this.activeBody);
    this.crittersLanded++;

    // Calculate score
    let pts = this.currentPollinator.points;
    if (this.currentPollinator.id === 'mothman') {
      // Mothman Bonus!
      pts += 500;
      window.audioManager.playMothmanBonus();
      // TRANSITION TO NIGHT: Green Bank Radio Telescope and Point Pleasant Bridge!
      this.background.setTimeTarget(1.0);
      if (this.mode === 'dave') {
        this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.mothmanSuccess), 4500);
      }
    } else {
      window.audioManager.playLand();
      if (this.mode === 'dave' && this.isAiTurn) {
        this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.balancedMove), 2800);
      }
    }

    this.score += pts;
    this.activeBody = null;
    this.consecutiveRolls++;

    // Advance queue
    this.currentPollinator = this.nextPollinator;
    this.nextPollinator = window.PollinatorFactory.getRandomType(this.consecutiveRolls);
    this.checkAtmosphereTriggers();

    // Reset drop angle & position to center
    this.dropX = this.width / 2;
    this.dropAngle = 0;

    // Switch turns for 2P or AI
    if (this.mode === 'pass') {
      this.currentTurn = this.currentTurn === 1 ? 2 : 1;
    } else if (this.mode === 'dave') {
      this.isAiTurn = !this.isAiTurn;
    }

    this.ui.updateHUD(this.score, this.crittersLanded, this.mode, this.currentTurn, this.isAiTurn);
    this.ui.drawPreview(this.nextPollinator);

    this.state = 'aiming';

    // If it's Dave's turn, trigger Dave's thought process
    if (this.mode === 'dave' && this.isAiTurn) {
      setTimeout(() => {
        if (this.state === 'aiming' && this.isAiTurn) {
          this.rangerDave.calculateMove();
        }
      }, 700);
    }
  }

  // Tumble failure detected
  triggerTumble(reason) {
    if (this.state === 'tumble' || this.state === 'gameover') return;
    this.state = 'tumble';

    this.shakeAmount = 14;
    window.audioManager.playTumble();

    if (this.mode === 'dave') {
      if (this.isAiTurn) {
        this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.tumbleDave), 4000);
      } else {
        this.rangerDave.speak(this.rangerDave.pickRandom(this.rangerDave.quotes.tumblePlayer), 4000);
      }
    }

    setTimeout(() => {
      this.state = 'gameover';
      this.ui.showGameOver(this.score, this.crittersLanded, this.mode, this.currentTurn, this.isAiTurn);
    }, 1100);
  }

  startLoop() {
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min((currentTime - lastTime) / 16.666, 2.5);
      lastTime = currentTime;

      this.update(dt);
      this.render();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update(dt) {
    // 1. Step Matter.js physics engine
    Matter.Engine.update(this.engine, 1000 / 60);

    // 2. Update flower state
    this.flower.update();

    // 3. Update dynamic background
    this.background.update(dt);

    // 4. Update Ranger Dave AI if thinking
    if (this.mode === 'dave' && this.isAiTurn) {
      this.rangerDave.update(dt);
    }

    // 5. Check if flower tipped over critical threshold
    if (this.state !== 'tumble' && this.state !== 'gameover' && this.state !== 'menu') {
      if (this.flower.isTippedOver()) {
        this.triggerTumble('tipped');
      }

      // Check if any landed critter or active critter slipped off below screen
      const killY = this.height + 60;
      for (let body of this.landedBodies) {
        if (body.position.y > killY) {
          this.triggerTumble('fell_off');
          break;
        }
      }

      if (this.activeBody && this.activeBody.position.y > killY) {
        this.triggerTumble('missed');
      }
    }

    // Camera shake decay
    if (this.shakeAmount > 0) {
      this.shakeAmount *= 0.9;
      if (this.shakeAmount < 0.2) this.shakeAmount = 0;
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    // Camera shake application
    if (this.shakeAmount > 0) {
      const sx = (Math.random() - 0.5) * this.shakeAmount;
      const sy = (Math.random() - 0.5) * this.shakeAmount;
      ctx.translate(sx, sy);
    }

    // 1. Dynamic Appalachian Background (Day/Sunset/Night)
    this.background.draw(ctx, this.width, this.height);

    // 2. The Rhododendron Blossom
    this.flower.draw(ctx);

    // 3. Landed Pollinators
    this.landedBodies.forEach(body => {
      if (body.pollinatorType) {
        window.PollinatorFactory.draw(
          ctx,
          body.pollinatorType,
          body.position.x,
          body.position.y,
          body.angle,
          false
        );
      }
    });

    // 4. Active Falling Pollinator
    if (this.activeBody && this.activeBody.pollinatorType) {
      window.PollinatorFactory.draw(
        ctx,
        this.activeBody.pollinatorType,
        this.activeBody.position.x,
        this.activeBody.position.y,
        this.activeBody.angle,
        false
      );
    }

    // 5. Aiming Pollinator (Hovering at top under cursor)
    if (this.state === 'aiming' && this.currentPollinator) {
      // Aiming guide line
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.dropX, this.dropY + 25);
      ctx.lineTo(this.dropX, this.height * 0.56);
      ctx.stroke();
      ctx.restore();

      // Draw hovering critter with wing flap animation
      window.PollinatorFactory.draw(
        ctx,
        this.currentPollinator,
        this.dropX,
        this.dropY,
        this.dropAngle,
        true
      );
    }

    // 6. Danger Indicator when stem tilts close to tipping point
    const danger = this.flower.getDangerFactor();
    if (danger > 0.65) {
      const flash = 0.5 + 0.5 * Math.sin(Date.now() * 0.012);
      ctx.fillStyle = `rgba(255, 23, 68, ${(danger - 0.65) * 1.5 * flash})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }
}

// Bootstrap once DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new PollenGame();
});
