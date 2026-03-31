import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Key, BarChart3, Search, ArrowRight, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const stats = [
  { label: "API Calls This Month", value: "1,247", icon: Activity, change: "+12%" },
  { label: "Active API Keys", value: "3", icon: Key, change: "" },
  { label: "Interactions Detected", value: "89", icon: Shield, change: "+5%" },
  { label: "Avg Response Time", value: "145ms", icon: Clock, change: "-8%" },
];

const recentChecks = [
  { drugs: "Warfarin + Aspirin", severity: "High" as const, time: "2 min ago" },
  { drugs: "Metformin + Lisinopril", severity: "Low" as const, time: "15 min ago" },
  { drugs: "Simvastatin + Amlodipine", severity: "Moderate" as const, time: "1 hour ago" },
  { drugs: "Omeprazole + Clopidogrel", severity: "High" as const, time: "3 hours ago" },
];

const severityColor = {
  Low: "text-success bg-success/10",
  Moderate: "text-warning bg-warning/10",
  High: "text-destructive bg-destructive/10",
};

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back, Dr. Smith</p>
          </div>
          <Button className="gradient-primary border-0 gap-2" asChild>
            <Link to="/analyzer"><Search className="h-4 w-4" /> New Analysis</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                {s.change && (
                  <span className="text-xs font-medium text-success">{s.change}</span>
                )}
              </div>
              <div className="font-display text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Checks */}
          <div className="rounded-xl border border-border bg-card shadow-card p-6">
            <h2 className="font-display font-semibold mb-4">Recent Checks</h2>
            <div className="space-y-3">
              {recentChecks.map((check, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{check.drugs}</p>
                    <p className="text-xs text-muted-foreground">{check.time}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityColor[check.severity]}`}>
                    {check.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card shadow-card p-6">
            <h2 className="font-display font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: "Check Drug Interactions", href: "/analyzer", icon: Search },
                { label: "Manage API Keys", href: "/dashboard", icon: Key },
                { label: "View Usage Analytics", href: "/dashboard", icon: BarChart3 },
                { label: "API Documentation", href: "/api-docs", icon: Activity },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.href}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
