import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Key, BarChart3, Search, ArrowRight, Shield, Clock, Plus, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ApiKey {
  id: string;
  key: string;
  label: string | null;
  usage_count: number;
  usage_limit: number;
  is_active: boolean;
  created_at: string;
}

interface ApiLog {
  id: string;
  endpoint: string;
  method: string;
  status_code: number | null;
  response_time_ms: number | null;
  created_at: string;
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [showKeyForm, setShowKeyForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    fetchApiKeys();
    fetchLogs();
  }, [user]);

  const fetchApiKeys = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    if (data) setApiKeys(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase.from("api_logs").select("*").order("created_at", { ascending: false }).limit(10);
    if (data) setLogs(data);
  };

  const generateApiKey = async () => {
    if (!user) return;
    const key = "rxs_" + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("api_keys").insert({ user_id: user.id, key, label: newKeyLabel || "Untitled" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "API Key Created", description: "Your new API key is ready to use." });
      setNewKeyLabel("");
      setShowKeyForm(false);
      fetchApiKeys();
    }
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("api_keys").delete().eq("id", id);
    fetchApiKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied!", description: "API key copied to clipboard." });
  };

  if (authLoading || !user) return null;

  const totalUsage = apiKeys.reduce((sum, k) => sum + k.usage_count, 0);

  const stats = [
    { label: "Total API Calls", value: totalUsage.toLocaleString(), icon: Activity },
    { label: "Active API Keys", value: apiKeys.filter((k) => k.is_active).length.toString(), icon: Key },
    { label: "Recent Checks", value: logs.length.toString(), icon: Shield },
    { label: "Avg Response", value: logs.length ? Math.round(logs.reduce((s, l) => s + (l.response_time_ms || 0), 0) / logs.length) + "ms" : "—", icon: Clock },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 container py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Welcome back</p>
          </div>
          <Button className="gradient-primary border-0 gap-2" asChild>
            <Link to="/analyzer"><Search className="h-4 w-4" /> New Analysis</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="font-display text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* API Keys */}
          <div className="rounded-xl border border-border bg-card shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold">API Keys</h2>
              <Button variant="outline" size="sm" onClick={() => setShowKeyForm(!showKeyForm)} className="gap-1">
                <Plus className="h-3 w-3" /> New Key
              </Button>
            </div>
            {showKeyForm && (
              <div className="flex gap-2 mb-4">
                <Input placeholder="Key label (e.g. Production)" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} className="flex-1" />
                <Button onClick={generateApiKey} className="gradient-primary border-0">Generate</Button>
              </div>
            )}
            {apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{k.label}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{k.key.slice(0, 20)}...</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button onClick={() => copyKey(k.key)} className="p-1.5 text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteApiKey(k.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border bg-card shadow-card p-6">
            <h2 className="font-display font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { label: "Check Drug Interactions", href: "/analyzer", icon: Search },
                { label: "API Documentation", href: "/api-docs", icon: Activity },
                { label: "View Pricing Plans", href: "/pricing", icon: BarChart3 },
              ].map((action) => (
                <Link key={action.label} to={action.href} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group">
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
