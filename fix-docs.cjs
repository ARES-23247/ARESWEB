const { execSync } = require('child_process');
const fs = require('fs');

const createAST = (title, bodyParagraphs, components = []) => {
  const content = [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: title }]
    }
  ];

  for (const p of bodyParagraphs) {
    if (p.startsWith('## ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: p.replace('## ', '') }]
      });
    } else {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: p }]
      });
    }
  }

  for (const comp of components) {
    content.push({
      type: 'interactiveComponent',
      attrs: { componentName: comp }
    });
  }

  return JSON.stringify({ type: 'doc', content });
};

const docs = [
  {
    slug: 'culture-core-values',
    title: 'Core Values',
    desc: 'The bedrock principles of ARES 23247.',
    content: createAST('ARES 23247 Core Values', [
      '## The Mountaineer Mindset',
      'Grit, Determination, and Innovation are the pillars of the ARES 23247 mindset. We do not stop when things get hard.',
      '## Gracious Professionalism',
      'We compete fiercely, but treat everyone with respect and kindness.',
      '## Relentless Improvement',
      'We evaluate every system, every codebase, and every CAD model to ensure championship-grade reliability.'
    ], ['CoreValueCallout'])
  },
  {
    slug: 'interactive-code-challenges',
    title: 'Code Challenges',
    desc: 'Test your knowledge with interactive Code Challenges.',
    content: createAST('Interactive Code Challenges', [
      'Take our automated code challenges and improve your programming skills.',
      '## Challenge 1: The NaN Firewall',
      'Implement a safe arithmetic operation that ensures no NaN propagates.'
    ], ['CodePlayground'])
  },
  {
    slug: 'interactive-java-basics-quiz',
    title: 'Java Basics Quiz',
    desc: 'Quiz yourself on Java programming fundamentals.',
    content: createAST('Java Basics Quiz', [
      'The Java basics quiz tests your knowledge on data types, loops, and object oriented programming.',
      '## Instructions',
      'Use the interactive quiz module below.'
    ], ['InteractiveTutorial'])
  },
  {
    slug: 'interactive-code-playground',
    title: 'Interactive Code Playground',
    desc: 'Sandbox for exploring ARESLib utilities.',
    content: createAST('Interactive Code Playground', [
      'A sandbox environment for running simulated FTC robot code right from the documentation portal.',
      '## Try it out',
      'Explore the various classes and methods below.'
    ], ['CodePlayground'])
  },
  {
    slug: 'troubleshooting-hardware-bus',
    title: 'Hardware Bus Troubleshooting',
    desc: 'How to diagnose and fix I2C / CAN bus dropouts.',
    content: createAST('Hardware Bus Troubleshooting', [
      '## Identifying the Issue',
      'If your robot stops responding and REV hardware reports communication failures, you may have a bus dropout.',
      '## Resolution Steps',
      '1. Check your wiring for loose crimps or exposed copper.',
      '2. Ensure loop times are constrained to 20ms.',
      '3. Use the AresAlert dashboard to isolate failing nodes.'
    ], ['FaultSim'])
  },
  {
    slug: 'troubleshooting-network-issues',
    title: 'Network Issues',
    desc: 'Troubleshooting Control Hub Wi-Fi and connection issues.',
    content: createAST('Network Issues', [
      '## Diagnosing Dropouts',
      'A robust 5GHz connection is required for continuous telemetry streams.',
      '## Solutions',
      '- Avoid using Bluetooth devices near the driver station.',
      '- Ensure your client device is connected to the 5GHz FTC network.',
      '- Update Control Hub firmware.'
    ], ['TroubleshootingWizard'])
  },
  {
    slug: 'troubleshooting-robot-wont-move',
    title: 'Robot Won\'t Move',
    desc: 'Checklist to follow when the drivetrain is unresponsive.',
    content: createAST('Robot Won\'t Move', [
      '## Initial Checks',
      'Ensure the battery is above 12.5V and securely plugged in. Check the driver station for active faults.',
      '## Deep Dive',
      'If the robot still refuses to move, check for firmware mismatch on the Expansion Hub or verify that the active OpMode doesn\'t have a failing assertion.'
    ], ['PowerSheddingSim', 'TroubleshootingWizard'])
  },
  {
    slug: 'operations-checklist',
    title: 'Operations Checklist',
    desc: 'Pre-flight checklist for competition matches.',
    content: createAST('Operations Checklist', [
      '## Pre-Match Checks',
      'The following items must be verified before the robot is placed on the field:',
      '- Battery > 13.0V',
      '- All Anderson connectors verified secure.',
      '- Camera lenses clean.',
      '- Drive train modules straight.'
    ], [])
  }
];

let sql = '';
for (const doc of docs) {
  // Use sqlite proper quoting
  const escapedContent = doc.content.replace(/'/g, "''");
  const escapedTitle = doc.title.replace(/'/g, "''");
  const escapedDesc = doc.desc.replace(/'/g, "''");
  
  sql += `UPDATE docs SET title = '${escapedTitle}', description = '${escapedDesc}', content = '${escapedContent}' WHERE slug = '${doc.slug}';\n`;
}

fs.writeFileSync('docs-content-fix.sql', sql);
console.log('docs-content-fix.sql generated');

try {
  console.log('Executing D1 migration...');
  execSync('npx wrangler d1 execute ares-db --file=docs-content-fix.sql --local', { stdio: 'inherit' });
  console.log('Migration successful');
} catch (e) {
  console.error('Migration failed:', e.message);
}
