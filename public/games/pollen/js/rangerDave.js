// Pollen - Ranger Dave Bot AI
// Friendly Appalachian Park Ranger AI opponent with torque calculations & humorous banter

class RangerDaveBot {
  constructor(game) {
    this.game = game;
    this.isThinking = false;
    this.aimTargetX = 0;
    this.aimTargetAngle = 0;
    this.aimProgress = 0;

    // Speech bubble element
    this.bubbleEl = document.getElementById('dave-bubble');
    this.bubbleTimer = null;

    // Banter banks
    this.quotes = {
      start: [
        "Howdy partner! Ranger Dave here. Let's see how many mountain critters we can balance!",
        "Welcome to the high ridge! Keep an eye on that rhododendron stem!",
        "Nothin' beats a warm Appalachian afternoon... unless a bat knocks your flower down!"
      ],
      thinking: [
        "Hmm, let me gauge the mountain breeze...",
        "Crunchin' the torque numbers on my ranger clipboard...",
        "I reckon I know just the spot for this fella.",
        "Gotta be gentle as a moth's wing here..."
      ],
      balancedMove: [
        "Set down smooth as mountain butter!",
        "Square as a log cabin, just how we like it.",
        "That stem barely flinched! Good work, Dave.",
        "Balanced like a trout in a quiet stream."
      ],
      leanLeft: [
        "Whoa nelly! She's listin' harder than an old hillside barn!",
        "Port side's heavy! Need to counter-weight with a bee on the right!",
        "Hold on to your park ranger hats, folks!"
      ],
      leanRight: [
        "Blossom's tippin' right! Quick, someone grab a swallowtail!",
        "Careful now, that stem's bendin' like a willow in a July gale!",
        "She's leanin' mighty steep! One sneeze and it's over!"
      ],
      mothmanAppear: [
        "SWEET MOTHER OF SASQUATCH! Is that... MOTHMAN?!",
        "RED ALERT! The Point Pleasant legend has entered park airspace!",
        "Great Day in the morning! Mothman's comin' in hot with 500 bonus points!"
      ],
      mothmanSuccess: [
        "BY GOLLY, WE DID IT! Even the Green Bank Radio Telescope saw that land!",
        "Mothman is roostin'! Look at them red eyes glow over Point Pleasant!",
        "I'm puttin' this landing in the official Park Ranger record books!"
      ],
      tumbleDave: [
        "Aw shucks! Down goes the garden! My ranger clipboard slipped!",
        "Timber! That one was on me, partner!",
        "Well, butter my biscuits... that was one heavy bug!"
      ],
      tumblePlayer: [
        "Ouch! Even the best mountain climbers take a tumble!",
        "There she goes! What a magnificent tower of bugs that was!",
        "Good effort partner! That blossom couldn't take another ounce!"
      ]
    };
  }

  // Display speech bubble with Appalachian ranger dialogue
  speak(text, duration = 4000) {
    if (!this.bubbleEl) return;
    this.bubbleEl.innerText = `🤠 Ranger Dave: "${text}"`;
    this.bubbleEl.style.display = 'block';
    this.bubbleEl.style.opacity = '1';

    if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => {
      this.bubbleEl.style.opacity = '0';
      setTimeout(() => {
        if (this.bubbleEl.style.opacity === '0') {
          this.bubbleEl.style.display = 'none';
        }
      }, 300);
    }, duration);
  }

  // Calculate smart counter-balancing placement for the current pollinator
  calculateMove() {
    const flower = this.game.flower;
    const currentBug = this.game.currentPollinator;
    if (!flower || !currentBug) return;

    const tilt = flower.tiltAngle;
    const centerX = flower.centerX;

    // React verbally to extreme tilt or Mothman
    if (currentBug.id === 'mothman') {
      this.speak(this.pickRandom(this.quotes.mothmanAppear), 4500);
    } else if (tilt < -0.25) {
      this.speak(this.pickRandom(this.quotes.leanLeft), 3000);
    } else if (tilt > 0.25) {
      this.speak(this.pickRandom(this.quotes.leanRight), 3000);
    } else {
      this.speak(this.pickRandom(this.quotes.thinking), 2500);
    }

    // Counter-balancing heuristic:
    // If tilt is negative (leaning left), Dave aims to the right (positive offset)
    // If tilt is positive (leaning right), Dave aims to the left (negative offset)
    const maxOffset = 75; // Stay well within the 240px flower head
    let targetOffset = 0;

    if (Math.abs(tilt) > 0.05) {
      // Counterbalance proportional to tilt and inverted with bug weight
      const weightFactor = 1.0 / (currentBug.weight * 0.7);
      targetOffset = -Math.sign(tilt) * Math.min(maxOffset, Math.abs(tilt) * 140 * weightFactor);
    } else {
      // Flower is fairly level: distribute near center with slight alternating offset
      targetOffset = (Math.random() - 0.5) * 40;
    }

    // Add a pinch of human variance
    const noise = (Math.random() - 0.5) * 18;
    this.aimTargetX = Math.max(centerX - maxOffset, Math.min(centerX + maxOffset, centerX + targetOffset + noise));

    // Desired landing rotation (counter the flower slope slightly)
    this.aimTargetAngle = -tilt * 0.5 + (Math.random() - 0.5) * 0.15;
    this.aimProgress = 0;
    this.isThinking = true;
  }

  // Update called every frame during AI turn
  update(dt = 1) {
    if (!this.isThinking || !this.game.isAiTurn) return;

    this.aimProgress += 0.02 * dt;

    // Smoothly interpolate current drop position toward target
    const curX = this.game.dropX;
    this.game.dropX += (this.aimTargetX - curX) * 0.08 * dt;

    const curAngle = this.game.dropAngle;
    this.game.dropAngle += (this.aimTargetAngle - curAngle) * 0.08 * dt;

    // Once aligned, release!
    if (this.aimProgress >= 1.0 && Math.abs(this.game.dropX - this.aimTargetX) < 4) {
      this.isThinking = false;
      this.game.dropPollinator();
    }
  }

  pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

window.RangerDaveBot = RangerDaveBot;
