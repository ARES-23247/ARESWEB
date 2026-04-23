import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Editor, Range } from '@tiptap/core';

interface MentionItem {
  id: string;
  label: string;
  email: string;
}

interface MentionListProps {
  items: MentionItem[];
  command: (props: { id: string }) => void;
  editor: Editor;
  range: Range;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Mock team members - in a real app, this might come from props.items or an API
  const teamMembers = [
    { id: 'ares_lead', label: 'Lead Engineer', email: 'lead@ares23247.team' },
    { id: 'software_team', label: 'Software Subteam', email: 'software@ares23247.team' },
    { id: 'design_team', label: 'Design Subteam', email: 'design@ares23247.team' },
    { id: 'outreach_team', label: 'Outreach Team', email: 'outreach@ares23247.team' },
    { id: 'mars_mentor', label: 'MARS Mentor', email: 'mentor@mars2614.team' },
  ];

  const selectItem = (index: number) => {
    const item = teamMembers[index];
    if (item) {
      props.command({ id: item.label });
    }
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + teamMembers.length - 1) % teamMembers.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % teamMembers.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-obsidian border border-ares-gray-dark ares-cut-sm shadow-2xl overflow-hidden min-w-[200px] backdrop-blur-xl animate-in fade-in zoom-in duration-200">
      <div className="p-2 border-b border-ares-gray-dark bg-ares-red/5">
        <span className="text-xs font-bold text-ares-red uppercase tracking-widest px-2">Team Members</span>
      </div>
      <div className="p-1">
        {teamMembers.map((item, index) => (
          <button
            key={index}
            onClick={() => selectItem(index)}
            className={`w-full flex flex-col px-3 py-2 ares-cut-sm text-left transition-all ${
              index === selectedIndex ? 'bg-ares-red/20 text-white shadow-inner' : 'text-ares-gray hover:bg-ares-gray-dark hover:text-white'
            }`}
          >
            <div className="text-sm font-bold">{item.label}</div>
            <div className="text-xs opacity-50">{item.email}</div>
          </button>
        ))}
      </div>
    </div>
  );
});

MentionList.displayName = 'MentionList';
