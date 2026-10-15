import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebaseFirestore";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { logger } from "@/utils/logger";

interface AcademyFeedbackSectionProps {
  slug: string;
  canSubmitFeedback: boolean;
}

export default function AcademyFeedbackSection({
  slug,
  canSubmitFeedback,
}: AcademyFeedbackSectionProps) {
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [negativeFeedbackOpen, setNegativeFeedbackOpen] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");

  const feedbackDialogRef = useFocusTrap(negativeFeedbackOpen, () =>
    setNegativeFeedbackOpen(false),
  );

  const handleFeedback = async (isHelpful: boolean, comment = "") => {
    if (!slug || isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    setFeedbackMessage(null);
    try {
      await addDoc(collection(db, "docs_feedback"), {
        slug,
        isHelpful: isHelpful ? 1 : 0,
        comment,
        isResolved: 0,
        createdAt: new Date().toISOString(),
      });
      setFeedbackMessage({
        type: "success",
        text: isHelpful
          ? "Thanks for your feedback!"
          : "Thank you! We will use your feedback to improve this page.",
      });
    } catch (err) {
      logger.error("Error submitting feedback:", err);
      setFeedbackMessage({
        type: "error",
        text: "Failed to submit feedback. Please try again.",
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleNegativeFeedbackSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const comment = feedbackComment.trim();
    setNegativeFeedbackOpen(false);
    setFeedbackComment("");
    void handleFeedback(false, comment);
  };

  if (!canSubmitFeedback) {
    return (
      <p className="mb-8 mt-12 border-t border-white/10 pt-6 text-sm text-marble/60">
        Authorized team members can sign in to leave documentation feedback.
      </p>
    );
  }

  return (
    <>
      <AnimatePresence>
        {negativeFeedbackOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setNegativeFeedbackOpen(false)}
          >
            <motion.div
              ref={feedbackDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="documentation-feedback-title"
              tabIndex={-1}
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              className="w-full max-w-lg bg-obsidian border border-white/10 ares-cut p-6 shadow-2xl focus:outline-none"
              onClick={(event) => event.stopPropagation()}
            >
              <form onSubmit={handleNegativeFeedbackSubmit}>
                <h2
                  id="documentation-feedback-title"
                  className="text-xl font-bold text-white mb-2"
                >
                  How can we improve this page?
                </h2>
                <p className="text-sm text-marble/70 mb-5">
                  Share the part that was unclear or missing. A short note is
                  enough.
                </p>
                <label
                  htmlFor="documentation-feedback-comment"
                  className="block text-xs font-bold uppercase tracking-wider text-ares-gold mb-2"
                >
                  Feedback
                </label>
                <textarea
                  id="documentation-feedback-comment"
                  value={feedbackComment}
                  onChange={(event) => setFeedbackComment(event.target.value)}
                  rows={5}
                  className="w-full bg-black/40 border border-white/10 ares-cut-sm p-3 text-sm text-white placeholder:text-marble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan resize-y"
                  placeholder="Tell us what would make this lesson more useful."
                />
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setNegativeFeedbackOpen(false)}
                    className="px-4 py-2 border border-white/10 text-white ares-cut-sm text-xs font-bold uppercase tracking-wider hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-ares-red text-white ares-cut-sm text-xs font-bold uppercase tracking-wider hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Send Feedback
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-16 p-8 ares-cut bg-obsidian/50 border border-white/5 relative overflow-hidden group/feedback mb-8">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/feedback:opacity-20 transition-opacity">
          <BookOpen size={64} className="text-ares-gold rotate-12" />
        </div>
        <div className="relative z-10">
          <h4 className="text-xl font-bold text-white mb-2">Was this helpful?</h4>
          <p className="text-white/50 text-sm mb-6 max-w-md">
            Your feedback helps our engineering team improve the documentation
            for the entire community.
          </p>
          {feedbackMessage && (
            <div
              role={feedbackMessage.type === "error" ? "alert" : "status"}
              aria-live={
                feedbackMessage.type === "error" ? "assertive" : "polite"
              }
              className={`mb-6 p-3 ares-cut-sm text-sm font-bold ${
                feedbackMessage.type === "error"
                  ? "bg-ares-red text-white"
                  : "bg-ares-gold text-obsidian"
              }`}
            >
              {feedbackMessage.text}
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() => void handleFeedback(true)}
              disabled={isSubmittingFeedback}
              className="flex items-center gap-2 px-6 py-2.5 ares-cut-sm bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan font-bold hover:bg-ares-cyan hover:text-black transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className="text-lg">👍</span> Yes, it was
            </button>
            <button
              type="button"
              onClick={() => setNegativeFeedbackOpen(true)}
              disabled={isSubmittingFeedback}
              className="flex items-center gap-2 px-6 py-2.5 ares-cut-sm bg-ares-red/10 border border-ares-red/30 text-ares-red font-bold hover:bg-ares-red hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className="text-lg">👎</span> No, it wasn&apos;t
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
