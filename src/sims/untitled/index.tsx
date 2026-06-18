import React, { useState } from "react";

interface Choice {
  text: string;
  nextScene: string;
  emoji?: string;
}

interface Scene {
  title: string;
  narrative: string;
  choices: Choice[];
  facts?: string[];
  bgGradient: string;
  emoji?: string;
}

const ALL_SCENES: Record<string, Scene> = {
  title: {
    title: "🐝 The Great Bee Adventure",
    narrative:
      "You've just emerged from your hexagonal wax cell inside a bustling honeybee hive. The warm hum of thousands of wings vibrates through your body. You are Buzz, a brand new honeybee — and today is your first day in the world!\n\nBut life as a bee isn't just about buzzing around. There's a whole world to discover, dangers to face, and an incredibly important job to do. The fate of your colony — and maybe even the planet — depends on the choices you make.\n\nAre you ready to begin your adventure?",
    choices: [
      {
        text: "Let's go! Start my life as a bee!",
        nextScene: "emerge",
        emoji: "🚀",
      },
    ],
    bgGradient:
      "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    emoji: "🍯",
  },

  emerge: {
    title: "A New Bee is Born!",
    narrative:
      "You push open the wax cap of your cell with your legs. The light is golden and warm. You're inside a honeycomb — thousands of perfect hexagonal cells surround you in every direction.\n\nA larger bee with a long, elegant body approaches you. She's a FORAGER — one of the oldest and wisest bees in the colony.\n\n\"Welcome, little one!\" she says. \"You're a worker bee, like me. Our colony has about 60,000 bees, and almost all of us are sisters!\"",
    choices: [
      { text: "Hive tour", nextScene: "hive_tour", emoji: "🏠" },
      { text: "Queen?", nextScene: "queen_intro", emoji: "👑" },
      { text: "My job?", nextScene: "worker_roles", emoji: "💪" },
    ],
    bgGradient:
      "linear-gradient(135deg, #2d1b00 0%, #4a2c00 40%, #6b3a00 100%)",
  },

  hive_tour: {
    title: "The Hive City",
    narrative:
      "The hive is a bustling living city of wax, warmth, and motion...",
    choices: [{ text: "Honey!", nextScene: "honey_making", emoji: "🍯" }],
    bgGradient:
      "linear-gradient(135deg, #3d2409 0%, #5c3800 50%, #7a4f00 100%)",
  },

  queen_intro: {
    title: "The Queen",
    narrative:
      "Queen Beatrice lays thousands of eggs a day, the heart of the colony.",
    choices: [
      { text: "Rearing queens", nextScene: "queen_rearing", emoji: "👑" },
    ],
    bgGradient:
      "linear-gradient(135deg, #2d1600 0%, #5c2d00 40%, #8a4400 100%)",
  },

  queen_rearing: {
    title: "New Queen Creation",
    narrative: "Royal jelly shapes destiny...",
    choices: [{ text: "Drones", nextScene: "drone_life", emoji: "🤖" }],
    bgGradient:
      "linear-gradient(135deg, #2a1500 0%, #4d2800 50%, #703d00 100%)",
  },

  drone_life: {
    title: "The Drones",
    narrative: "Male bees exist only for reproduction...",
    choices: [{ text: "Work roles", nextScene: "worker_roles", emoji: "📋" }],
    bgGradient:
      "linear-gradient(135deg, #1f1a00 0%, #3d3400 50%, #5c4d00 100%)",
  },

  worker_roles: {
    title: "A Worker's Life",
    narrative: "Cleaner → Nurse → Builder → Guard → Forager...",
    choices: [
      { text: "Nurse duty", nextScene: "nurse_duty", emoji: "👩‍🍼" },
    ],
    bgGradient:
      "linear-gradient(135deg, #1a2200 0%, #2d3d00 50%, #405500 100%)",
  },

  nurse_duty: {
    title: "Nursing",
    narrative: "Feeding larvae with bee bread...",
    choices: [{ text: "Build", nextScene: "builder_duty", emoji: "🏗️" }],
    bgGradient:
      "linear-gradient(135deg, #1a1a00 0%, #33301a 50%, #4d4526 100%)",
  },

  builder_duty: {
    title: "Building Comb",
    narrative: "Hexagonal wax architecture...",
    choices: [{ text: "Fly", nextScene: "first_flight", emoji: "🌤️" }],
    bgGradient:
      "linear-gradient(135deg, #2a2000 0%, #4d3d00 50%, #665200 100%)",
  },

  honey_making: {
    title: "Honey Making",
    narrative: "Nectar becomes honey through enzymatic magic...",
    choices: [{ text: "Fly", nextScene: "first_flight", emoji: "🌸" }],
    bgGradient:
      "linear-gradient(135deg, #4a3000 0%, #7a5000 50%, #a06800 100%)",
  },

  first_flight: {
    title: "First Flight",
    narrative: "The world opens beyond the hive...",
    choices: [
      { text: "Sunflower", nextScene: "sunflower_field", emoji: "🌻" },
    ],
    bgGradient:
      "linear-gradient(135deg, #0a3d0a 0%, #1a6b1a 40%, #2d9f2d 100%)",
  },

  sunflower_field: {
    title: "Sunflower Field",
    narrative: "Pollination in action...",
    choices: [],
    bgGradient:
      "linear-gradient(135deg, #4a4a00 0%, #8a8a00 40%, #b0b000 100%)",
  },
};

export default function SimComponent() {
  const [currentScene, setCurrentScene] = useState("title");

  const scene = ALL_SCENES[currentScene];

  if (!scene) {
    return <div>Scene not found: {currentScene}</div>;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: scene.bgGradient,
        color: "white",
        padding: "20px",
        fontFamily: "sans-serif",
        transition: "all 0.4s ease",
      }}
    >
      <h1>
        {scene.emoji} {scene.title}
      </h1>

      <p style={{ whiteSpace: "pre-wrap", marginTop: "20px" }}>
        {scene.narrative}
      </p>

      <div style={{ marginTop: "30px" }}>
        {scene.choices.map((choice, i) => (
          <button
            key={i}
            onClick={() => setCurrentScene(choice.nextScene)}
            style={{
              display: "block",
              margin: "10px 0",
              padding: "10px 15px",
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
            }}
          >
            {choice.emoji} {choice.text}
          </button>
        ))}
      </div>

      {scene.facts && (
        <div style={{ marginTop: "30px", opacity: 0.85 }}>
          <h3>🐝 Facts</h3>
          <ul>
            {scene.facts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}