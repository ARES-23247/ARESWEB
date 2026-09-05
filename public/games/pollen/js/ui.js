// Pollen - UI & HUD Manager
// Handles HUD updates, previews, modals, local storage high scores, and sound toggles

class UIManager {
  constructor(game) {
    this.game = game;

    // DOM Elements
    this.scoreValEl = document.getElementById('hud-score-val');
    this.critterCountEl = document.getElementById('hud-critters-val');
    this.turnInfoEl = document.getElementById('hud-turn-info');
    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;

    // Modals
    this.startModal = document.getElementById('start-modal');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.goScoreEl = document.getElementById('go-final-score');
    this.goBestEl = document.getElementById('go-best-score');
    this.goCrittersEl = document.getElementById('go-critters-count');
    this.goTitleEl = document.getElementById('go-title');
    this.goSubtitleEl = document.getElementById('go-subtitle');

    // High Score key
    this.storageKey = 'pollen_appalachian_high_score';
    this.highScore = 0;
    try {
      const stored = Number(localStorage.getItem(this.storageKey));
      if (Number.isSafeInteger(stored) && stored >= 0 && stored <= 1000000000) this.highScore = stored;
    } catch { /* The embedded game uses an opaque sandbox and the host score bridge. */ }
    window.addEventListener('message', (event) => {
      if (window.parent === window || event.source !== window.parent || event.data?.type !== 'pollen:score') return;
      const score = event.data.score;
      if (Number.isSafeInteger(score) && score >= 0 && score <= 1000000000) {
        this.highScore = Math.max(this.highScore, score);
        if (this.goBestEl) this.goBestEl.innerText = this.highScore.toLocaleString();
      }
    });
    if (window.parent !== window) window.parent.postMessage({ type: 'pollen:load-score' }, '*');

    this.bindEvents();
  }

  bindEvents() {
    // Mode selection buttons
    document.getElementById('btn-mode-solo')?.addEventListener('click', () => {
      this.hideModal(this.startModal);
      this.game.startMode('solo');
    });

    document.getElementById('btn-mode-pass')?.addEventListener('click', () => {
      this.hideModal(this.startModal);
      this.game.startMode('pass');
    });

    document.getElementById('btn-mode-dave')?.addEventListener('click', () => {
      this.hideModal(this.startModal);
      this.game.startMode('dave');
    });

    // Game over buttons
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.hideModal(this.gameOverModal);
      this.game.restart();
    });

    document.getElementById('btn-change-mode')?.addEventListener('click', () => {
      this.hideModal(this.gameOverModal);
      this.showModal(this.startModal);
    });

    // Sound toggle
    const soundBtn = document.getElementById('btn-sound-toggle');
    soundBtn?.addEventListener('click', () => {
      const isMuted = window.audioManager.toggleMute();
      soundBtn.innerText = isMuted ? '🔇' : '🔊';
    });

    // Fullscreen toggle
    const fsBtn = document.getElementById('btn-fs-toggle');
    if (window.parent !== window && fsBtn) fsBtn.hidden = true;
    fsBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.getElementById('canvas-wrapper')?.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    // Mobile / On-screen touch buttons
    document.getElementById('btn-rotate-left')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.rotateDrop(-0.25);
    });

    document.getElementById('btn-rotate-right')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.rotateDrop(0.25);
    });

    document.getElementById('btn-touch-drop')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.game.handleDropAction();
    });
  }

  showModal(modalEl) {
    if (modalEl) {
      modalEl.classList.remove('hidden');
      modalEl.querySelector('button')?.focus();
    }
  }

  hideModal(modalEl) {
    if (modalEl) modalEl.classList.add('hidden');
    this.game.canvas.focus();
  }

  updateHUD(score, crittersLanded, mode, currentTurn, isAiTurn) {
    if (this.scoreValEl) this.scoreValEl.innerText = score.toLocaleString();
    if (this.critterCountEl) this.critterCountEl.innerText = crittersLanded;

    // Turn indicator for Pass & Play or Vs. Dave
    if (this.turnInfoEl) {
      if (mode === 'pass') {
        this.turnInfoEl.style.display = 'block';
        this.turnInfoEl.innerText = `Player ${currentTurn}'s Turn`;
        this.turnInfoEl.style.background = currentTurn === 1 ? '#e1f5fe' : '#fff3e0';
        this.turnInfoEl.style.borderColor = currentTurn === 1 ? '#03a9f4' : '#ff9800';
      } else if (mode === 'dave') {
        this.turnInfoEl.style.display = 'block';
        this.turnInfoEl.innerText = isAiTurn ? "🤠 Ranger Dave's Turn..." : "Your Turn!";
        this.turnInfoEl.style.background = isAiTurn ? '#fff9c4' : '#e8f5e9';
        this.turnInfoEl.style.borderColor = isAiTurn ? '#fbc02d' : '#4caf50';
      } else {
        this.turnInfoEl.style.display = 'none';
      }
    }
  }

  drawPreview(nextPollinator) {
    if (!this.previewCtx || !nextPollinator) return;
    const ctx = this.previewCtx;
    const w = this.previewCanvas.width;
    const h = this.previewCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle background circle
    ctx.fillStyle = nextPollinator.id === 'mothman' ? '#ffebee' : '#f5f5f5';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = nextPollinator.id === 'mothman' ? '#ff1744' : '#ffb300';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scale down for preview
    const scale = nextPollinator.id === 'mothman' ? 0.45 : 0.65;
    ctx.save();
    ctx.translate(w / 2, h / 2 + 2);
    ctx.scale(scale, scale);
    PollinatorFactory.draw(ctx, nextPollinator, 0, 0, 0, true);
    ctx.restore();
  }

  showGameOver(score, crittersLanded, mode, currentTurn, isAiTurn) {
    // Check & save high score
    let isNewHigh = false;
    if (score > this.highScore) {
      this.highScore = score;
      try { localStorage.setItem(this.storageKey, this.highScore.toString()); } catch { /* Host stores the embedded game's score. */ }
      if (window.parent !== window) window.parent.postMessage({ type: 'pollen:save-score', score: this.highScore }, '*');
      isNewHigh = true;
    }

    if (this.goScoreEl) this.goScoreEl.innerText = score.toLocaleString();
    if (this.goBestEl) this.goBestEl.innerText = this.highScore.toLocaleString();
    if (this.goCrittersEl) this.goCrittersEl.innerText = crittersLanded;

    // Tailor titles according to game mode
    if (mode === 'pass') {
      const loser = currentTurn;
      const winner = loser === 1 ? 2 : 1;
      this.goTitleEl.innerText = `🏆 Player ${winner} Wins!`;
      this.goSubtitleEl.innerText = `Player ${loser} caused the blossom to tumble!`;
    } else if (mode === 'dave') {
      if (isAiTurn) {
        this.goTitleEl.innerText = `🎉 You Beat Ranger Dave!`;
        this.goSubtitleEl.innerText = `Ranger Dave's boots slipped on the rhododendron!`;
      } else {
        this.goTitleEl.innerText = `🤠 Ranger Dave Wins!`;
        this.goSubtitleEl.innerText = `The blossom gave way! Ranger Dave tips his hat to you.`;
      }
    } else {
      this.goTitleEl.innerText = isNewHigh ? `🌟 New Mountain Record!` : `🌸 Blossom Tumbled!`;
      this.goSubtitleEl.innerText = isNewHigh
        ? `Incredible balance! That's a new personal best score!`
        : `How many critters can you fit before she gives way?`;
    }

    this.showModal(this.gameOverModal);
  }
}

window.UIManager = UIManager;
