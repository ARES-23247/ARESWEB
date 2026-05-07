import React, { useEffect, useState } from "react";

type Question = {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type QuizState = {
  score: number;
  current: number;
  selected: number | null;
  showAnswer: boolean;
  timeLeft: number;
  timedOut: boolean;
};

export default function BeeTwentyQuestionsQuiz() {
  const questions: Question[] = [
    {
      id: 1,
      question: "🐝 How many bee species exist?",
      options: ["200", "2,000", "20,000+", "200,000"],
      correctIndex: 2,
      explanation:
        "There are over 20,000 known bee species on Earth.",
    },
    {
      id: 2,
      question: "🍯 Honey is made from?",
      options: ["Pollen", "Nectar", "Water", "Sap"],
      correctIndex: 1,
      explanation:
        "Bees convert nectar into honey using enzymes and evaporation.",
    },
    {
      id: 3,
      question: "💃 Waggle dance is used for?",
      options: ["Defense", "Sleep", "Food location", "Cleaning hive"],
      correctIndex: 2,
      explanation:
        "Bees communicate food location using the waggle dance.",
    },
    {
      id: 4,
      question: "👀 Bees can see?",
      options: ["Infrared", "Ultraviolet", "X-ray", "Dark only"],
      correctIndex: 1,
      explanation:
        "Bees see ultraviolet light patterns on flowers.",
    },
    // 🔁 Duplicate/expand to reach 20 in real version
  ];

  // 🧠 enforce 20-question mode
  const limitedQuestions = questions.slice(0, 20);

  const [state, setState] = useState<QuizState>({
    score: 0,
    current: 0,
    selected: null,
    showAnswer: false,
    timeLeft: 10,
    timedOut: false,
  });

  const currentQ = limitedQuestions[state.current];
  const finished = state.current >= limitedQuestions.length;

  // ⏱️ TIMER SYSTEM
  useEffect(() => {
    if (state.showAnswer || finished || state.timeLeft <= 0) return;

    const timer = setTimeout(() => {
      setState((prev) => {
        if (prev.timeLeft <= 1) {
          return { ...prev, timeLeft: 0, showAnswer: true, timedOut: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [state.timeLeft, state.showAnswer, finished]);

  function selectAnswer(index: number) {
    if (state.showAnswer) return;

    const isCorrect = index === currentQ.correctIndex;

    setState((prev) => ({
      ...prev,
      selected: index,
      showAnswer: true,
      timedOut: false,
      score: isCorrect ? prev.score + 1 : prev.score,
    }));
  }

  function next() {
    setState((prev) => ({
      ...prev,
      current: prev.current + 1,
      selected: null,
      showAnswer: false,
      timeLeft: 10,
      timedOut: false,
    }));
  }

  function getButtonColor(i: number) {
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308"];

    if (!state.showAnswer) return colors[i];

    if (i === currentQ.correctIndex) return "#16a34a";
    if (i === state.selected) return "#991b1b";
    return "#374151";
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#ff7a18,#ffb347)",
        color: "white",
        fontFamily: "monospace",
        padding: 20,
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 40 }}>🐝 Bee Twenty Questions</h1>

      {/* HUD */}
      <div style={{ display: "flex", justifyContent: "center", gap: 30 }}>
        <div>🏆 {state.score}</div>
        <div>
          📍 {state.current + 1}/20
        </div>
        <div>⏱️ {state.timeLeft}</div>
      </div>

      {!finished ? (
        <div style={{ marginTop: 40 }}>
          <h2>{currentQ.question}</h2>

          {/* ANSWERS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 20,
              marginTop: 30,
            }}
          >
            {currentQ.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => selectAnswer(i)}
                style={{
                  padding: 25,
                  fontSize: 18,
                  fontWeight: "bold",
                  borderRadius: 15,
                  border: "4px solid white",
                  boxShadow: "0 0 10px rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  background: getButtonColor(i),
                  transform:
                    state.selected === i ? "scale(1.05)" : "scale(1)",
                }}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* RESULT PANEL */}
          {state.showAnswer && (
            <div
              style={{
                marginTop: 30,
                padding: 20,
                borderRadius: 15,
                background: state.timedOut
                  ? "#78350f"
                  : state.selected === currentQ.correctIndex
                  ? "#065f46"
                  : "#7f1d1d",
              }}
            >
              {state.timedOut ? (
                <div>
                  ⏰ Time&apos;s Up!
                  <div style={{ marginTop: 10 }}>
                    Correct answer:{" "}
                    <strong>
                      {currentQ.options[currentQ.correctIndex]}
                    </strong>
                  </div>
                </div>
              ) : state.selected === currentQ.correctIndex ? (
                "✅ Correct!"
              ) : (
                "❌ Wrong!"
              )}

              <div style={{ marginTop: 10 }}>
                {currentQ.explanation}
              </div>

              <button
                onClick={next}
                style={{
                  marginTop: 15,
                  padding: 10,
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                👉 Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 50 }}>
          <h2>🎉 Twenty Questions Complete!</h2>
          <p>
            Final Score: {state.score} / 20
          </p>

          <p className="text-slate-400 mb-8">
            You&apos;ve completed the Bee Knowledge Challenge!
          </p>

          {state.score >= 15 ? (
            <p>👑 Queen Bee-level knowledge!</p>
          ) : state.score >= 10 ? (
            <p>🐝 Strong hive brain!</p>
          ) : (
            <p>🌼 Keep learning with the hive!</p>
          )}
        </div>
      )}
    </div>
  );
}