import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

import { useMemo } from 'react';
import { api } from '../api/client';
import { BookOpen } from 'lucide-react';
import { DocRecord } from '../hooks/useDocs';

export default function ScienceCorner() {
  const { data: allDocsRes, isLoading } = api.docs.getDocs.useQuery(["docs-list"], {});

  const lessons = useMemo(() => {
    if (allDocsRes?.status !== 200) return [];
    return allDocsRes.body.docs.filter((doc: DocRecord) => doc.category === "Science Corner");
  }, [allDocsRes]);

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500"
          >
            Science Corner
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-slate-400 max-w-2xl mx-auto"
          >
            Interactive experiments, physics sandboxes, and mathematical models to help you understand the principles behind robotics.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && (
            <div className="col-span-full flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            </div>
          )}

          {!isLoading && lessons.length === 0 && (
            <div className="col-span-full text-center py-20 border border-slate-800 rounded-2xl bg-slate-900/50">
              <BookOpen size={48} className="text-slate-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Experiments Yet</h2>
              <p className="text-slate-400 max-w-md mx-auto">Science Corner lessons will appear here once they are published from the Admin Dashboard.</p>
            </div>
          )}

          {lessons.map((lesson: DocRecord, idx: number) => {
            const colors = [
              'from-blue-500 to-indigo-600',
              'from-emerald-400 to-teal-600',
              'from-ares-red to-orange-600',
              'from-purple-500 to-pink-600',
              'from-cyan-400 to-blue-600'
            ];
            const color = colors[idx % colors.length];

            return (
              <motion.div
                key={lesson.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Link 
                  to={`/science-corner/${lesson.slug}`}
                  className="block h-full bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-600 transition-all hover:shadow-2xl hover:shadow-blue-900/20 group relative overflow-hidden"
                >
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${color} opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`} />
                  
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {lesson.title}
                    </h3>
                  </div>
                  
                  <p className="text-slate-400 text-sm line-clamp-3">
                    {lesson.description || "Interactive physics simulation and lesson."}
                  </p>
                  
                  <div className="mt-6 flex items-center text-cyan-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                    Launch Experiment <span className="ml-2">→</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
