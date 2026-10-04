'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Box, LayoutDashboard, History, LogIn, LogOut, Menu, X, User, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { path: "/", label: "หน้าแรก", icon: Box },
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/history", label: "ประวัติ", icon: History },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut, loading } = useAuth();
  const { isAdmin } = useAdmin(user?.id);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const displayName = profile?.username || profile?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = profile?.avatar_url;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/45 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] relative overflow-hidden transition-colors">
      {/* Ambient warm-light glow overlay behind the navbar */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-amber-500/[0.06] via-amber-500/[0.02] to-transparent pointer-events-none" />
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-20 bg-amber-400/20 blur-2xl rounded-full pointer-events-none -z-10" />

      <nav className="container mx-auto px-4 h-16 flex items-center justify-between relative z-10">
        {/* Brand Logo - Minimal Luxury Editorial */}
        <Link href="/" className="flex items-center group">
          <span className="font-brand font-semibold text-lg sm:text-xl tracking-tight text-zinc-800 uppercase select-none transition-opacity hover:opacity-80">
            LOSTRETURN
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "relative gap-2 font-medium text-xs sm:text-sm",
                    isActive ? "bg-white/80 text-zinc-800 border border-white/80 shadow-sm font-semibold" : "text-zinc-600 hover:text-zinc-800 hover:bg-white/50"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-amber-600" : "text-zinc-500")} />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                    />
                  )}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Auth Section */}
        <div className="hidden md:block">
          {loading ? (
            <div className="w-8 h-8 rounded-full bg-zinc-200 animate-pulse" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2.5 rounded-full border border-white/60 bg-white/70 hover:bg-white hover:border-amber-400 shadow-sm">
                  <Avatar className="w-7 h-7 border border-amber-300">
                    <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                    <AvatarFallback className="bg-gradient-to-br from-amber-400 to-yellow-500 text-zinc-900 font-semibold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-zinc-800 max-w-[120px] truncate">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 backdrop-blur-2xl bg-white/95 border border-zinc-200 text-zinc-800 shadow-xl rounded-2xl p-1.5">
                <DropdownMenuItem onClick={() => router.push('/profile')} className="rounded-xl cursor-pointer hover:bg-zinc-100 focus:bg-zinc-100 text-xs font-medium">
                  <User className="w-4 h-4 mr-2 text-amber-600" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/my-posts')} className="rounded-xl cursor-pointer hover:bg-zinc-100 focus:bg-zinc-100 text-xs font-medium">
                  <Box className="w-4 h-4 mr-2 text-amber-600" />
                  My Posts
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-zinc-200 my-1" />
                    <DropdownMenuItem onClick={() => router.push('/admin')} className="rounded-xl cursor-pointer hover:bg-zinc-100 focus:bg-zinc-100 text-amber-700 text-xs font-semibold">
                      <ShieldCheck className="w-4 h-4 mr-2 text-amber-600" />
                      Admin Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-zinc-200 my-1" />
                <DropdownMenuItem onClick={handleSignOut} className="rounded-xl cursor-pointer text-rose-600 hover:bg-rose-50 focus:bg-rose-50 text-xs font-medium">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <button className="flex items-center gap-1.5 px-3.5 py-2 bg-transparent hover:bg-white/50 text-zinc-900 hover:text-amber-500 rounded-xl font-semibold text-xs sm:text-sm transition-all duration-200 cursor-pointer group">
                <LogIn className="w-4 h-4 stroke-[2.2] text-zinc-900 group-hover:text-amber-500 transition-colors" />
                <span className="text-zinc-900 group-hover:text-amber-500 transition-colors">Sign In</span>
              </button>
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-zinc-700 hover:bg-white/50 rounded-xl"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </nav>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={isMobileMenuOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        className="md:hidden overflow-hidden border-b border-white/40 bg-white/95 backdrop-blur-2xl"
      >
        <div className="container mx-auto px-4 py-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2.5 rounded-xl font-medium",
                    isActive ? "bg-white/80 text-zinc-800 border border-zinc-200 shadow-sm" : "text-zinc-600 hover:bg-white/50"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-amber-600" : "text-zinc-500")} />
                  {item.label}
                </Button>
              </Link>
            );
          })}
          {user ? (
            <>
              <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2.5 rounded-xl text-zinc-800 hover:bg-white/50 font-medium">
                  <User className="w-4 h-4 text-amber-600" />
                  Profile
                </Button>
              </Link>
              <Link href="/my-posts" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2.5 rounded-xl text-zinc-800 hover:bg-white/50 font-medium">
                  <Box className="w-4 h-4 text-amber-600" />
                  My Posts
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2.5 rounded-xl text-amber-700 font-semibold hover:bg-white/50">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    Admin Dashboard
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2.5 text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl font-medium"
                onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </>
          ) : (
            <Link href="/auth" onClick={() => setIsMobileMenuOpen(false)}>
              <button className="w-full flex items-center justify-start gap-2.5 px-3.5 py-2.5 bg-transparent hover:bg-white/50 text-zinc-900 hover:text-amber-500 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer group">
                <LogIn className="w-4 h-4 stroke-[2.2] text-zinc-900 group-hover:text-amber-500 transition-colors" />
                <span className="text-zinc-900 group-hover:text-amber-500 transition-colors">Sign In</span>
              </button>
            </Link>
          )}
        </div>
      </motion.div>
    </header>
  );
}