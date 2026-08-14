"use client";

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  Download,
  RotateCcw,
  Plus,
  Trash2,
  ExternalLink,
  Search,
  Scale,
  DollarSign,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  Compass,
} from "lucide-react";
import SEO from "@/components/SEO";
import {
  DEFAULT_ROBOT_BOM_ITEMS,
  FTC_ROBOT_WEIGHT_LIMIT_LBS,
  SUBSYSTEM_CATEGORIES,
  VENDORS,
  calculateSubsystemWeight,
  calculateTotalWeight,
  convertGramsToLbs,
  convertGramsToOz,
  exportBomToCsv,
  filterBomItems,
  type BomItem,
  type ComponentCategory,
  type SubsystemCategory,
  type Vendor,
} from "@/lib/robotBomData";

export default function RobotBomPage() {
  const [items, setItems] = useState<BomItem[]>(() =>
    DEFAULT_ROBOT_BOM_ITEMS.map((item) => ({ ...item }))
  );
  const [selectedSubsystem, setSelectedSubsystem] = useState<SubsystemCategory | "All">("All");
  const [selectedVendor, setSelectedVendor] = useState<Vendor | "All">("All");
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [unitSystem, setUnitSystem] = useState<"imperial" | "metric">("imperial");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Custom Part Form State
  const [newItemName, setNewItemName] = useState("");
  const [newItemPartNum, setNewItemPartNum] = useState("");
  const [newItemSubsystem, setNewItemSubsystem] = useState<SubsystemCategory>("Chassis & Drivetrain");
  const [newItemVendor, setNewItemVendor] = useState<Vendor>("goBILDA");
  const [newItemCategory, setNewItemCategory] = useState<ComponentCategory>("Mechanical");
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemWeightGrams, setNewItemWeightGrams] = useState(100);
  const [newItemCostUsd, setNewItemCostUsd] = useState(15.0);
  const [newItemDesc, setNewItemDesc] = useState("");

  // Total Calculations
  const totalTally = useMemo(() => calculateTotalWeight(items), [items]);

  // Subsystem Tallies
  const subsystemTallies = useMemo(() => {
    return SUBSYSTEM_CATEGORIES.map((sub) => {
      const tally = calculateSubsystemWeight(items, sub);
      const percentOfTotal =
        totalTally.grams > 0 ? Number(((tally.grams / totalTally.grams) * 100).toFixed(1)) : 0;
      return {
        subsystem: sub,
        ...tally,
        percentOfTotal,
      };
    });
  }, [items, totalTally.grams]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return filterBomItems(items, {
      subsystem: selectedSubsystem,
      vendor: selectedVendor,
      category: selectedCategory,
      searchQuery,
    });
  }, [items, selectedSubsystem, selectedVendor, selectedCategory, searchQuery]);

  // Update item quantity
  const handleQuantityChange = (id: string, newQty: number) => {
    const validQty = Math.max(0, Math.floor(newQty));
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: validQty } : item))
    );
  };

  // Reset to default parts list
  const handleResetToDefault = () => {
    setItems(DEFAULT_ROBOT_BOM_ITEMS.map((item) => ({ ...item })));
  };

  // Trigger CSV Download
  const handleDownloadCsv = () => {
    const csvContent = exportBomToCsv(items);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ares-23247-robot-bom.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Add custom part
  const handleAddCustomPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const newItem: BomItem = {
      id: "custom-" + Date.now(),
      name: newItemName.trim(),
      partNumber: newItemPartNum.trim() || ("CUST-" + Math.floor(1000 + Math.random() * 9000)),
      subsystem: newItemSubsystem,
      vendor: newItemVendor,
      category: newItemCategory,
      quantity: Math.max(1, newItemQty),
      unitWeightGrams: Math.max(0, newItemWeightGrams),
      unitCostUsd: Math.max(0, newItemCostUsd),
      description: newItemDesc.trim() || "Custom engineered component added via live inspector.",
    };

    setItems((prev) => [newItem, ...prev]);
    setIsAddModalOpen(false);

    // Reset modal fields
    setNewItemName("");
    setNewItemPartNum("");
    setNewItemDesc("");
    setNewItemQty(1);
    setNewItemWeightGrams(100);
    setNewItemCostUsd(15.0);
  };

  // Remove custom item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const getSubsystemIcon = (sub: SubsystemCategory) => {
    switch (sub) {
      case "Chassis & Drivetrain":
        return <Compass aria-hidden="true" size={20} className="text-ares-cyan" />;
      case "Horizontal Linear Slides":
        return <Sliders aria-hidden="true" size={20} className="text-ares-gold" />;
      case "Specimen Lift & Claw":
        return <Layers aria-hidden="true" size={20} className="text-ares-red" />;
      case "Intake Roller & Tilt":
        return <Sparkles aria-hidden="true" size={20} className="text-ares-cyan" />;
      case "Electrical & Sensors":
        return <Zap aria-hidden="true" size={20} className="text-ares-gold" />;
      default:
        return <Cpu aria-hidden="true" size={20} className="text-marble" />;
    }
  };

  const getVendorBadgeColor = (vendor: Vendor) => {
    switch (vendor) {
      case "goBILDA":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "REV Robotics":
        return "bg-orange-500/15 text-orange-300 border-orange-500/30";
      case "AndyMark":
        return "bg-red-500/15 text-red-300 border-red-500/30";
      case "SendCutSend":
        return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
      case "McMaster-Carr":
        return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-white/10 text-marble border-white/20";
    }
  };

  return (
    <main className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO
        title="Robot Bill of Materials & Subsystem Inspector"
        description="Interactive Bill of Materials (BOM), subsystem weight analysis, and hardware component catalog for ARES 23247 FIRST® Tech Challenge robots."
      />

      <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-16">
        {/* Back Link */}
        <Link
          to="/robots"
          className="inline-flex items-center gap-2 text-marble/70 hover:text-ares-gold transition-colors mb-8 font-black uppercase tracking-[0.2em] text-xs focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <ChevronLeft aria-hidden="true" size={14} /> Back to Fleet
        </Link>

        {/* Header Block */}
        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="inline-block bg-ares-red text-white px-3.5 py-1.5 ares-cut-sm text-xs font-black uppercase tracking-[0.2em] mb-4 border border-ares-bronze">
            ARES 23247 Hardware Engineering
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase font-heading text-white">
                Subsystem BOM & Weight Inspector
              </h1>
              <p className="text-marble/75 max-w-3xl font-medium mt-3 text-base leading-relaxed">
                Comprehensive component breakdown, real-time subsystem weight distribution, and legal
                FTC 42.0 lb robot weight limit validation for competition hardware.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-wider py-3 px-5 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
              >
                <Plus aria-hidden="true" size={16} /> Add Custom Part
              </button>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="clipped-button bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black border border-ares-gold/40 font-black text-xs uppercase tracking-wider py-3 px-5 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
              >
                <Download aria-hidden="true" size={16} /> Export BOM (CSV)
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="border border-white/20 text-marble hover:text-white hover:bg-white/5 font-bold text-xs uppercase tracking-wider py-3 px-4 ares-cut-sm inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
                title="Reset BOM quantities to default competition specs"
              >
                <RotateCcw aria-hidden="true" size={14} /> Reset Specs
              </button>
            </div>
          </div>
        </header>

        {/* Robot Weight Limit Validation Gauge & Key Stats */}
        <section
          aria-labelledby="weight-gauge-heading"
          className="glass-card hero-card ares-cut-lg border border-white/15 p-6 md:p-8 mb-12 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-ares-cyan/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-ares-cyan block mb-1 font-heading">
                Inspection Compliance Gauge
              </span>
              <h2
                id="weight-gauge-heading"
                className="text-2xl md:text-3xl font-black uppercase text-white tracking-tight font-heading flex items-center gap-3"
              >
                <Scale aria-hidden="true" size={28} className="text-ares-gold" />
                FTC Legal Weight Limit Status
              </h2>
            </div>

            {/* Unit Toggle */}
            <div className="flex items-center gap-2 bg-black/40 p-1.5 ares-cut-sm border border-white/10 self-start md:self-auto">
              <span className="text-xs font-bold text-marble/60 px-2 uppercase font-heading">Units:</span>
              <button
                type="button"
                onClick={() => setUnitSystem("imperial")}
                className={"px-3 py-1 text-xs font-black uppercase ares-cut-sm transition-all " + (unitSystem === "imperial" ? "bg-ares-red text-white shadow" : "text-marble/70 hover:text-white")}
              >
                Imperial (lbs / oz)
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem("metric")}
                className={"px-3 py-1 text-xs font-black uppercase ares-cut-sm transition-all " + (unitSystem === "metric" ? "bg-ares-red text-white shadow" : "text-marble/70 hover:text-white")}
              >
                Metric (kg / g)
              </button>
            </div>
          </div>

          {/* Large Gauge Metric Display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 relative z-10">
            {/* Total Weight Metric */}
            <div className="bg-white/5 border border-white/10 p-5 ares-cut-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block mb-1">
                Total Robot Mass
              </span>
              <div className="text-3xl font-black text-white font-heading">
                {unitSystem === "imperial" ? (
                  <>
                    <span>{totalTally.lbs.toFixed(2)}</span>
                    <span className="text-base font-normal text-ares-gold ml-1.5">lbs</span>
                    <span className="text-xs text-marble/50 block font-normal mt-0.5">
                      {"(" + totalTally.oz.toFixed(1) + " oz)"}
                    </span>
                  </>
                ) : (
                  <>
                    <span>{(totalTally.grams / 1000).toFixed(2)}</span>
                    <span className="text-base font-normal text-ares-gold ml-1.5">kg</span>
                    <span className="text-xs text-marble/50 block font-normal mt-0.5">
                      {"(" + totalTally.grams.toLocaleString() + " g)"}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* FTC Weight Limit */}
            <div className="bg-white/5 border border-white/10 p-5 ares-cut-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block mb-1">
                Legal Maximum Limit
              </span>
              <div className="text-3xl font-black text-white font-heading">
                {unitSystem === "imperial" ? (
                  <>
                    <span>{FTC_ROBOT_WEIGHT_LIMIT_LBS.toFixed(1)}</span>
                    <span className="text-base font-normal text-ares-cyan ml-1.5">lbs</span>
                    <span className="text-xs text-marble/50 block font-normal mt-0.5">
                      (672.0 oz max)
                    </span>
                  </>
                ) : (
                  <>
                    <span>{(FTC_ROBOT_WEIGHT_LIMIT_LBS * 0.453592).toFixed(2)}</span>
                    <span className="text-base font-normal text-ares-cyan ml-1.5">kg</span>
                    <span className="text-xs text-marble/50 block font-normal mt-0.5">
                      (19,050.9 g max)
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Inspection Margin */}
            <div className="bg-white/5 border border-white/10 p-5 ares-cut-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block mb-1">
                Inspection Margin
              </span>
              <div
                className={"text-3xl font-black font-heading " + (totalTally.isLegal ? "text-emerald-400" : "text-red-400")}
              >
                {totalTally.isLegal ? (
                  <>
                    <span>+{totalTally.marginLbs.toFixed(2)}</span>
                    <span className="text-base font-normal text-marble ml-1.5">lbs</span>
                    <span className="text-xs text-emerald-400/70 block font-normal mt-0.5">
                      Legal Headroom
                    </span>
                  </>
                ) : (
                  <>
                    <span>-{Math.abs(totalTally.marginLbs).toFixed(2)}</span>
                    <span className="text-base font-normal text-red-300 ml-1.5">lbs</span>
                    <span className="text-xs text-red-400 block font-bold mt-0.5">
                      Over Legal Limit!
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Total BOM Hardware Cost */}
            <div className="bg-white/5 border border-white/10 p-5 ares-cut-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-marble/50 block mb-1">
                Hardware BOM Cost
              </span>
              <div className="text-3xl font-black text-white font-heading flex items-baseline">
                <DollarSign aria-hidden="true" size={20} className="text-ares-gold" />
                <span>{totalTally.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <span className="text-xs text-marble/50 block font-normal mt-0.5">
                {totalTally.totalParts + " total itemized components"}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar Gauge */}
          <div className="relative z-10">
            <div className="flex justify-between items-center text-xs font-bold uppercase mb-2 font-heading">
              <span className="text-marble/70">
                Robot Capacity: <strong className="text-white">{totalTally.percentOfLimit + "%"}</strong> of 42.0 lb maximum
              </span>
              <span
                className={"inline-flex items-center gap-1.5 px-3 py-1 ares-cut-sm text-xs font-black uppercase " + (
                  totalTally.isLegal
                    ? totalTally.lbs > 38.0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-red-500/20 text-red-300 border border-red-500/40"
                )}
              >
                {totalTally.isLegal ? (
                  totalTally.lbs > 38.0 ? (
                    <>
                      <AlertTriangle aria-hidden="true" size={14} /> Near Limit Warning
                    </>
                  ) : (
                    <>
                      <CheckCircle2 aria-hidden="true" size={14} /> FTC Inspection Pass
                    </>
                  )
                ) : (
                  <>
                    <AlertTriangle aria-hidden="true" size={14} /> FTC Weight Violation
                  </>
                )}
              </span>
            </div>

            {/* Gauge Track */}
            <div
              role="progressbar"
              aria-label="Robot Weight Compliance Gauge"
              aria-valuenow={totalTally.lbs}
              aria-valuemin={0}
              aria-valuemax={FTC_ROBOT_WEIGHT_LIMIT_LBS}
              aria-valuetext={totalTally.lbs.toFixed(2) + " pounds out of 42.0 pounds maximum (" + totalTally.percentOfLimit + "%)"}
              className="w-full h-4 bg-black/60 ares-cut-sm border border-white/10 overflow-hidden relative"
            >
              <div
                style={{ width: Math.min(100, totalTally.percentOfLimit) + "%" }}
                className={"h-full transition-all duration-300 " + (
                  !totalTally.isLegal
                    ? "bg-red-500"
                    : totalTally.lbs > 38.0
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-ares-cyan via-ares-gold to-emerald-400"
                )}
              />
            </div>

            <div className="flex justify-between text-[10px] text-marble/50 uppercase font-mono mt-2">
              <span>0.0 lbs</span>
              <span>10.0 lbs</span>
              <span>20.0 lbs</span>
              <span>30.0 lbs</span>
              <span className="text-ares-gold font-bold">42.0 lbs Limit</span>
            </div>
          </div>
        </section>

        {/* Subsystem Weight Distribution Cards */}
        <section aria-labelledby="subsystems-heading" className="mb-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2
              id="subsystems-heading"
              className="text-2xl font-black uppercase text-white tracking-tight font-heading flex items-center gap-2"
            >
              <Boxes aria-hidden="true" size={24} className="text-ares-red" />
              Subsystem Breakdown
            </h2>
            <span className="text-xs text-marble/60 font-bold uppercase">
              Click a subsystem to isolate parts
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {subsystemTallies.map((sub) => {
              const isSelected = selectedSubsystem === sub.subsystem;
              return (
                <button
                  key={sub.subsystem}
                  type="button"
                  onClick={() =>
                    setSelectedSubsystem((prev) => (prev === sub.subsystem ? "All" : sub.subsystem))
                  }
                  className={"text-left p-5 ares-cut-sm border transition-all duration-200 flex flex-col justify-between " + (
                    isSelected
                      ? "bg-ares-red/15 border-ares-red shadow-lg shadow-ares-red/10 scale-[1.02]"
                      : "bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/[0.08]"
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="p-2 bg-black/40 ares-cut-sm border border-white/10">
                        {getSubsystemIcon(sub.subsystem)}
                      </div>
                      <span className="text-xs font-black text-ares-gold font-mono">
                        {sub.percentOfTotal + "% mass"}
                      </span>
                    </div>
                    <h3 className="text-sm font-black uppercase text-white font-heading leading-snug mb-3">
                      {sub.subsystem}
                    </h3>
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                    <div className="flex justify-between font-mono">
                      <span className="text-marble/60">Mass:</span>
                      <span className="font-bold text-white">
                        {unitSystem === "imperial"
                          ? sub.lbs.toFixed(2) + " lbs (" + sub.oz.toFixed(1) + " oz)"
                          : (sub.grams / 1000).toFixed(2) + " kg (" + sub.grams + " g)"}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-marble/60">Parts:</span>
                      <span className="text-marble/90">{sub.itemCount + " units"}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span className="text-marble/60">Cost:</span>
                      <span className="text-ares-gold font-bold">{"$" + sub.cost.toFixed(2)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Filter Controls Bar */}
        <section
          aria-label="Component Filters and Search"
          className="bg-black/40 border border-white/10 ares-cut-lg p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div>
              <label htmlFor="bom-search" className="text-xs font-black uppercase tracking-wider text-marble/60 block mb-2 font-heading">
                Search Catalog
              </label>
              <div className="relative">
                <Search aria-hidden="true" size={16} className="absolute left-3.5 top-3.5 text-marble/40" />
                <input
                  id="bom-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter part, number, description..."
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-marble/30 focus:border-ares-cyan focus:outline-none"
                />
              </div>
            </div>

            {/* Subsystem Dropdown */}
            <div>
              <label htmlFor="subsystem-filter" className="text-xs font-black uppercase tracking-wider text-marble/60 block mb-2 font-heading">
                Subsystem
              </label>
              <select
                id="subsystem-filter"
                value={selectedSubsystem}
                onChange={(e) => setSelectedSubsystem(e.target.value as SubsystemCategory | "All")}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3 py-2.5 text-xs text-white font-bold focus:border-ares-cyan focus:outline-none cursor-pointer"
              >
                <option value="All">All Subsystems</option>
                {SUBSYSTEM_CATEGORIES.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor Dropdown */}
            <div>
              <label htmlFor="vendor-filter" className="text-xs font-black uppercase tracking-wider text-marble/60 block mb-2 font-heading">
                Vendor / Fabricator
              </label>
              <select
                id="vendor-filter"
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value as Vendor | "All")}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3 py-2.5 text-xs text-white font-bold focus:border-ares-cyan focus:outline-none cursor-pointer"
              >
                <option value="All">All Vendors</option>
                {VENDORS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Dropdown */}
            <div>
              <label htmlFor="category-filter" className="text-xs font-black uppercase tracking-wider text-marble/60 block mb-2 font-heading">
                Component Class
              </label>
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as ComponentCategory | "All")}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3 py-2.5 text-xs text-white font-bold focus:border-ares-cyan focus:outline-none cursor-pointer"
              >
                <option value="All">All Classes</option>
                <option value="Actuator">Actuators & Motors</option>
                <option value="Mechanical">Mechanical & Drivetrain</option>
                <option value="Hardware">Hardware & Fasteners</option>
                <option value="Electrical">Electrical & Power</option>
                <option value="Sensor">Sensors & Feedback</option>
                <option value="Raw Material">Raw Material & CNC Stock</option>
              </select>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {(selectedSubsystem !== "All" ||
            selectedVendor !== "All" ||
            selectedCategory !== "All" ||
            searchQuery.trim() !== "") && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/10 text-xs">
              <span className="text-marble/50 font-bold uppercase">Active Filters:</span>
              {selectedSubsystem !== "All" && (
                <span className="bg-ares-red/20 text-ares-red border border-ares-red/30 px-2.5 py-0.5 ares-cut-sm font-bold">
                  {"Subsystem: " + selectedSubsystem}
                </span>
              )}
              {selectedVendor !== "All" && (
                <span className="bg-ares-cyan/20 text-ares-cyan border border-ares-cyan/30 px-2.5 py-0.5 ares-cut-sm font-bold">
                  {"Vendor: " + selectedVendor}
                </span>
              )}
              {selectedCategory !== "All" && (
                <span className="bg-ares-gold/20 text-ares-gold border border-ares-gold/30 px-2.5 py-0.5 ares-cut-sm font-bold">
                  {"Class: " + selectedCategory}
                </span>
              )}
              {searchQuery.trim() !== "" && (
                <span className="bg-white/10 text-white border border-white/20 px-2.5 py-0.5 ares-cut-sm font-bold">
                  {`Query: "${searchQuery}"`}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedSubsystem("All");
                  setSelectedVendor("All");
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
                className="text-ares-gold hover:underline font-bold uppercase ml-2"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </section>

        {/* Itemized Parts Table */}
        <section aria-labelledby="parts-table-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="parts-table-heading"
              className="text-2xl font-black uppercase text-white tracking-tight font-heading"
            >
              Itemized Parts Catalog ({filteredItems.length})
            </h2>
            <span className="text-xs text-marble/60 font-mono">
              {"Showing " + filteredItems.length + " of " + items.length + " hardware entries"}
            </span>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center p-16 glass-card ares-cut border border-white/10 text-marble/70">
              <Boxes aria-hidden="true" size={48} className="mx-auto mb-4 opacity-40 text-ares-gold" />
              <h3 className="text-lg font-bold uppercase text-white tracking-wider">No matching hardware components</h3>
              <p className="text-sm mt-1 text-marble/60">Try clearing or relaxing your filter parameters.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubsystem("All");
                  setSelectedVendor("All");
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
                className="mt-4 clipped-button bg-ares-red text-white text-xs uppercase"
              >
                Reset Catalog Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/10 ares-cut-lg shadow-xl bg-obsidian">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-black/60 border-b border-white/10 text-marble/70 font-black uppercase tracking-wider font-heading">
                    <th scope="col" className="py-4 px-4">Component &amp; Specs</th>
                    <th scope="col" className="py-4 px-3">Subsystem</th>
                    <th scope="col" className="py-4 px-3">Vendor / PN</th>
                    <th scope="col" className="py-4 px-3 text-center">Unit Mass</th>
                    <th scope="col" className="py-4 px-3 text-center">Quantity</th>
                    <th scope="col" className="py-4 px-3 text-right">Subtotal Mass</th>
                    <th scope="col" className="py-4 px-3 text-right">Unit Price</th>
                    <th scope="col" className="py-4 px-4 text-right">Total Price</th>
                    <th scope="col" className="py-4 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredItems.map((item) => {
                    const itemTotalGrams = item.unitWeightGrams * item.quantity;
                    const itemTotalLbs = convertGramsToLbs(itemTotalGrams);
                    const itemTotalCost = item.unitCostUsd * item.quantity;
                    const isCustom = item.id.startsWith("custom-");

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-white/[0.03] transition-colors group"
                      >
                        {/* Component Name & Description */}
                        <td className="py-4 px-4 max-w-sm">
                          <div className="font-bold text-white text-sm group-hover:text-ares-gold transition-colors">
                            {item.name}
                          </div>
                          <p className="text-marble/60 text-[11px] mt-0.5 line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {item.specUrl && (
                              <a
                                href={item.specUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-ares-cyan hover:underline font-bold"
                              >
                                Spec Sheet <ExternalLink aria-hidden="true" size={10} />
                              </a>
                            )}
                            {item.cadModelAvailable && (
                              <span className="text-[10px] bg-ares-gold/15 text-ares-gold px-1.5 py-0.5 ares-cut-sm font-bold">
                                3D CAD
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Subsystem */}
                        <td className="py-4 px-3 font-medium text-marble/80 whitespace-nowrap">
                          <span className="bg-white/5 border border-white/10 px-2 py-1 ares-cut-sm text-[11px] block">
                            {item.subsystem}
                          </span>
                        </td>

                        {/* Vendor & Part Number */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <span
                            className={"inline-block px-2 py-0.5 text-[10px] font-black uppercase ares-cut-sm border mb-1 " + getVendorBadgeColor(item.vendor)}
                          >
                            {item.vendor}
                          </span>
                          <span className="text-[11px] font-mono text-marble/50 block">
                            {item.partNumber}
                          </span>
                        </td>

                        {/* Unit Weight */}
                        <td className="py-4 px-3 text-center whitespace-nowrap font-mono text-marble/80">
                          {unitSystem === "imperial" ? (
                            <>
                              <div>{convertGramsToLbs(item.unitWeightGrams)} lbs</div>
                              <div className="text-[10px] text-marble/40">
                                {"(" + convertGramsToOz(item.unitWeightGrams) + " oz)"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div>{item.unitWeightGrams} g</div>
                              <div className="text-[10px] text-marble/40">
                                {"(" + (item.unitWeightGrams / 1000).toFixed(3) + " kg)"}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Interactive Quantity Control */}
                        <td className="py-4 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 bg-black/50 border border-white/15 p-1 ares-cut-sm">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              aria-label={"Decrease quantity of " + item.name}
                              className="w-6 h-6 flex items-center justify-center text-marble/70 hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black transition-colors"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              max={999}
                              value={item.quantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, parseInt(e.target.value, 10) || 0)
                              }
                              aria-label={"Quantity for " + item.name}
                              className="w-10 bg-transparent text-center font-mono font-bold text-white text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              aria-label={"Increase quantity of " + item.name}
                              className="w-6 h-6 flex items-center justify-center text-marble/70 hover:text-white hover:bg-white/10 ares-cut-sm text-xs font-black transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        {/* Subtotal Weight */}
                        <td className="py-4 px-3 text-right whitespace-nowrap font-mono font-bold text-white">
                          {unitSystem === "imperial" ? (
                            <>
                              <div>{itemTotalLbs.toFixed(2)} lbs</div>
                              <div className="text-[10px] text-marble/40 font-normal">
                                {"(" + convertGramsToOz(itemTotalGrams).toFixed(1) + " oz)"}
                              </div>
                            </>
                          ) : (
                            <>
                              <div>{(itemTotalGrams / 1000).toFixed(2)} kg</div>
                              <div className="text-[10px] text-marble/40 font-normal">
                                {"(" + itemTotalGrams + " g)"}
                              </div>
                            </>
                          )}
                        </td>

                        {/* Unit Price */}
                        <td className="py-4 px-3 text-right whitespace-nowrap font-mono text-marble/70">
                          {"$" + item.unitCostUsd.toFixed(2)}
                        </td>

                        {/* Total Price */}
                        <td className="py-4 px-4 text-right whitespace-nowrap font-mono font-bold text-ares-gold">
                          {"$" + itemTotalCost.toFixed(2)}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-3 text-center whitespace-nowrap">
                          {isCustom && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              aria-label={"Delete custom component " + item.name}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 ares-cut-sm transition-colors"
                              title="Remove custom component"
                            >
                              <Trash2 aria-hidden="true" size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Custom Part Modal */}
        {isAddModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-modal-title"
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <div className="bg-obsidian border border-white/20 ares-cut-lg max-w-xl w-full p-6 md:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h3 id="add-modal-title" className="text-xl font-black uppercase text-white font-heading">
                  Add Custom Component to BOM
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-marble/50 hover:text-white text-xl font-bold p-1 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddCustomPart} className="space-y-4 text-xs">
                <div>
                  <label htmlFor="custom-part-name" className="block text-marble/70 font-bold uppercase mb-1">
                    Component Name *
                  </label>
                  <input
                    id="custom-part-name"
                    type="text"
                    required
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="e.g. Counterweight Steel Ballast Plate"
                    className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white focus:border-ares-cyan focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="custom-part-num" className="block text-marble/70 font-bold uppercase mb-1">
                      Part Number
                    </label>
                    <input
                      id="custom-part-num"
                      type="text"
                      value={newItemPartNum}
                      onChange={(e) => setNewItemPartNum(e.target.value)}
                      placeholder="e.g. CUST-BLST-01"
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white focus:border-ares-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-subsystem" className="block text-marble/70 font-bold uppercase mb-1">
                      Subsystem *
                    </label>
                    <select
                      id="custom-subsystem"
                      value={newItemSubsystem}
                      onChange={(e) => setNewItemSubsystem(e.target.value as SubsystemCategory)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white font-bold focus:border-ares-cyan focus:outline-none"
                    >
                      {SUBSYSTEM_CATEGORIES.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="custom-vendor" className="block text-marble/70 font-bold uppercase mb-1">
                      Vendor / Fabricator *
                    </label>
                    <select
                      id="custom-vendor"
                      value={newItemVendor}
                      onChange={(e) => setNewItemVendor(e.target.value as Vendor)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white font-bold focus:border-ares-cyan focus:outline-none"
                    >
                      {VENDORS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="custom-category" className="block text-marble/70 font-bold uppercase mb-1">
                      Component Class *
                    </label>
                    <select
                      id="custom-category"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value as ComponentCategory)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white font-bold focus:border-ares-cyan focus:outline-none"
                    >
                      <option value="Actuator">Actuator</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Hardware">Hardware</option>
                      <option value="Electrical">Electrical</option>
                      <option value="Sensor">Sensor</option>
                      <option value="Raw Material">Raw Material</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="custom-qty" className="block text-marble/70 font-bold uppercase mb-1">
                      Quantity *
                    </label>
                    <input
                      id="custom-qty"
                      type="number"
                      min={1}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white focus:border-ares-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-weight" className="block text-marble/70 font-bold uppercase mb-1">
                      Unit Mass (g) *
                    </label>
                    <input
                      id="custom-weight"
                      type="number"
                      min={0}
                      step={0.1}
                      value={newItemWeightGrams}
                      onChange={(e) => setNewItemWeightGrams(parseFloat(e.target.value) || 0)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white focus:border-ares-cyan focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="custom-cost" className="block text-marble/70 font-bold uppercase mb-1">
                      Unit Cost ($) *
                    </label>
                    <input
                      id="custom-cost"
                      type="number"
                      min={0}
                      step={0.01}
                      value={newItemCostUsd}
                      onChange={(e) => setNewItemCostUsd(parseFloat(e.target.value) || 0)}
                      className="w-full bg-black/50 border border-white/15 ares-cut-sm px-3 py-2.5 text-white focus:border-ares-cyan focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="custom-desc" className="block text-marble/70 font-bold uppercase mb-1">
                    Description &amp; Function
                  </label>
                  <textarea
                    id="custom-desc"
                    rows={2}
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="Short summary of this component role on the robot..."
                    className="w-full bg-black/50 border border-white/15 ares-cut-sm p-3 text-white focus:border-ares-cyan focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="border border-white/20 text-marble hover:text-white px-4 py-2.5 ares-cut-sm font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="clipped-button bg-ares-red text-white hover:bg-ares-bronze px-5 py-2.5 font-black uppercase tracking-wider"
                  >
                    Add to BOM
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
