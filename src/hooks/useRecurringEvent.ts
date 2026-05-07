import { useState, useCallback } from 'react';

export type LimitType = 'none' | 'count' | 'date';

export interface RecurringEventState {
  recurringGroupId: string | null;
  updateMode: 'single' | 'following';
  rruleFreq: string;
  limitType: LimitType;
  limitCount: string;
  limitDate: string;
}

export function useRecurringEvent(initialGroupId: string | null = null) {
  const [recurringGroupId, setRecurringGroupId] = useState<string | null>(initialGroupId);
  const [updateMode, setUpdateMode] = useState<'single' | 'following'>('single');
  const [rruleFreq, setRruleFreq] = useState('');
  const [limitType, setLimitType] = useState<LimitType>('none');
  const [limitCount, setLimitCount] = useState('');
  const [limitDate, setLimitDate] = useState('');

  const parseRrule = useCallback((rrule: string | null) => {
    let parsedFreq = '';
    let parsedLimitType: LimitType = 'none';
    let parsedLimitCount = '';
    let parsedLimitDate = '';

    if (rrule) {
      const parts = rrule.split(';');
      parts.forEach((p: string) => {
        if (p.startsWith('FREQ=')) parsedFreq = p;
        else if (p.startsWith('COUNT=')) {
          parsedLimitType = 'count';
          parsedLimitCount = p.substring(6);
        }
        else if (p.startsWith('UNTIL=')) {
          parsedLimitType = 'date';
          const dStr = p.substring(6);
          if (dStr.length >= 8) parsedLimitDate = `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
        }
      });
    }

    setRruleFreq(parsedFreq);
    setLimitType(parsedLimitType);
    setLimitCount(parsedLimitCount);
    setLimitDate(parsedLimitDate);
  }, []);

  const buildRrule = useCallback((): string => {
    let finalRrule = rruleFreq;
    if (finalRrule && limitType === 'count' && limitCount) {
      finalRrule += `;COUNT=${limitCount}`;
    } else if (finalRrule && limitType === 'date' && limitDate) {
      finalRrule += `;UNTIL=${limitDate.replace(/-/g, '')}T000000Z`;
    }
    return finalRrule;
  }, [rruleFreq, limitType, limitCount, limitDate]);

  const resetRecurringState = useCallback(() => {
    setRruleFreq('');
    setLimitType('none');
    setLimitCount('');
    setLimitDate('');
    setRecurringGroupId(null);
    setUpdateMode('single');
  }, []);

  return {
    recurringGroupId,
    setRecurringGroupId,
    updateMode,
    setUpdateMode,
    rruleFreq,
    setRruleFreq,
    limitType,
    setLimitType,
    limitCount,
    setLimitCount,
    limitDate,
    setLimitDate,
    parseRrule,
    buildRrule,
    resetRecurringState,
  };
}
