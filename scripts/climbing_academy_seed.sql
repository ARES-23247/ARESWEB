-- Seed Rock Climbing Physics & Biomechanics Lessons in ARES Academy

INSERT INTO docs (
  slug, 
  title, 
  category, 
  sort_order, 
  description, 
  content, 
  display_in_areslib, 
  display_in_math_corner, 
  display_in_science_corner, 
  status, 
  is_deleted
)
VALUES 
(
  'climbing-fall-factor', 
  'The Physics of Falls: Fall Factors & Impact Force', 
  'Science of Climbing', 
  1, 
  'Learn how the ratio of fall distance to rope length determines the force felt by a falling climber.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"When a lead climber falls, gravity pulls them downward, creating kinetic energy. The climbing rope must absorb this energy to bring the climber to a safe stop. The safety of a fall is not determined by how high the climber is from the ground, but rather by the ratio of the fall height to the length of active rope. This ratio is called the Fall Factor."}]},{"type":"interactiveComponent","attrs":{"componentName":"climbingFallFactor"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"Imagine falling 10 feet. If you are high on the wall with 100 feet of rope paid out, the fall factor is 0.1. The long rope stretches like a soft trampoline, cushioning your fall. But if you fall 10 feet right above the belayer with only 10 feet of rope out, the fall factor is 1.0. This is a much harder, more jarring catch because there is very little rope to stretch and absorb the shock. Always use dynamic (stretchy) ropes for lead climbing!"}]}]}',
  0, 0, 1, 'published', 0
),
(
  'climbing-center-of-mass', 
  'Balance & Friction: Center of Mass on the Wall', 
  'Science of Climbing', 
  2, 
  'Explore the physics of balance, gravity, friction, and holding your body close to overhangs.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Climbing is a constant battle against gravity. To stay on the wall, your body must manage two main physics principles: Center of Mass and Friction. Your Center of Mass is the point where the weight of your body is balanced. Friction is the force that prevents your hands and feet from slipping off hold surfaces. When climbing overhangs or steep slabs, body position changes how forces are distributed."}]},{"type":"interactiveComponent","attrs":{"componentName":"climbingCenterOfMass"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"To keep from falling off, you want your Center of Mass (your hips) as close to the wall as possible. When you sag away from the wall, gravity pulls you outward, which makes your hands work much harder. Also, pushing down hard on your feet increases the normal force against the footholds, which boosts friction. Good footwork is all about using physics to save your forearm muscles!"}]}]}',
  0, 0, 1, 'published', 0
),
(
  'climbing-anchor-angles', 
  'Anchor Systems: Vectors & Load Sharing', 
  'Science of Climbing', 
  3, 
  'See how vector math affects climbing anchor systems and multiplies forces under wide angles.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Climbers use anchors at the top of a route to secure themselves and their partners. A standard anchor connects two or more separate bolts to a single master point. You might think that using two bolts always cuts the load on each bolt in half, but physics tells a different story. The angle between the two legs of the anchor determines how the force is distributed. This is a classic example of vector addition."}]},{"type":"interactiveComponent","attrs":{"componentName":"climbingAnchorAngles"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"If the two anchor bolts are close together, they share the weight evenly (50% each). But as you pull the bolts further apart, increasing the angle between the anchor legs, the force on each bolt actually multiplies! At a 120-degree angle, each bolt is pulled with 100% of the climber''s weight—offering no load reduction at all. Above 120 degrees, the anchor system actually amplifies the force, making it highly dangerous. Keep your anchor angles narrow—ideally below 60 degrees!"}]}]}',
  0, 0, 1, 'published', 0
),
(
  'climbing-capstan-friction', 
  'The Capstan Effect: Belaying & Friction', 
  'Science of Climbing', 
  4, 
  'Learn how the capstan effect allows a light belayer to catch a heavy climber using friction.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"When a climber falls, their belayer must catch them. How can a 100-pound person easily hold a 200-pound falling climber? The answer is friction. Belayers use metal devices that bend the rope around tight curves. This physical phenomenon is known as the Capstan Effect. As a rope wraps around a circular cylinder, the holding force increases exponentially with the angle of contact."}]},{"type":"interactiveComponent","attrs":{"componentName":"climbingCapstanFriction"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"The Capstan Effect is like wrapping a rope around a tree trunk. If you wrap it once, it is much easier to hold a heavy object on the other end. In climbing, the belay device forces the rope to make sharp turns, which multiplies the belayer''s holding power by up to 20 times! This friction converts the kinetic energy of a fall into thermal energy (heat), warming up the belay device. Physics allows a lightweight belayer to safely protect a much heavier climber."}]}]}',
  0, 0, 1, 'published', 0
),
(
  'climbing-finger-biomechanics', 
  'Finger Biomechanics: Crimp vs. Open Hand', 
  'Science of Climbing', 
  5, 
  'Discover the biological forces inside climbing fingers under crimp versus open-hand grips.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Climbing holds can be incredibly small, forcing climbers to support their entire body weight on their fingertips. The muscles that pull your fingers closed are in your forearm, connected to your fingertips by long tendons. These tendons are held flat against your finger bones by small ligament bands called pulleys. When you pull on holds, these pulleys experience intense stress, which can lead to injuries depending on how you shape your fingers."}]},{"type":"interactiveComponent","attrs":{"componentName":"climbingFingerBiomechanics"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"When you use a crimp grip, you bend your middle finger joint at a sharp angle. This makes the tendon pull outward away from the bone like a bowstring. This outward force places huge pressure on your A2 and A4 pulleys. If you use an open-hand grip, your fingers drape naturally, keeping the tendon close to the bone. This reduces the outward shear force by more than 4 times, making open-hand grips much safer and less likely to cause a finger pulley rupture. Train your open-hand grip to prevent injuries!"}]}]}',
  0, 0, 1, 'published', 0
)
ON CONFLICT(slug) DO UPDATE SET 
  title=excluded.title, 
  category=excluded.category, 
  sort_order=excluded.sort_order,
  description=excluded.description, 
  content=excluded.content, 
  display_in_math_corner=excluded.display_in_math_corner, 
  display_in_science_corner=excluded.display_in_science_corner,
  status=excluded.status,
  is_deleted=excluded.is_deleted;
