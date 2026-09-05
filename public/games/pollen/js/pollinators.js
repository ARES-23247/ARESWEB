// Pollen - Appalachian Pollinator Roster
// Definitions, physical bodies, weights, point values, and vector drawing routines

const POLLINATOR_TYPES = {
  BEE: {
    id: 'bee',
    name: 'Honeybee',
    weight: 1.0,
    width: 32,
    height: 24,
    points: 10,
    rarity: 0.35,
    description: 'Small & nimble. Fits easily in tight petal gaps.'
  },
  BUTTERFLY: {
    id: 'butterfly',
    name: 'Tiger Swallowtail',
    weight: 0.6,
    width: 48,
    height: 26,
    points: 15,
    rarity: 0.28,
    description: 'Featherlight with wide wings. Great landing platform.'
  },
  LUNA_MOTH: {
    id: 'luna_moth',
    name: 'Luna Moth',
    weight: 1.8,
    width: 44,
    height: 36,
    points: 25,
    rarity: 0.20,
    description: 'Luminous lime wings with trailing tails.'
  },
  BAT: {
    id: 'bat',
    name: 'Little Brown Bat',
    weight: 2.8,
    width: 38,
    height: 30,
    points: 50,
    rarity: 0.12,
    description: 'Heavier nocturnal flyer with grippy feet.'
  },
  MOTHMAN: {
    id: 'mothman',
    name: 'Mothman',
    weight: 5.0,
    width: 62,
    height: 52,
    points: 500,
    rarity: 0.05, // Legendary cryptid
    description: 'The Point Pleasant Legend! Massive weight & huge +500 pt bonus!'
  }
};

class PollinatorFactory {
  // Weighted random picker. If Mothman rolls, special event occurs!
  static getRandomType(consecutiveRolls = 0) {
    // Guaranteed Mothman every 7-10 critters if not rolled naturally
    if (consecutiveRolls >= 7 && Math.random() < 0.4) {
      return POLLINATOR_TYPES.MOTHMAN;
    }

    const rand = Math.random();
    let cumulative = 0;
    const types = [
      POLLINATOR_TYPES.BEE,
      POLLINATOR_TYPES.BUTTERFLY,
      POLLINATOR_TYPES.LUNA_MOTH,
      POLLINATOR_TYPES.BAT,
      POLLINATOR_TYPES.MOTHMAN
    ];

    for (const t of types) {
      cumulative += t.rarity;
      if (rand <= cumulative) {
        return t;
      }
    }
    return POLLINATOR_TYPES.BEE;
  }

  // Create Matter.js physics body for a pollinator
  static createBody(type, x, y, angle = 0) {
    const { Bodies, Body } = Matter;

    let body;
    if (type.id === 'bee') {
      // Rounded pill / ellipse body
      body = Bodies.rectangle(x, y, type.width, type.height, {
        chamfer: { radius: 10 },
        friction: 0.85,
        restitution: 0.1,
        density: 0.002 * type.weight
      });
    } else if (type.id === 'butterfly') {
      // Trapezoid / wide platform
      body = Bodies.trapezoid(x, y, type.width, type.height, 0.4, {
        chamfer: { radius: 5 },
        friction: 0.9,
        restitution: 0.08,
        density: 0.0015 * type.weight
      });
    } else if (type.id === 'luna_moth') {
      body = Bodies.rectangle(x, y, type.width, type.height, {
        chamfer: { radius: 8 },
        friction: 0.85,
        restitution: 0.1,
        density: 0.0022 * type.weight
      });
    } else if (type.id === 'bat') {
      body = Bodies.rectangle(x, y, type.width, type.height, {
        chamfer: { radius: 7 },
        friction: 0.95, // Grippy claws
        restitution: 0.05,
        density: 0.003 * type.weight
      });
    } else if (type.id === 'mothman') {
      // Bulky, top-heavy compound or chamfered body
      body = Bodies.rectangle(x, y, type.width, type.height, {
        chamfer: { radius: 12 },
        friction: 0.9,
        restitution: 0.05,
        density: 0.0045 * type.weight
      });
    }

    Body.setAngle(body, angle);
    body.pollinatorType = type;
    body.landed = false;
    body.spawnTime = Date.now();
    return body;
  }

  // Render vector artwork for a pollinator at given position, angle, and state
  static draw(ctx, type, x, y, angle = 0, isHovering = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const t = (Date.now() % 1000) / 1000;
    const flap = Math.sin(t * Math.PI * 2 * (isHovering ? 8 : 2));

    switch (type.id) {
      case 'bee':
        PollinatorFactory.drawBee(ctx, flap, isHovering);
        break;
      case 'butterfly':
        PollinatorFactory.drawButterfly(ctx, flap, isHovering);
        break;
      case 'luna_moth':
        PollinatorFactory.drawLunaMoth(ctx, flap, isHovering);
        break;
      case 'bat':
        PollinatorFactory.drawBat(ctx, flap, isHovering);
        break;
      case 'mothman':
        PollinatorFactory.drawMothman(ctx, flap, isHovering);
        break;
    }

    ctx.restore();
  }

  // 1. Honeybee
  static drawBee(ctx, flap, isHovering) {
    // Translucent wings
    ctx.save();
    ctx.fillStyle = 'rgba(224, 247, 250, 0.82)';
    ctx.strokeStyle = '#80deea';
    ctx.lineWidth = 1.2;

    const wingFlap = flap * 0.35;
    // Left wing
    ctx.beginPath();
    ctx.ellipse(-6, -14 + wingFlap * 4, 11, 7, -0.4 + wingFlap, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Right wing
    ctx.beginPath();
    ctx.ellipse(6, -14 - wingFlap * 4, 11, 7, 0.4 - wingFlap, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Fuzzy striped body
    ctx.save();
    ctx.fillStyle = '#ffb300';
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 2;

    // Body base
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Black stripes
    ctx.fillStyle = '#26160c';
    [-6, 0, 6].forEach(sx => {
      ctx.fillRect(sx - 2, -10, 4, 20);
    });

    // Friendly face & stinger
    // Stinger
    ctx.fillStyle = '#1c100a';
    ctx.beginPath();
    ctx.moveTo(14, -2);
    ctx.lineTo(19, 0);
    ctx.lineTo(14, 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-8, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-9, -3, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.quadraticCurveTo(-15, -14, -13, -16);
    ctx.moveTo(-9, -8);
    ctx.quadraticCurveTo(-12, -15, -10, -17);
    ctx.stroke();
    ctx.restore();
  }

  // 2. Tiger Swallowtail Butterfly
  static drawButterfly(ctx, flap, isHovering) {
    ctx.save();
    const wingAngle = flap * (isHovering ? 0.35 : 0.1);

    // Wings (Bright Appalachian Yellow + Tiger Stripes)
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingAngle * side);

      // Forewing
      ctx.fillStyle = '#fdd835';
      ctx.strokeStyle = '#212121';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(8, -18, 20, -22, 24, -10);
      ctx.bezierCurveTo(24, 0, 14, 8, 0, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tiger stripes on forewing
      ctx.fillStyle = '#212121';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(14, -15);
      ctx.lineTo(17, -13);
      ctx.lineTo(10, -2);
      ctx.fill();

      // Hindwing with swallowtail extension
      ctx.fillStyle = '#fbc02d';
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.bezierCurveTo(10, 8, 16, 14, 15, 20);
      ctx.lineTo(18, 26); // Swallowtail tip
      ctx.lineTo(13, 22);
      ctx.bezierCurveTo(8, 18, 2, 10, 0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Blue & orange spot accents
      ctx.fillStyle = '#1e88e5';
      ctx.beginPath();
      ctx.arc(10, 16, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e64a19';
      ctx.beginPath();
      ctx.arc(6, 14, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // Slender body
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.ellipse(0, 0, 3, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-1, -10);
    ctx.quadraticCurveTo(-6, -18, -8, -17);
    ctx.moveTo(1, -10);
    ctx.quadraticCurveTo(6, -18, 8, -17);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Luna Moth
  static drawLunaMoth(ctx, flap, isHovering) {
    ctx.save();
    const wingAngle = flap * (isHovering ? 0.3 : 0.08);

    [-1, 1].forEach(side => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingAngle * side);

      // Pale luminous green wings
      ctx.fillStyle = '#c8e6c9';
      ctx.strokeStyle = '#558b2f';
      ctx.lineWidth = 1.8;

      // Forewing
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.bezierCurveTo(10, -22, 22, -20, 22, -6);
      ctx.bezierCurveTo(18, 2, 12, 6, 0, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Leading edge reddish/purple margin
      ctx.fillStyle = '#6a1b9a';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.bezierCurveTo(8, -22, 18, -21, 21, -8);
      ctx.lineTo(19, -6);
      ctx.bezierCurveTo(16, -17, 8, -18, 0, -4);
      ctx.fill();

      // Forewing eyespot
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.arc(11, -8, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a148c';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Hindwing with iconic Luna moth trailing tail
      ctx.fillStyle = '#dcedc8';
      ctx.strokeStyle = '#558b2f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(8, 8, 14, 14, 12, 20);
      // Long sweeping tail
      ctx.quadraticCurveTo(14, 28, 11, 34);
      ctx.quadraticCurveTo(8, 28, 7, 20);
      ctx.bezierCurveTo(4, 14, 2, 10, 0, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    // White fluffy body
    ctx.fillStyle = '#f1f8e9';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Feathery antennae
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-1, -8);
    ctx.lineTo(-7, -15);
    ctx.moveTo(1, -8);
    ctx.lineTo(7, -15);
    ctx.stroke();
    ctx.restore();
  }

  // 4. Little Brown Bat
  static drawBat(ctx, flap, isHovering) {
    ctx.save();
    const wingAngle = flap * (isHovering ? 0.4 : 0.12);

    // Leathery scalloped wings
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingAngle * side);

      ctx.fillStyle = '#3e2723';
      ctx.strokeStyle = '#27120a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(12, -14); // Arm bone
      ctx.lineTo(20, -10); // Finger tip
      ctx.quadraticCurveTo(16, -2, 16, 6);  // Scallop 1
      ctx.quadraticCurveTo(10, 8, 9, 14);   // Scallop 2
      ctx.quadraticCurveTo(4, 12, 0, 10);   // Scallop 3
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    // Fuzzy bat body
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head & Pointed ears
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.arc(0, -7, 6, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(-5, -9);
    ctx.lineTo(-8, -17);
    ctx.lineTo(-2, -11);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(5, -9);
    ctx.lineTo(8, -17);
    ctx.lineTo(2, -11);
    ctx.fill();

    // Little cute eyes & nose
    ctx.fillStyle = '#ffecb3';
    ctx.beginPath();
    ctx.arc(-2.5, -7, 1.2, 0, Math.PI * 2);
    ctx.arc(2.5, -7, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Claws / feet
    ctx.strokeStyle = '#1b0000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, 12);
    ctx.lineTo(-4, 16);
    ctx.moveTo(3, 12);
    ctx.lineTo(4, 16);
    ctx.stroke();

    ctx.restore();
  }

  // 5. Legendary MOTHMAN
  static drawMothman(ctx, flap, isHovering) {
    ctx.save();
    const wingAngle = flap * (isHovering ? 0.35 : 0.08);

    // Dark mysterious cryptid aura
    const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, 36);
    aura.addColorStop(0, 'rgba(183, 28, 28, 0.25)');
    aura.addColorStop(0.7, 'rgba(33, 33, 33, 0.15)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 36, 0, Math.PI * 2);
    ctx.fill();

    // Massive ragged wings
    [-1, 1].forEach(side => {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wingAngle * side);

      ctx.fillStyle = '#1c1b22';
      ctx.strokeStyle = '#0a0a0f';
      ctx.lineWidth = 2.2;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(14, -22, 28, -26, 32, -12);
      ctx.quadraticCurveTo(28, 0, 28, 14);
      ctx.quadraticCurveTo(18, 18, 16, 26);
      ctx.quadraticCurveTo(8, 22, 0, 16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wing tears / feathers
      ctx.strokeStyle = '#312e3b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(26, -10);
      ctx.moveTo(10, 4);
      ctx.lineTo(22, 10);
      ctx.stroke();

      ctx.restore();
    });

    // Bulky muscular cryptid body
    ctx.fillStyle = '#17161c';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head / cowl
    ctx.beginPath();
    ctx.arc(0, -9, 10, 0, Math.PI * 2);
    ctx.fill();

    // GLOWING CRIMSON RED EYES (Iconic Mothman signature!)
    const eyePulse = 0.8 + 0.3 * Math.sin(Date.now() * 0.008);
    const eyeGlow = ctx.createRadialGradient(-4, -9, 1, -4, -9, 8);
    eyeGlow.addColorStop(0, `rgba(255, 23, 68, ${eyePulse})`);
    eyeGlow.addColorStop(1, 'rgba(213, 0, 0, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(-4, -9, 8, 0, Math.PI * 2);
    ctx.arc(4, -9, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bright intense red eye cores
    ctx.fillStyle = '#ff1744';
    ctx.beginPath();
    ctx.ellipse(-4, -9, 3.2, 2.5, 0.1, 0, Math.PI * 2);
    ctx.ellipse(4, -9, 3.2, 2.5, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Sharp white pinprick pupils
    ctx.fillStyle = '#ffebee';
    ctx.beginPath();
    ctx.arc(-4, -9, 1.1, 0, Math.PI * 2);
    ctx.arc(4, -9, 1.1, 0, Math.PI * 2);
    ctx.fill();

    // Heavy clawed talons at the base
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-6, 20);
    ctx.lineTo(-8, 25);
    ctx.moveTo(-4, 20);
    ctx.lineTo(-4, 26);
    ctx.moveTo(6, 20);
    ctx.lineTo(8, 25);
    ctx.moveTo(4, 20);
    ctx.lineTo(4, 26);
    ctx.stroke();

    ctx.restore();
  }
}

window.POLLINATOR_TYPES = POLLINATOR_TYPES;
window.PollinatorFactory = PollinatorFactory;
