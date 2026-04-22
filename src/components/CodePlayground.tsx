import { useState } from 'react';

import { CodeExample, EXAMPLES } from '../data/codePlaygroundExamples';

interface CodePlaygroundProps {
  examples?: CodeExample[];
  defaultExample?: string;
}

export default function CodePlayground({ examples = EXAMPLES }: CodePlaygroundProps) {
  const [selectedExample, setSelectedExample] = useState(0);
  const [code, setCode] = useState(examples[0].code);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleExampleChange = (index: number) => {
    setSelectedExample(index);
    setCode(examples[index].code);
    setOutput('');
    setHasError(false);
  };

  const runCode = () => {
    setIsRunning(true);
    setHasError(false);
    setOutput('Running code...\n\n');

    setTimeout(() => {
      try {
        // For educational purposes, we'll provide feedback about the code
        const example = examples[selectedExample];
        let analysis = `✅ Code Analysis for: ${example.name}\n`;
        analysis += `${'='.repeat(50)}\n\n`;
        analysis += `This example demonstrates proper MARSLib usage:\n\n`;

        if (example.name.includes('Swerve')) {
          analysis += `✓ Proper Command-based programming pattern\n`;
          analysis += `✓ Correct use of SwerveDrive.driveRobotRelative()\n`;
          analysis += `✓ ChassisSpeeds object for velocity control\n`;
          analysis += `✓ Proper requirement management with addRequirements()\n`;
          analysis += `\nTip: Adjust PID gains in SwerveConfig for tuning\n`;
        } else if (example.name.includes('Vision')) {
          analysis += `✓ Vision-based alignment using MARSVision\n`;
          analysis += `✓ PID controllers for x, y, and theta control\n`;
          analysis += `✓ Proper continuous angle handling\n`;
          analysis += `✓ Safe Optional handling for vision estimates\n`;
          analysis += `\nTip: Tune PID gains for smooth alignment\n`;
        } else if (example.name.includes('Elevator')) {
          analysis += `✓ LinearMechanismIO abstraction\n`;
          analysis += `✓ PID control with feedforward for gravity\n`;
          analysis += `✓ Proper periodic() update pattern\n`;
          analysis += `✓ Position command with completion detection\n`;
          analysis += `\nTip: Use SysId tool for PID tuning\n`;
        } else if (example.name.includes('State Machine')) {
          analysis += `✓ MARSStateMachine for complex logic\n`;
          analysis += `✓ Clear state definitions and transitions\n`;
          analysis += `✓ Proper subsystem coordination\n`;
          analysis += `✓ Safety with ESTOP state\n`;
          analysis += `\nTip: Add transition conditions for safety\n`;
        }

        analysis += `\n${'='.repeat(50)}\n`;
        analysis += `📚 Check the MARSLib documentation for more details!`;

        setOutput(analysis);
      } catch (error) {
        setHasError(true);
        setOutput(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      setIsRunning(false);
    }, 1000);
  };

  const resetCode = () => {
    setCode(examples[selectedExample].code);
    setOutput('');
    setHasError(false);
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '600px',
      backgroundColor: '#0a0a0a',
      border: '1px solid #2a2a2a',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header with example selector */}
      <div style={{
        padding: '15px',
        borderBottom: '1px solid #2a2a2a',
        background: '#111',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <label htmlFor="example-select" style={{ color: '#fff', fontFamily: '"Orbitron", sans-serif', fontSize: '14px' }}>
            Example:
          </label>
          <select
            id="example-select"
            value={selectedExample}
            onChange={(e) => handleExampleChange(Number(e.target.value))}
            style={{
              background: '#222',
              color: '#fff',
              border: '1px solid #444',
              padding: '8px 12px',
              borderRadius: '4px',
              fontFamily: '"Ubuntu", sans-serif',
              fontSize: '14px',
              minWidth: '200px'
            }}
          >
            {examples.map((example, index) => (
              <option key={index} value={index}>{example.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={runCode}
            disabled={isRunning}
            style={{
              background: isRunning ? '#444' : '#B32416',
              color: '#fff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '4px',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontFamily: '"Orbitron", sans-serif',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            {isRunning ? '⏳ Running...' : '▶ Run'}
          </button>
          <button
            onClick={resetCode}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #444',
              padding: '8px 15px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: '"Ubuntu", sans-serif',
              fontSize: '14px'
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: '12px 15px', background: '#0f0f0f', borderBottom: '1px solid #2a2a2a' }}>
        <p style={{
          color: '#aaa',
          fontFamily: '"Ubuntu", sans-serif',
          fontSize: '13px',
          margin: 0,
          fontStyle: 'italic'
        }}>
          {examples[selectedExample].description}
        </p>
      </div>

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, minHeight: '400px' }}>
        {/* Code editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #2a2a2a' }}>
          <div style={{
            padding: '8px 15px',
            background: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
            color: '#888',
            fontFamily: '"Orbitron", sans-serif',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            Java Code
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              flex: 1,
              background: '#0a0a0a',
              color: '#d4d4d4',
              border: 'none',
              padding: '15px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              resize: 'none',
              outline: 'none'
            }}
            spellCheck={false}
            aria-label="Code editor"
          />
        </div>

        {/* Output panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '8px 15px',
            background: '#1a1a1a',
            borderBottom: '1px solid #2a2a2a',
            color: '#888',
            fontFamily: '"Orbitron", sans-serif',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            Output
          </div>
          <div style={{
            flex: 1,
            background: '#0a0a0a',
            padding: '15px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '13px',
            lineHeight: '1.6',
            color: hasError ? '#f48771' : '#a5d6ff',
            overflow: 'auto',
            whiteSpace: 'pre-wrap'
          }}>
            {output || 'Run the code to see analysis and feedback...'}
          </div>
        </div>
      </div>
    </div>
  );
}