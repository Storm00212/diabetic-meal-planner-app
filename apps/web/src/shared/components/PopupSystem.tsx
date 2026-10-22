import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { api } from "@/app/api";
import type { Popup, PopupTrigger, StoppedPopupsResponse, PopupType } from "@glucoplate/types";

type PopupContextType = {
  currentPopup: Popup | null;
  showPopup: (trigger: PopupTrigger) => Promise<void>;
  dismissPopup: () => void;
  stopPopupType: (type: PopupType) => Promise<void>;
  stoppedTypes: PopupType[];
  refreshStoppedTypes: () => Promise<void>;
};

const PopupContext = createContext<PopupContextType | null>(null);

export function PopupProvider({ children }: { children: ReactNode }) {
  const [currentPopup, setCurrentPopup] = useState<Popup | null>(null);
  const [stoppedTypes, setStoppedTypes] = useState<PopupType[]>([]);
  const [lastShownAt, setLastShownAt] = useState<number>(0);
  const MIN_INTERVAL_MS = 10 * 60 * 1000;

  const refreshStoppedTypes = useCallback(async () => {
    try {
      const data = await api.llm.stoppedPopups();
      setStoppedTypes(data.stopped);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refreshStoppedTypes();
  }, [refreshStoppedTypes]);

  const showPopup = useCallback(
    async (trigger: PopupTrigger) => {
      if (stoppedTypes.includes(trigger.type)) return;

      const now = Date.now();
      if (now - lastShownAt < MIN_INTERVAL_MS) return;

      try {
        const data = await api.llm.popup(trigger);
        if (data.popup) {
          setCurrentPopup(data.popup);
          setLastShownAt(now);
        }
      } catch {
        /* ignore popup failures */
      }
    },
    [stoppedTypes, lastShownAt],
  );

  const dismissPopup = useCallback(() => {
    setCurrentPopup(null);
  }, []);

  const stopPopupType = useCallback(
    async (type: PopupType) => {
      try {
        await api.llm.updateStoppedPopup({ type, stopped: true });
        setStoppedTypes((prev) => [...prev, type]);
        if (currentPopup?.type === type) {
          setCurrentPopup(null);
        }
      } catch {
        /* ignore */
      }
    },
    [currentPopup],
  );

  return (
    <PopupContext.Provider
      value={{
        currentPopup,
        showPopup,
        dismissPopup,
        stopPopupType,
        stoppedTypes,
        refreshStoppedTypes,
      }}
    >
      {children}
      {currentPopup && (
        <PopupModal popup={currentPopup} onDismiss={dismissPopup} onStop={stopPopupType} />
      )}
    </PopupContext.Provider>
  );
}

function PopupModal({
  popup,
  onDismiss,
  onStop,
}: {
  popup: Popup;
  onDismiss: () => void;
  onStop: (type: PopupType) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 animate-fade-in"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="popup-title"
      aria-describedby="popup-body"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 id="popup-title" className="text-lg font-semibold text-slate-900">
              {popup.title}
            </h3>
            <p id="popup-body" className="mt-2 text-sm text-slate-600">
              {popup.body}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Dismiss"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Got it
          </button>
          {popup.stoppable && (
            <button
              onClick={() => {
                onStop(popup.type);
                onDismiss();
              }}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Stop showing these
            </button>
          )}
        </div>

        {popup.fallback && (
          <p className="mt-3 text-xs text-amber-600">
            This message was generated from a cached template.
          </p>
        )}
      </div>
    </div>
  );
}

export function usePopups() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error("usePopups must be used within a PopupProvider");
  }
  return context;
}

export function usePopupTriggers() {
  const { showPopup } = usePopups();

  const triggerMilestone = useCallback(
    (key: string) => showPopup({ type: "milestone", key }),
    [showPopup],
  );

  const triggerDailyChallenge = useCallback(() => showPopup({ type: "daily_challenge" }), [showPopup]);

  const triggerTip = useCallback(() => showPopup({ type: "tip" }), [showPopup]);

  const triggerRecommendation = useCallback(() => showPopup({ type: "recommendation" }), [showPopup]);

  return { triggerMilestone, triggerDailyChallenge, triggerTip, triggerRecommendation };
}