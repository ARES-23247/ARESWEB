import React from 'react';
import './CoreValueCallout.css';

interface CoreValueCalloutProps {
  value: 'discovery' | 'innovation' | 'impact' | 'teamwork' | 'inclusion' | 'fun';
  children: React.ReactNode;
}

const valueConfig = {
  discovery: { title: 'Discovery', icon: '/img/core-values/discovery.png', color: 'var(--ares-danger)' },
  innovation: { title: 'Innovation', icon: '/img/core-values/innovation.png', color: 'var(--ares-cyan)' },
  impact: { title: 'Impact', icon: '/img/core-values/impact.png', color: 'var(--ares-bronze)' },
  teamwork: { title: 'Teamwork', icon: '/img/core-values/teamwork.png', color: 'var(--ares-bronze-light)' },
  inclusion: { title: 'Inclusion', icon: '/img/core-values/inclusion.png', color: 'var(--brand-discord)' },
  fun: { title: 'Fun', icon: '/img/core-values/fun.png', color: 'var(--ares-gold)' },
};

export const CoreValueCallout = ({ value, children }: CoreValueCalloutProps) => {
  const config = valueConfig[value];

  return (
    <div className={`core-value-callout ${value}`} style={{ '--accent-color': config.color } as React.CSSProperties}>
      <div className="callout-header">
        <img src={config.icon} alt="" className="callout-icon" />
        <span className="callout-label">MARS {config.title} Moment</span>
      </div>
      <div className="callout-content">
        {children}
      </div>
    </div>
  );
};
