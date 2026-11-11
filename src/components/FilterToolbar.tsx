import { ChevronDown, ChevronUp, Shuffle, SlidersHorizontal, Star } from 'lucide-react';
import { useState } from 'react';
import { VALID_FOLDERS, VALID_SUBTOPICS } from '../data/seedData';
import type { StatusFilter, SubtopicKey, TopicFolder } from '../types/flashcard';

interface FilterToolbarProps {
  selectedCategory: 'all' | TopicFolder;
  onChangeCategory: (cat: 'all' | TopicFolder) => void;
  selectedSubtopic: 'all' | SubtopicKey;
  onChangeSubtopic: (sub: 'all' | SubtopicKey) => void;
  selectedStatus: StatusFilter;
  onChangeStatus: (status: StatusFilter) => void;
  folderCounts: Record<string, number>;
  subtopicCounts: Record<string, number>;
  onShuffle: () => void;
  showShuffle?: boolean;
}

export function FilterToolbar({
  selectedCategory,
  onChangeCategory,
  selectedSubtopic,
  onChangeSubtopic,
  selectedStatus,
  onChangeStatus,
  folderCounts,
  subtopicCounts,
  onShuffle,
  showShuffle = true,
}: FilterToolbarProps) {
  const [expanded, setExpanded] = useState(false);

  const activeFilterCount =
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedSubtopic !== 'all' ? 1 : 0) +
    (selectedStatus !== 'all' ? 1 : 0);

  return (
    <section className="rounded-2xl border border-[#E4E0D8] dark:border-[#2E332E] bg-white/80 dark:bg-[#212421]/95 backdrop-blur-xs px-4 py-3 transition-colors">
      {/* Top compact bar: Topic quick pills + Status + Toggle details */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChangeCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                : 'bg-[#F0EDE6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
            }`}
          >
            Todos <span className="font-mono-num opacity-75 ml-0.5">{folderCounts.all ?? 0}</span>
          </button>

          {VALID_FOLDERS.map((folder) => {
            const isSelected = selectedCategory === folder;
            const isMari = folder === 'Dicas da Mari';
            return (
              <button
                key={folder}
                type="button"
                onClick={() => onChangeCategory(folder)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected
                    ? isMari
                      ? 'bg-[#8F5A1C] text-white dark:bg-[#9E6520] dark:text-[#FBF7F0]'
                      : 'bg-[#28665E] text-white dark:bg-[#2A6D63] dark:text-[#F4F7F6]'
                    : 'bg-[#F0EDE6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                }`}
              >
                {isMari && <Star className="w-3 h-3 fill-current" />}
                <span>{folder}</span>
                <span className="font-mono-num opacity-75">{folderCounts[folder] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            aria-label="Filtrar por status de domínio"
            value={selectedStatus}
            onChange={(e) => onChangeStatus(e.target.value as StatusFilter)}
            className="px-2.5 py-1.5 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#1C1B18] dark:text-[#EBE7DE] focus:outline-none focus:ring-2 focus:ring-[#28665E]/30 cursor-pointer"
          >
            <option value="all">Todos os status</option>
            <option value="unseen">Não dominados</option>
            <option value="review">Para revisar</option>
            <option value="mastered">Dominados</option>
          </select>

          {showShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              title="Embaralhar ordem dos cards"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-xs font-medium text-[#5C574E] dark:text-[#D8D4CA] hover:text-[#1C1B18] dark:hover:text-[#F4F7F6] transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Embaralhar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              expanded || selectedSubtopic !== 'all'
                ? 'border-[#28665E]/40 dark:border-[#2F4B46] bg-[#EAF3F1] dark:bg-[#1E312E] text-[#28665E] dark:text-[#86CEC2]'
                : 'border-[#E4E0D8] dark:border-[#343A34] bg-[#FAF9F6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Subtópicos</span>
            {activeFilterCount > 0 && (
              <span className="font-mono-num text-[11px] font-semibold">· {activeFilterCount}</span>
            )}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Subtopic Row */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#E4E0D8] dark:border-[#2A2F2A] flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#857F74] dark:text-[#8A857C] mr-1">
            Contexto:
          </span>
          <button
            type="button"
            onClick={() => onChangeSubtopic('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              selectedSubtopic === 'all'
                ? 'bg-[#1C1B18] text-white dark:bg-[#323832] dark:text-[#F4F7F6] dark:border dark:border-[#454D45]'
                : 'bg-[#F0EDE6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
            }`}
          >
            Todos <span className="font-mono-num opacity-75">{subtopicCounts.all ?? 0}</span>
          </button>
          {VALID_SUBTOPICS.map((st) => {
            const isSelected = selectedSubtopic === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => onChangeSubtopic(st.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#1C1B18] text-white dark:bg-[#323832] dark:text-[#F4F7F6] dark:border dark:border-[#454D45]'
                    : 'bg-[#F0EDE6] dark:bg-[#292D29] text-[#5C574E] dark:text-[#AFAAA0] hover:text-[#1C1B18] dark:hover:text-[#EBE7DE]'
                }`}
              >
                {st.label}{' '}
                <span className="font-mono-num opacity-75">{subtopicCounts[st.key] ?? 0}</span>
              </button>
            );
          })}

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                onChangeCategory('all');
                onChangeSubtopic('all');
                onChangeStatus('all');
              }}
              className="ml-auto text-xs font-medium text-[#28665E] dark:text-[#68B4A8] hover:underline cursor-pointer"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}
