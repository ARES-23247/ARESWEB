// Pollen - Rhododendron Blossom & Springy Stem
// Creates the physical landing platform and handles tilt / torque calculations

class RhododendronFlower {
  constructor(world, centerX, groundY, flowerY) {
    this.world = world;
    this.centerX = centerX;
    this.groundY = groundY;
    this.flowerY = flowerY;

    this.headWidth = 240;
    this.headHeight = 36;
    this.tiltAngle = 0;
    this.maxTiltLimit = 0.72; // ~41 degrees - beyond this is catastrophe!

    this.createPhysics();
  }

  createPhysics() {
    const { Bodies, Body, Constraint, Composite } = Matter;

    // 1. Fixed ground anchor
    this.groundAnchor = Bodies.circle(this.centerX, this.groundY, 15, {
      isStatic: true,
      collisionFilter: { mask: 0 } // Don't collide with bugs
    });

    // 2. Main Blossom Landing Head (Compound shape for cupped petals)
    // Central bed
    const bed = Bodies.rectangle(this.centerX, this.flowerY, this.headWidth * 0.75, 20, {
      chamfer: { radius: 8 },
      friction: 0.85
    });

    // Left petal lip (angled up slightly)
    const leftLip = Bodies.rectangle(this.centerX - this.headWidth * 0.44, this.flowerY - 10, 50, 18, {
      chamfer: { radius: 6 },
      friction: 0.9,
      angle: -0.22
    });

    // Right petal lip (angled up slightly)
    const rightLip = Bodies.rectangle(this.centerX + this.headWidth * 0.44, this.flowerY - 10, 50, 18, {
      chamfer: { radius: 6 },
      friction: 0.9,
      angle: 0.22
    });

    this.head = Body.create({
      parts: [bed, leftLip, rightLip],
      friction: 0.88,
      restitution: 0.12,
      density: 0.008 // Heavy enough to support bugs, but responds to their weight
    });
    this.head.isFlowerHead = true;

    // 3. Central Pivot Pin / Hinge
    this.pivotConstraint = Constraint.create({
      pointA: { x: this.centerX, y: this.flowerY },
      bodyB: this.head,
      pointB: { x: 0, y: 0 },
      stiffness: 1.0,
      damping: 0.1
    });

    // 4. Balancing Spring Constraints (Left & Right stabilizers that provide restorative torque)
    const springDist = 70;
    this.leftSpring = Constraint.create({
      pointA: { x: this.centerX - springDist, y: this.flowerY + 80 },
      bodyB: this.head,
      pointB: { x: -springDist, y: 0 },
      stiffness: 0.016, // Organic springiness
      damping: 0.05
    });

    this.rightSpring = Constraint.create({
      pointA: { x: this.centerX + springDist, y: this.flowerY + 80 },
      bodyB: this.head,
      pointB: { x: springDist, y: 0 },
      stiffness: 0.016,
      damping: 0.05
    });

    Composite.add(this.world, [
      this.groundAnchor,
      this.head,
      this.pivotConstraint,
      this.leftSpring,
      this.rightSpring
    ]);
  }

  update() {
    this.tiltAngle = this.head.angle;
  }

  // Returns normalized danger factor: 0.0 (perfectly level) to 1.0 (tipping point)
  getDangerFactor() {
    return Math.min(1.0, Math.abs(this.tiltAngle) / this.maxTiltLimit);
  }

  isTippedOver() {
    return Math.abs(this.tiltAngle) >= this.maxTiltLimit;
  }

  reset() {
    const { Body } = Matter;
    Body.setPosition(this.head, { x: this.centerX, y: this.flowerY });
    Body.setAngle(this.head, 0);
    Body.setVelocity(this.head, { x: 0, y: 0 });
    Body.setAngularVelocity(this.head, 0);
    this.tiltAngle = 0;
  }

  // Render the stem, waxy mountain leaves, and pink rhododendron blossom
  draw(ctx, pose = this.head) {
    const hx = pose.position.x;
    const hy = pose.position.y;
    const angle = pose.angle;

    // 1. Draw Thin, Organic Curved Stem
    ctx.save();
    ctx.strokeStyle = '#2e7d32';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(this.centerX, this.groundY);
    // Control points follow head sway
    const ctrlX = this.centerX + (hx - this.centerX) * 0.45;
    const ctrlY = this.groundY - (this.groundY - hy) * 0.55;
    ctx.quadraticCurveTo(ctrlX, ctrlY, hx, hy + 10);
    ctx.stroke();

    // Stem highlight
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.centerX - 1, this.groundY);
    ctx.quadraticCurveTo(ctrlX - 1, ctrlY, hx - 1, hy + 10);
    ctx.stroke();
    ctx.restore();

    // 2. Waxy Evergreen Mountain Rhododendron Leaves at head collar
    ctx.save();
    ctx.translate(hx, hy + 12);
    ctx.rotate(angle * 0.7);

    // Left leaf
    this.drawLeaf(ctx, -55, 10, -0.45, 65, 26);
    // Right leaf
    this.drawLeaf(ctx, 55, 10, 0.45, 65, 26);
    // Center-back leaf
    this.drawLeaf(ctx, 0, 18, 0, 55, 22);
    ctx.restore();

    // 3. Rhododendron Blossom Petals (Layered Fuchsia/Pink Cluster)
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);

    // Back petals (deeper darker fuchsia)
    this.drawPetal(ctx, -75, -8, -0.35, 48, 38, '#ad1457', '#880e4f');
    this.drawPetal(ctx, 75, -8, 0.35, 48, 38, '#ad1457', '#880e4f');
    this.drawPetal(ctx, -40, -18, -0.18, 52, 42, '#c2185b', '#880e4f');
    this.drawPetal(ctx, 40, -18, 0.18, 52, 42, '#c2185b', '#880e4f');
    this.drawPetal(ctx, 0, -22, 0, 56, 44, '#d81b60', '#ad1457');

    // Foreground petals (vibrant warm pink with ruffled edges)
    this.drawPetal(ctx, -58, -4, -0.22, 54, 36, '#e91e63', '#c2185b');
    this.drawPetal(ctx, 58, -4, 0.22, 54, 36, '#e91e63', '#c2185b');
    this.drawPetal(ctx, -24, 0, -0.08, 58, 38, '#f06292', '#e91e63');
    this.drawPetal(ctx, 24, 0, 0.08, 58, 38, '#f06292', '#e91e63');
    this.drawPetal(ctx, 0, 2, 0, 62, 40, '#f48fb1', '#e91e63');

    // Delicate golden stamens with pollen anthers
    this.drawStamens(ctx);

    // Center calyx / landing pad cup
    ctx.fillStyle = '#ff80ab';
    ctx.beginPath();
    ctx.ellipse(0, 4, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawPetal(ctx, px, py, pAngle, w, h, fillCol, strokeCol) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(pAngle);

    const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, fillCol);
    grad.addColorStop(1, strokeCol);

    ctx.fillStyle = grad;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    // Ruffled petal curve
    ctx.bezierCurveTo(-w * 0.5, h * 0.3, -w * 0.6, -h * 0.3, -w * 0.2, -h * 0.5);
    ctx.bezierCurveTo(0, -h * 0.6, w * 0.2, -h * 0.5, w * 0.2, -h * 0.5);
    ctx.bezierCurveTo(w * 0.6, -h * 0.3, w * 0.5, h * 0.3, 0, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  drawLeaf(ctx, lx, ly, lAngle, len, width) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(lAngle);

    // Waxy evergreen leaf
    const grad = ctx.createLinearGradient(0, 0, len, 0);
    grad.addColorStop(0, '#1b5e20');
    grad.addColorStop(1, '#388e3c');

    ctx.fillStyle = grad;
    ctx.strokeStyle = '#0d3311';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -width * 0.5, len, 0);
    ctx.quadraticCurveTo(len * 0.5, width * 0.5, 0, 0);
    ctx.fill();
    ctx.stroke();

    // Central leaf vein
    ctx.strokeStyle = '#81c784';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.85, 0);
    ctx.stroke();

    ctx.restore();
  }

  drawStamens(ctx) {
    // 5 delicate curved stamens pointing upwards
    const offsets = [-20, -10, 0, 10, 20];
    ctx.save();
    ctx.strokeStyle = '#fff9c4';
    ctx.lineWidth = 1.5;

    offsets.forEach(off => {
      ctx.beginPath();
      ctx.moveTo(off * 0.5, 6);
      ctx.quadraticCurveTo(off * 0.7, -12, off * 0.9, -18);
      ctx.stroke();

      // Golden pollen anther
      ctx.fillStyle = '#fbc02d';
      ctx.beginPath();
      ctx.arc(off * 0.9, -19, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
}

window.RhododendronFlower = RhododendronFlower;
