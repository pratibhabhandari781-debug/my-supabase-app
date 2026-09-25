"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface TodoItem {
  id: string;
  title: string;
  is_completed: boolean;
  priority?: "High" | "Medium" | "Low";
  created_at?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"landing" | "auth" | "dashboard">(
    "landing"
  );

  // Auth State
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Todo / Database State
  const [todos, setTodos] = useState<TodoItem[]>([
    {
      id: "demo-1",
      title: "Set up Supabase project and database connection",
      is_completed: true,
      priority: "High",
    },
    {
      id: "demo-2",
      title: "Deploy frontend application to Vercel edge",
      is_completed: true,
      priority: "High",
    },
    {
      id: "demo-3",
      title: "Test GitHub OAuth and Email authentication",
      is_completed: false,
      priority: "Medium",
    },
  ]);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<
    "High" | "Medium" | "Low"
  >("Medium");
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // Check Supabase session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    fetchTodos();

    return () => subscription.unsubscribe();
  }, []);

  // Fetch todos from Supabase table
  const fetchTodos = async () => {
    try {
      setDbLoading(true);
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // If table doesn't exist yet, we keep the demo todos and show the setup helper
        console.warn("Supabase fetch note:", error.message);
        setDbError(error.message);
      } else if (data && data.length > 0) {
        setTodos(data);
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message);
    } finally {
      setDbLoading(false);
    }
  };

  // Add Todo
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    const optimisticTodo: TodoItem = {
      id: "temp-" + Date.now(),
      title: newTodoTitle.trim(),
      is_completed: false,
      priority: newTodoPriority,
    };

    setTodos((prev) => [optimisticTodo, ...prev]);
    setNewTodoTitle("");

    try {
      const { data, error } = await supabase
        .from("todos")
        .insert([
          {
            title: optimisticTodo.title,
            is_completed: false,
          },
        ])
        .select();

      if (error) {
        setDbError(error.message);
      } else if (data && data[0]) {
        setTodos((prev) =>
          prev.map((t) => (t.id === optimisticTodo.id ? data[0] : t))
        );
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message);
    }
  };

  // Toggle Todo completion
  const handleToggleTodo = async (todo: TodoItem) => {
    const updatedStatus = !todo.is_completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, is_completed: updatedStatus } : t
      )
    );

    if (!todo.id.startsWith("demo-") && !todo.id.startsWith("temp-")) {
      try {
        await supabase
          .from("todos")
          .update({ is_completed: updatedStatus })
          .eq("id", todo.id);
      } catch (err: any) {
        console.error("Toggle error:", err);
      }
    }
  };

  // Delete Todo
  const handleDeleteTodo = async (id: string) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));

    if (!id.startsWith("demo-") && !id.startsWith("temp-")) {
      try {
        await supabase.from("todos").delete().eq("id", id);
      } catch (err: any) {
        console.error("Delete error:", err);
      }
    }
  };

  // Email Auth
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMessage({
          type: "success",
          text: "Registration successful! Check your email to confirm your account.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAuthMessage({
          type: "success",
          text: "Successfully signed in! Welcome back.",
        });
      }
    } catch (err: any) {
      setAuthMessage({ type: "error", text: err.message });
    } finally {
      setAuthLoading(false);
    }
  };

  // GitHub OAuth Login
  const handleGitHubLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthMessage({ type: "error", text: err.message });
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthMessage({ type: "success", text: "You have signed out." });
  };

  const copySqlSnippet = () => {
    const sql = `CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to todos" 
  ON todos FOR ALL 
  USING (true) 
  WITH CHECK (true);`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Navigation Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-zinc-950 shadow-lg shadow-emerald-500/20">
              ⚡
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-2">
                Supafast
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                Project: psvovfskhqthdhcrwaqy
              </span>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setActiveTab("landing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "landing"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Landing
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Database Tasks
            </button>
            <button
              onClick={() => setActiveTab("auth")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === "auth"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {user ? "Profile" : "Sign In"}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* TAB 1: LANDING PAGE */}
        {activeTab === "landing" && (
          <div className="space-y-16 py-6">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Live on Vercel & Supabase
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Modern Full-Stack Power with{" "}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Supabase & Next.js
                </span>
              </h1>

              <p className="text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                Built with React 19, Next.js App Router, Tailwind CSS, and
                Supabase backend services. Deployed via GitHub Actions and Vercel
                Edge Network.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-lg shadow-emerald-500/25 transition-all text-sm"
                >
                  Explore Database Tasks
                </button>
                <button
                  onClick={() => setActiveTab("auth")}
                  className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold transition-all text-sm"
                >
                  Open Auth Portal
                </button>
              </div>
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-lg">
                  🔐
                </div>
                <h3 className="font-semibold text-lg text-white">
                  Supabase Auth Portal
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Ready-to-use Email/Password authentication and GitHub OAuth
                  integration with session listeners.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center text-lg">
                  🗄️
                </div>
                <h3 className="font-semibold text-lg text-white">
                  PostgreSQL Realtime CRUD
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Interactive database operations with instant optimistic updates
                  and persistent cloud data storage.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-lg">
                  🚀
                </div>
                <h3 className="font-semibold text-lg text-white">
                  Automated CI/CD
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  Linked directly to your GitHub repository with automatic
                  zero-downtime builds on every commit.
                </p>
              </div>
            </div>

            {/* Architecture Details Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-900/60 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="font-bold text-white text-base">
                  Connected Supabase Architecture
                </h4>
                <p className="text-xs text-zinc-400">
                  Region: <span className="font-mono text-zinc-300">ap-southeast-2 (Sydney)</span> | 
                  Database: <span className="font-mono text-zinc-300">PostgreSQL 15</span> | 
                  Client: <span className="font-mono text-zinc-300">@supabase/supabase-js v2</span>
                </p>
              </div>
              <button
                onClick={() => setActiveTab("dashboard")}
                className="whitespace-nowrap px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700"
              >
                View Live Database &rarr;
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DATABASE DASHBOARD / TODO LIST */}
        {activeTab === "dashboard" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Database Task Manager
                </h2>
                <p className="text-sm text-zinc-400">
                  Real-time CRUD operations linked to Supabase PostgreSQL table{" "}
                  <code className="bg-zinc-800 px-1 py-0.5 rounded text-emerald-400 font-mono text-xs">
                    todos
                  </code>
                </p>
              </div>
              <button
                onClick={fetchTodos}
                disabled={dbLoading}
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
              >
                {dbLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            {/* SQL Table Helper (If table doesn't exist yet) */}
            {dbError && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    ⚠️ Need to create the "todos" table in Supabase?
                  </span>
                  <button
                    onClick={copySqlSnippet}
                    className="text-xs px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium"
                  >
                    {copiedSql ? "✓ Copied to Clipboard!" : "Copy SQL Script"}
                  </button>
                </div>
                <p className="text-xs text-zinc-300">
                  Open your{" "}
                  <a
                    href="https://supabase.com/dashboard/project/psvovfskhqthdhcrwaqy/sql"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-amber-400 hover:text-amber-300"
                  >
                    Supabase SQL Editor
                  </a>
                  , paste the script, and click <strong>Run</strong>. Until then, demo tasks work optimistically!
                </p>
              </div>
            )}

            {/* Add Task Input Form */}
            <form
              onSubmit={handleAddTodo}
              className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row gap-3"
            >
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="Add a new database task or project milestone..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newTodoPriority}
                  onChange={(e: any) => setNewTodoPriority(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none"
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
                <button
                  type="submit"
                  className="whitespace-nowrap px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition-all shadow-md shadow-emerald-500/20"
                >
                  + Add Task
                </button>
              </div>
            </form>

            {/* Todo List Items */}
            <div className="space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between gap-4 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={todo.is_completed}
                      onChange={() => handleToggleTodo(todo)}
                      className="h-4 w-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 accent-emerald-500 cursor-pointer"
                    />
                    <span
                      className={`text-sm ${
                        todo.is_completed
                          ? "line-through text-zinc-500"
                          : "text-zinc-200"
                      }`}
                    >
                      {todo.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {todo.priority && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          todo.priority === "High"
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            : todo.priority === "Medium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                      >
                        {todo.priority}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-zinc-500 hover:text-rose-400 text-xs p-1 transition-colors"
                      title="Delete task"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: AUTH PORTAL */}
        {activeTab === "auth" && (
          <div className="max-w-md mx-auto space-y-6 py-4">
            {user ? (
              <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-lg">
                    {user.email ? user.email[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {user.email}
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      ID: {user.id.slice(0, 12)}...
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 space-y-2 text-xs text-zinc-400">
                  <p>
                    Provider:{" "}
                    <span className="text-zinc-200 font-medium">
                      {user.app_metadata?.provider || "Email"}
                    </span>
                  </p>
                  <p>
                    Role:{" "}
                    <span className="text-zinc-200 font-medium">
                      {user.role || "authenticated"}
                    </span>
                  </p>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="font-bold text-xl text-white">
                    {authMode === "signin"
                      ? "Welcome Back"
                      : "Create Your Account"}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Connect directly to Supabase Authentication
                  </p>
                </div>

                {/* OAuth Button */}
                <button
                  onClick={handleGitHubLogin}
                  className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium border border-zinc-700 transition-all"
                >
                  <svg
                    className="h-5 w-5 fill-current"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Continue with GitHub
                </button>

                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span>or email & password</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {/* Email / Password Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {authMessage && (
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        authMessage.type === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {authMessage.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all shadow-md shadow-emerald-500/20"
                  >
                    {authLoading
                      ? "Processing..."
                      : authMode === "signin"
                      ? "Sign In"
                      : "Create Account"}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <button
                    onClick={() => {
                      setAuthMode(
                        authMode === "signin" ? "signup" : "signin"
                      );
                      setAuthMessage(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                  >
                    {authMode === "signin"
                      ? "Don't have an account? Sign up"
                      : "Already have an account? Sign in"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        <p>
          Supafast • Next.js 16 + Supabase + Vercel Deployment • Built for
          Pratibha
        </p>
      </footer>
    </div>
  );
}
