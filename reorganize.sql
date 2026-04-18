-- Reorganize Getting Started
UPDATE docs SET category = 'Getting Started', sort_order = 10 WHERE slug = 'guides-robot-setup';
UPDATE docs SET category = 'Getting Started', sort_order = 20 WHERE slug = 'guides-migration-basic-opmode';
UPDATE docs SET category = 'Getting Started', sort_order = 30 WHERE slug = 'guides-migration-ftclib';
UPDATE docs SET category = 'Getting Started', sort_order = 40 WHERE slug = 'guides-migration-nextftc';
UPDATE docs SET category = 'Getting Started', sort_order = 50 WHERE slug = 'guides-migration-roadrunner';
UPDATE docs SET category = 'Getting Started', sort_order = 60 WHERE slug = 'guides-video-tutorials';

-- Framework Architecture
UPDATE docs SET category = 'Framework Architecture', sort_order = 10 WHERE slug = 'guides-architecture-diagrams';
UPDATE docs SET category = 'Framework Architecture', sort_order = 20 WHERE slug = 'tutorials-hardware-abstraction';
UPDATE docs SET category = 'Framework Architecture', sort_order = 30 WHERE slug = 'tutorials-zero-allocation';
UPDATE docs SET category = 'Framework Architecture', sort_order = 40 WHERE slug = 'tutorials-fault-resilience';
UPDATE docs SET category = 'Framework Architecture', sort_order = 50 WHERE slug = 'tutorials-state-machines';

-- Subsystems
UPDATE docs SET category = 'Subsystems', sort_order = 10 WHERE slug = 'tutorials-swerve-kinematics';
UPDATE docs SET category = 'Subsystems', sort_order = 20 WHERE slug = 'tutorials-vision-fusion';
UPDATE docs SET category = 'Subsystems', sort_order = 30 WHERE slug = 'tutorials-physics-sim';
UPDATE docs SET category = 'Subsystems', sort_order = 40 WHERE slug = 'tutorials-power-management';
UPDATE docs SET category = 'Subsystems', sort_order = 50 WHERE slug = 'tutorials-telemetry-logging';
UPDATE docs SET category = 'Subsystems', sort_order = 60 WHERE slug = 'tutorials-autonomous-flow';
UPDATE docs SET category = 'Subsystems', sort_order = 70 WHERE slug = 'tutorials-sotm';

-- Advanced
UPDATE docs SET category = 'Advanced', sort_order = 10 WHERE slug = 'tutorials-live-feedforward-tuning';
UPDATE docs SET category = 'Advanced', sort_order = 20 WHERE slug = 'tutorials-sysid-tuning';
UPDATE docs SET category = 'Advanced', sort_order = 30 WHERE slug = 'tutorials-smart-assist-align';
UPDATE docs SET category = 'Advanced', sort_order = 40 WHERE slug = 'tutorials-controller-integration';
UPDATE docs SET category = 'Advanced', sort_order = 50 WHERE slug = 'guides-performance-benchmarks';
UPDATE docs SET category = 'Advanced', sort_order = 60 WHERE slug = 'tutorials-championship-testing';

-- Operations & Troubleshooting
UPDATE docs SET category = 'Operations & Troubleshooting', sort_order = 10 WHERE slug = 'tutorials-health-checks';
UPDATE docs SET category = 'Operations & Troubleshooting', sort_order = 20 WHERE slug = 'guides-troubleshooting';

-- Culture & Contributing
UPDATE docs SET category = 'Culture & Contributing', sort_order = 10 WHERE slug = 'standards';

-- Reference
UPDATE docs SET category = 'Reference', sort_order = 10 WHERE slug = 'reference-api-overview';
UPDATE docs SET category = 'Reference', sort_order = 20 WHERE slug = 'guides-recipe-library';
UPDATE docs SET category = 'Reference', sort_order = 30 WHERE slug = 'reference-example';
UPDATE docs SET category = 'Reference', sort_order = 40 WHERE slug = 'guides-example';
UPDATE docs SET category = 'Reference', sort_order = 50 WHERE slug = 'guides-media-gallery';
UPDATE docs SET category = 'Reference', sort_order = 60 WHERE slug = 'guides-faq';
