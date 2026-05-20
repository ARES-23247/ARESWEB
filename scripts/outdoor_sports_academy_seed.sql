-- Seed Science of Outdoor Sports Lessons in ARES Academy

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
  'cycling-gear-ratios', 
  'Drivetrain Leverage: Cycling Gear Ratios & Cadence', 
  'Science of Outdoor Sports', 
  1, 
  'Learn how sprocket sizes and pedaling cadence combine to optimize velocity and mechanical leverage.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Bicycles are fantastic examples of mechanical advantage. A rider transfers energy from their legs to the pedals, turning the front chainring, which pulls the chain to spin the rear cog and drive the wheel forward. By altering the size (tooth count) of the front chainring and rear sprockets, cyclists swap their legs'' muscle force for speed, matching the terrain."}]},{"type":"interactiveComponent","attrs":{"componentName":"cyclingGearRatios"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"Gears are like leverage. A large chainring connected to a tiny rear cog pulls a lot of chain per pedal stroke, spinning the rear wheel multiple times (high gear). A tiny front ring connected to a massive rear sprocket makes pedaling effortless but travels very little distance (climbing gear). Finding the optimal pedaling cadence, usually around 90 RPM, allows a rider to save their leg muscles and use their cardiovascular system for maximum endurance!"}]}]}',
  0, 0, 1, 'published', 0
),
(
  'skiing-carving-forces', 
  'Centripetal Balance: The Physics of Carving Turns', 
  'Science of Outdoor Sports', 
  2, 
  'Explore how centripetal acceleration, gravity, and ski edge angles balance for high-speed carved turns.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"When a skier or snowboarder makes a turn down a mountain, they are fighting two primary forces: gravity, which pulls them straight down, and centripetal force, which pulls them outward as they change direction. To carve a clean turn without skidding or sliding sideways, the athlete must tilt their equipment on its sharp metal edges and lean their body inside the turn at a precise balance angle."}]},{"type":"interactiveComponent","attrs":{"componentName":"skiingCarvingForces"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"Imagine swinging a bucket of water in a loop. The faster you swing it, the more the water pushes outward, staying in the bucket! When carving a turn, your body leans inward so that gravity pulls you down, but the centripetal force pushes you out, balancing you perfectly on your edge. If your lean angle matches the physical forces perfectly, your skis cut a clean, razor-thin track in the snow with zero skidding!"}]}]}',
  0, 0, 1, 'published', 0
),
(
  'kayaking-hydrodynamics', 
  'The Wave Barrier: Kayak Hydrodynamics & Hull Drag', 
  'Science of Outdoor Sports', 
  3, 
  'Discover the physics of hull speed, friction, and the exponential wave drag wall in paddling.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"A kayak is a displacement hull, meaning it floats by pushing aside water equal to its weight. As you paddle forward, the kayak generates waves: a crest at the bow and a crest at the stern. As speed increases, these waves grow longer. In fluid dynamics, a displacement hull faces a hard physical speed limit called Hull Speed, where the wave wavelength exactly matches the waterline length of the kayak."}]},{"type":"interactiveComponent","attrs":{"componentName":"kayakingHydrodynamics"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"A kayak pushes water aside, creating waves. These waves travel at a speed determined by their length. When the kayak reaches Hull Speed, the wave wavelength equals the kayak''s length, and it gets trapped in a deep trough. To go any faster, the kayak must climb up its own bow wave, which requires exponential power! This is why long racing kayaks go much faster than short, stubby whitewater boats."}]}]}',
  0, 0, 1, 'published', 0
),
(
  'hiking-grade-energy', 
  'Minetti Mechanics: Trail Slopes & Metabolic Energy', 
  'Science of Outdoor Sports', 
  4, 
  'Analyze metabolic energy expenditure on inclines and declines using the famous Minetti walking curve.', 
  '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hiking on a mountain is a rigorous physical exercise, but the amount of energy your body expends is not just determined by how far you hike. The steepness of the trail, or grade, plays a major role in human biomechanics. In 2002, scientist Alberto Minetti published a mathematical equation detailing the exact metabolic cost of walking on different slopes, establishing a clear efficiency curve."}]},{"type":"interactiveComponent","attrs":{"componentName":"hikingGradeEnergy"}},{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"In Other Words"}]},{"type":"paragraph","content":[{"type":"text","text":"Your muscles work like engines. Going uphill requires fighting gravity, which burns energy rapidly. But walking steeply downhill also wastes energy because your muscles act like brake pads, contracting to absorb shock. A gentle 10% downhill slope is the perfect sweet spot where gravity helps you walk with almost no effort! Understanding this U-shaped curve helps hikers plan their pacing and route elevation maps."}]}]}',
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
