/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Camera,
  Plus,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  Info,
  Pill,
  Trash2,
  CheckCircle2,
  ExternalLink,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  MedicineItem,
  ActiveWarning,
  checkAllInteractions,
  INTERACTION_DATABASE,
} from './data/interactions';
import { Header } from './components/Header';
import { ScanModal } from './components/ScanModal';
import { ManualAddModal } from './components/ManualAddModal';
import { WarningCard } from './components/WarningCard';
import { MedicineCard } from './components/MedicineCard';
import { DatabaseGuideModal } from './components/DatabaseGuideModal';
import { roadmapPages } from './pages/RoadmapPages';

export default function App() {
  const [route, setRoute] = useState(() => window.location.pathname);

  React.useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route.startsWith('/roadmap')) {
    return roadmapPages[route] ?? roadmapPages['/roadmap'];
  }

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Recent action feedback alert (e.g. "Aspirin added. Checking interactions...")
  const [recentNotification, setRecentNotification] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Compute all active interactions whenever the medicine list changes
  const activeWarnings: ActiveWarning[] = useMemo(() => {
    return checkAllInteractions(medicines);
  }, [medicines]);

  // Add medicine handler
  const handleAddMedicine = (newMedData: {
    name: string;
    dosage?: string;
    brandName?: string;
    photoThumbnail?: string;
    rawDetectedText?: string;
    source?: 'scan' | 'manual';
  }) => {
    const newMedicine: MedicineItem = {
      id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: newMedData.name,
      dosage: newMedData.dosage,
      brandName: newMedData.brandName,
      addedAt: Date.now(),
      source: newMedData.source || 'scan',
      photoThumbnail: newMedData.photoThumbnail,
      rawDetectedText: newMedData.rawDetectedText,
    };

    const updatedList = [...medicines, newMedicine];
    setMedicines(updatedList);

    // Evaluate immediate warning for feedback toast
    const newWarnings = checkAllInteractions(updatedList);
    const relatedWarning = newWarnings.find(
      (w) => w.medicineA.id === newMedicine.id || w.medicineB.id === newMedicine.id
    );

    if (relatedWarning) {
      setRecentNotification({
        type: 'warning',
        message: `⚠️ Interaction detected: ${relatedWarning.matchedPair[0]} + ${relatedWarning.matchedPair[1]} (${relatedWarning.severity.toUpperCase()} RISK)`,
      });
    } else {
      setRecentNotification({
        type: 'success',
        message: `✓ Added ${newMedicine.name}. No interactions detected so far.`,
      });
    }

    // Auto dismiss notification after 5s
    setTimeout(() => {
      setRecentNotification(null);
    }, 5000);
  };

  // Remove medicine handler
  const handleRemoveMedicine = (id: string) => {
    const medToRemove = medicines.find((m) => m.id === id);
    setMedicines((prev) => prev.filter((m) => m.id !== id));
    if (medToRemove) {
      setRecentNotification({
        type: 'info',
        message: `Removed ${medToRemove.name} from session list.`,
      });
      setTimeout(() => setRecentNotification(null), 3000);
    }
  };

  // Reset entire session
  const handleResetSession = () => {
    if (window.confirm('Clear all medicines in this session?')) {
      setMedicines([]);
      setRecentNotification(null);
    }
  };

  // Quick Preset test scenario helper
  const handleQuickAddPair = (drugA: string, drugB: string) => {
    const medA: MedicineItem = {
      id: `med-${Date.now()}-1`,
      name: drugA,
      dosage: drugA.toLowerCase().includes('warfarin')
        ? '5mg'
        : drugA.toLowerCase().includes('lithium')
        ? '300mg'
        : drugA.toLowerCase().includes('clozapine')
        ? '100mg'
        : drugA.toLowerCase().includes('digoxin')
        ? '0.25mg'
        : drugA.toLowerCase().includes('theophylline')
        ? '300mg'
        : drugA.toLowerCase().includes('methotrexate')
        ? '15mg'
        : '500mg',
      addedAt: Date.now(),
      source: 'manual',
    };
    const medB: MedicineItem = {
      id: `med-${Date.now()}-2`,
      name: drugB,
      dosage: drugB.toLowerCase().includes('carbamazepine')
        ? '200mg'
        : drugB.toLowerCase().includes('diclofenac')
        ? '50mg'
        : drugB.toLowerCase().includes('amiodarone')
        ? '200mg'
        : drugB.toLowerCase().includes('ciprofloxacin')
        ? '500mg'
        : drugB.toLowerCase().includes('trimethoprim')
        ? '200mg'
        : drugB.toLowerCase().includes('aspirin')
        ? '500mg'
        : '400mg',
      addedAt: Date.now() + 10,
      source: 'manual',
    };

    setMedicines((prev) => [...prev, medA, medB]);
    setRecentNotification({
      type: 'warning',
      message: `Loaded test pair: ${drugA} + ${drugB}`,
    });
    setTimeout(() => setRecentNotification(null), 4000);
  };

  const handleQuickAddSingle = (drugName: string) => {
    handleAddMedicine({
      name: drugName,
      source: 'manual',
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <Header
        medicines={medicines}
        warnings={activeWarnings}
        onReset={handleResetSession}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-5 sm:py-8 space-y-6">
        {/* Floating Notification / Feedback Toast */}
        {recentNotification && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-between shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
              recentNotification.type === 'warning'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : recentNotification.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {recentNotification.type === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              {recentNotification.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              )}
              {recentNotification.type === 'info' && (
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
              )}
              <span>{recentNotification.message}</span>
            </div>
            <button
              onClick={() => setRecentNotification(null)}
              className="text-slate-400 hover:text-slate-700 ml-3 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* PRIMARY ACTION SECTION (Prominent Scan Button) */}
        <section className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-600/15 relative overflow-hidden">
          {/* Subtle background decoration */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-12 top-6 opacity-10 pointer-events-none hidden sm:block">
            <ShieldCheck className="w-44 h-44" />
          </div>

          <div className="relative z-10 max-w-xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-blue-100 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Gemini Vision OCR Enabled</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Identify Potential Medication Interactions
            </h2>
            <p className="text-blue-100 text-sm sm:text-base font-normal leading-relaxed">
              Our initial prototype checks selected medication combinations and highlights potential interaction risks.
            </p>

            {/* Prominent Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Primary: Scan Medicine */}
              <button
                onClick={() => setIsScanOpen(true)}
                className="py-3.5 px-6 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-lg shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
              >
                <Camera className="w-5 h-5 text-blue-600 stroke-[2.2]" />
                <span>AI Scan — Prototype</span>
              </button>

              {/* Secondary: Manual Add */}
              <button
                onClick={() => setIsManualOpen(true)}
                className="py-3.5 px-5 rounded-2xl bg-blue-800/60 hover:bg-blue-800/90 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 border border-white/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Type Manually</span>
              </button>
            </div>
          </div>
        </section>

        {/* PROTOTYPE SCOPE & ROADMAP SECTIONS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Currently Implemented */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Currently Implemented
              </h3>
              <span className="ml-auto text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Round 1
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Manual medicine entry</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Initial interaction database</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>Basic interaction risk checking</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                <span>AI-assisted medicine scanning prototype</span>
              </li>
            </ul>
          </div>

          {/* Next Development Phase */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-blue-100" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Next Development Phase
              </h3>
              <span className="ml-auto text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Roadmap
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <button onClick={() => { window.history.pushState({}, '', '/roadmap/medicine-database'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-left hover:text-blue-700 hover:underline cursor-pointer">Expanded medicine database</button>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <button onClick={() => { window.history.pushState({}, '', '/roadmap/ai-recognition'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-left hover:text-blue-700 hover:underline cursor-pointer">Improved AI medicine recognition</button>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <button onClick={() => { window.history.pushState({}, '', '/roadmap/backend'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-left hover:text-blue-700 hover:underline cursor-pointer">Backend and database integration</button>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <button onClick={() => { window.history.pushState({}, '', '/roadmap/history'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-left hover:text-blue-700 hover:underline cursor-pointer">Personalized medication history</button>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <button onClick={() => { window.history.pushState({}, '', '/roadmap/testing'); window.dispatchEvent(new PopStateEvent('popstate')); }} className="text-left hover:text-blue-700 hover:underline cursor-pointer">More extensive testing and validation</button>
              </li>
            </ul>
          </div>
        </section>

        {/* QUICK TEST CHIPS & PRESETS */}
        <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              Quick Add Presets (1-Click Test)
            </span>
            <button
              onClick={() => setIsGuideOpen(true)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              View Interaction Rules →
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { name: 'Warfarin', color: 'hover:border-rose-300' },
              { name: 'Aspirin', color: 'hover:border-sky-300' },
              { name: 'Ibuprofen', color: 'hover:border-orange-300' },
              { name: 'MAOIs', color: 'hover:border-purple-300' },
              { name: 'SSRIs', color: 'hover:border-indigo-300' },
              { name: 'Metformin', color: 'hover:border-emerald-300' },
              { name: 'Alcohol', color: 'hover:border-amber-300' },
              { name: 'Clozapine', color: 'hover:border-rose-300' },
              { name: 'Carbamazepine', color: 'hover:border-slate-300' },
              { name: 'Lithium', color: 'hover:border-cyan-300' },
              { name: 'Diclofenac', color: 'hover:border-amber-300' },
              { name: 'Digoxin', color: 'hover:border-red-300' },
              { name: 'Amiodarone', color: 'hover:border-blue-300' },
              { name: 'Theophylline', color: 'hover:border-teal-300' },
              { name: 'Ciprofloxacin', color: 'hover:border-indigo-300' },
              { name: 'Methotrexate', color: 'hover:border-rose-300' },
              { name: 'Trimethoprim', color: 'hover:border-yellow-300' },
            ].map((drug) => (
              <button
                key={drug.name}
                onClick={() => handleQuickAddSingle(drug.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer ${drug.color}`}
              >
                <Plus className="w-3 h-3 text-slate-400" />
                <span>{drug.name}</span>
              </button>
            ))}
          </div>

          {/* Quick test pair buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px] text-slate-500 pb-1">
            <span className="font-semibold shrink-0">Test interaction:</span>
            <button
              onClick={() => handleQuickAddPair('Warfarin', 'Aspirin')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Warfarin + Aspirin (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Warfarin', 'Ibuprofen')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Warfarin + Ibuprofen (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('MAOIs', 'SSRIs')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              MAOIs + SSRIs (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Clozapine', 'Carbamazepine')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Clozapine + Carbamazepine (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Lithium', 'Diclofenac')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Lithium + NSAIDs (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Digoxin', 'Amiodarone')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Digoxin + Amiodarone (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Methotrexate', 'Trimethoprim')}
              className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Methotrexate + Trimethoprim (Severe)
            </button>
            <button
              onClick={() => handleQuickAddPair('Metformin', 'Alcohol')}
              className="px-2 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Metformin + Alcohol (Moderate)
            </button>
            <button
              onClick={() => handleQuickAddPair('Aspirin', 'Ibuprofen')}
              className="px-2 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Aspirin + Ibuprofen (Moderate)
            </button>
            <button
              onClick={() => handleQuickAddPair('Theophylline', 'Ciprofloxacin')}
              className="px-2 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 rounded-md border border-slate-200 shrink-0 font-medium cursor-pointer"
            >
              Theophylline + Ciprofloxacin (Moderate)
            </button>
          </div>
        </section>

        {/* TOP OF DASHBOARD: ACTIVE WARNINGS SECTION */}
        {activeWarnings.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Active Drug Interaction Warnings ({activeWarnings.length})
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Sorted by highest clinical risk
              </span>
            </div>

            <div className="space-y-3">
              {activeWarnings.map((warning) => (
                <WarningCard
                  key={warning.id}
                  warning={warning}
                  onRemoveMedicine={handleRemoveMedicine}
                />
              ))}
            </div>
          </section>
        )}

        {/* NO INTERACTIONS FOUND CONFIRMATION STATE */}
        {medicines.length >= 1 && activeWarnings.length === 0 && (
          <section className="p-4 sm:p-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-emerald-900">
                  No interactions detected
                </h4>
                <p className="text-xs text-emerald-700">
                  All {medicines.length} medication{medicines.length > 1 ? 's' : ''} in your current session are clear of known conflicts in the database.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsScanOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Add another</span>
            </button>
          </section>
        )}

        {/* DASHBOARD: ADDED MEDICINES LIST */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                <Pill className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Current Session Medications ({medicines.length})
              </h3>
            </div>

            {medicines.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsScanOpen(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan</span>
                </button>
                <span className="text-slate-300">•</span>
                <button
                  onClick={() => setIsManualOpen(true)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>

          {/* List or Empty State */}
          {medicines.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5">
              {medicines.map((medicine) => (
                <MedicineCard
                  key={medicine.id}
                  medicine={medicine}
                  warnings={activeWarnings}
                  onRemove={handleRemoveMedicine}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Pill className="w-8 h-8 stroke-[1.8]" />
              </div>
              <div className="max-w-sm">
                <h4 className="text-base font-bold text-slate-800">
                  No medications added yet
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Start by scanning a photo of a blister strip or bottle, or enter the drug name manually to check for dangerous drug-drug interactions.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setIsScanOpen(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/15 flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>AI Scan — Prototype</span>
                </button>
                <button
                  onClick={() => setIsManualOpen(true)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Manually</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Clinical Disclaimer Footer */}
        <footer className="pt-6 pb-8 border-t border-slate-200 text-center space-y-1.5">
          <p className="text-xs text-slate-400 font-medium">
            MedGuard is for educational and screening purposes. Always consult a qualified physician or licensed pharmacist regarding medical decisions and prescription drug regimens.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="hover:text-blue-600 cursor-pointer"
            >
              Known Interactions List
            </button>
            <span>•</span>
            <button
              onClick={() => setIsScanOpen(true)}
              className="hover:text-blue-600 cursor-pointer"
            >
              Photo Scanner
            </button>
          </div>
        </footer>
      </main>

      {/* MODALS */}
      <ScanModal
        isOpen={isScanOpen}
        onClose={() => setIsScanOpen(false)}
        onConfirmMedicine={(data) =>
          handleAddMedicine({
            name: data.name,
            dosage: data.dosage,
            brandName: data.brandName,
            photoThumbnail: data.photoThumbnail,
            rawDetectedText: data.rawDetectedText,
            source: 'scan',
          })
        }
      />

      <ManualAddModal
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        onAdd={(data) =>
          handleAddMedicine({
            name: data.name,
            dosage: data.dosage,
            source: 'manual',
          })
        }
      />

      <DatabaseGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onQuickAddPair={handleQuickAddPair}
      />
    </div>
  );
}
