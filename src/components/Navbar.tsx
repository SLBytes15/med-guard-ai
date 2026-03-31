import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/rxsense-logo.png";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "API Docs", href: "/api-docs" },
];

const authNavLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Analyzer", href: "/analyzer" },
  { label: "API Docs", href: "/api-docs" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const links = user ? authNavLinks : navLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="RxSense" className="h-9" />
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link key={l.href} to={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button variant="ghost" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/login">Log in</Link></Button>
              <Button className="gradient-primary border-0" asChild><Link to="/signup">Get Started</Link></Button>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background p-4 space-y-3">
          {links.map((l) => (
            <Link key={l.href} to={l.href} className="block text-sm font-medium text-muted-foreground hover:text-foreground" onClick={() => setMobileOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            {user ? (
              <Button variant="ghost" onClick={handleSignOut} className="flex-1 gap-2"><LogOut className="h-4 w-4" /> Sign out</Button>
            ) : (
              <>
                <Button variant="ghost" asChild className="flex-1"><Link to="/login">Log in</Link></Button>
                <Button className="gradient-primary border-0 flex-1" asChild><Link to="/signup">Get Started</Link></Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
