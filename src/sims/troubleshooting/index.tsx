/** @sim {"name": "MARSLib Error Triage Engine", "requiresContext": true} */
import { useState } from 'react';
import '../TroubleshootingWizard.css';

export interface TroubleshootingStep {
  id: string;
  question: string;
  type: 'choice' | 'yesno' | 'input';
  options?: {
    label: string;
    value: string;
    nextStep: string;
  }[];
  nextStep?: {
    yes: string;
    no: string;
  };
}

export interface TroubleshootingSolution {
  id: string;
  title: string;
  description: string;
  steps: string[];
  severity: 'low' | 'medium' | 'high';
  estimatedTime: string;
  relatedDocs?: string[];
}

interface TroubleshootingWizardProps {
  title: string;
  description: string;
  steps: Record<string, TroubleshootingStep>;
  solutions: Record<string, TroubleshootingSolution>;
  startStep: string;
}

export default function TroubleshootingWizard({
  title,
  description,
  steps,
  solutions,
  startStep,
}: TroubleshootingWizardProps) {
  const [currentStepId, setCurrentStepId] = useState(startStep);
  const [history, setHistory] = useState<string[]>([startStep]);
  const [selectedSolution, setSelectedSolution] = useState<TroubleshootingSolution | null>(null);

  const currentStep = steps[currentStepId];

  const handleChoice = (nextStep: string) => {
    setCurrentStepId(nextStep);
    setHistory([...history, nextStep]);
  };

  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setCurrentStepId(newHistory[newHistory.length - 1]);
      setSelectedSolution(null);
    }
  };

  const handleReset = () => {
    setCurrentStepId(startStep);
    setHistory([startStep]);
    setSelectedSolution(null);
  };

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    };
    return icons[severity] || '⚪';
  };

  const getSeverityClass = (severity: string) => {
    return `severity-${severity}`;
  };

  return (
    <div className="troubleshooting-wizard">
      {/* Header */}
      <div className="wizard-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {/* Progress */}
      <div className="wizard-progress">
        <div className="progress-steps">
          {history.map((stepId, index) => (
            <div
              key={stepId}
              className={`progress-step ${index === history.length - 1 ? 'current' : ''} ${
                index < history.length - 1 ? 'completed' : ''
              }`}
            >
              {index + 1}
            </div>
          ))}
        </div>
        <button className="reset-btn" onClick={handleReset}>
          Start Over
        </button>
      </div>

      {/* Content */}
      <div className="wizard-content">
        {!selectedSolution ? (
          /* Question Step */
          <div className="question-step">
            <div className="question-card">
              <div className="question-icon">❓</div>
              <h2>{currentStep.question}</h2>

              {currentStep.type === 'choice' && currentStep.options && (
                <div className="choice-options">
                  {currentStep.options.map((option) => (
                    <button
                      key={option.value}
                      className="choice-btn"
                      onClick={() => {
                        const solution = solutions[option.nextStep];
                        if (solution) {
                          setSelectedSolution(solution);
                        } else {
                          handleChoice(option.nextStep);
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {currentStep.type === 'yesno' && currentStep.nextStep && (
                <div className="yesno-options">
                  <button
                    className="yesno-btn yesno-yes"
                    onClick={() => {
                      const solution = solutions[currentStep.nextStep!.yes];
                      if (solution) {
                        setSelectedSolution(solution);
                      } else {
                        handleChoice(currentStep.nextStep!.yes);
                      }
                    }}
                  >
                    ✓ Yes
                  </button>
                  <button
                    className="yesno-btn yesno-no"
                    onClick={() => {
                      const solution = solutions[currentStep.nextStep!.no];
                      if (solution) {
                        setSelectedSolution(solution);
                      } else {
                        handleChoice(currentStep.nextStep!.no);
                      }
                    }}
                  >
                    ✗ No
                  </button>
                </div>
              )}

              {/* Navigation */}
              <div className="wizard-navigation">
                {history.length > 1 && (
                  <button className="nav-btn nav-btn-back" onClick={handleBack}>
                    ← Back
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Solution Step */
          <div className="solution-step">
            <div className={`solution-card ${getSeverityClass(selectedSolution.severity)}`}>
              <div className="solution-header">
                <div className="solution-icon">
                  {getSeverityIcon(selectedSolution.severity)}
                </div>
                <div>
                  <h2>{selectedSolution.title}</h2>
                  <div className="solution-meta">
                    <span className="solution-severity">
                      {selectedSolution.severity.toUpperCase()} PRIORITY
                    </span>
                    <span className="solution-time">
                      ⏱️ {selectedSolution.estimatedTime}
                    </span>
                  </div>
                </div>
              </div>

              <p className="solution-description">{selectedSolution.description}</p>

              <div className="solution-steps">
                <h3>Steps to Fix:</h3>
                <ol>
                  {selectedSolution.steps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>

              {selectedSolution.relatedDocs && selectedSolution.relatedDocs.length > 0 && (
                <div className="related-docs">
                  <h4>📚 Related Documentation</h4>
                  <div className="docs-list">
                    {selectedSolution.relatedDocs.map((doc, index) => (
                      <a key={index} href={doc} className="doc-link">
                        {doc}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="wizard-navigation">
                <button className="nav-btn nav-btn-back" onClick={handleBack}>
                  ← Back
                </button>
                <button className="nav-btn nav-btn-reset" onClick={handleReset}>
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Help Footer */}
      <div className="wizard-footer">
        <p>
          Still need help?{' '}
          <a href="https://github.com/MARSProgramming/MARSLib/issues" target="_blank" rel="noopener noreferrer">
            Report an issue
          </a>
          {' '}or{' '}
          <a href="https://discord.gg/marslib" target="_blank" rel="noopener noreferrer">
            ask on Discord
          </a>
        </p>
      </div>
    </div>
  );
}
