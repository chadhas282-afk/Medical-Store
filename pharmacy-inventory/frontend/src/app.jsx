import React, { useState, useEffect, useCallback, useRef, useContext, createContext } from 'react';
import ReactDOM from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Link,
  useLocation,
  useNavigate,
  useParams,
  Outlet
} from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  AlertTriangle,
  Settings as SettingsIcon,
  Menu,
  X,
  Pill,
  Plus,
  LogOut,
  ShoppingCart,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit,
  Trash2,
  Eye,
  TrendingUp,
  TrendingDown,
  Clock,
  Download,
  RefreshCw,
  ListOrdered,
  Printer,
  Lock,
  Mail,
  EyeOff,
  Loader2,
  KeyRound,
  User,
  PackageX,
  History,
  ArrowLeft,
  Save,
  Database,
  Upload,
  Shield,
  Bell,
  Palette,
  Info,
  Smartphone,
  FileSpreadsheet,
  CornerDownLeft,
  Minus,
  CheckCircle2,
  Undo2,
  PackagePlus,
  PackageSearch,
  ListChecks,
  DollarSign,
  Tag,
  MoreVertical,
  Filter
} from 'lucide-react';
import './style.css';

// ============================================================================
// 1. GLOBAL INITIALIZATION & THEME LOGIC
// ============================================================================
function initAppearance() {
  if (typeof window === 'undefined') return;
  const savedTheme = localStorage.getItem('pharmatrack-theme');
  const validThemes = ['light', 'dark', 'sepia', 'high-contrast', 'ocean', 'forest', 'system'];
  if (validThemes.includes(savedTheme)) {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = savedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : savedTheme;
    if (effective !== 'light') document.documentElement.setAttribute('data-theme', effective);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  const savedAccent = localStorage.getItem('pharmatrack-accent') || 'teal';
  document.documentElement.setAttribute('data-accent', savedAccent);

  const savedDensity = localStorage.getItem('pharmatrack-density');
  if (savedDensity) document.documentElement.setAttribute('data-density', savedDensity);

  const savedFontSize = localStorage.getItem('pharmatrack-fontSize');
  if (savedFontSize) document.documentElement.setAttribute('data-font-size', savedFontSize);

  const savedAnimations = localStorage.getItem('pharmatrack-animations');
  if (savedAnimations === 'false') document.documentElement.setAttribute('data-reduced-motion', 'true');

  const savedSidebarCollapsed = localStorage.getItem('pharmatrack-sidebar-collapsed');
  if (savedSidebarCollapsed) document.documentElement.setAttribute('data-sidebar-collapsed', savedSidebarCollapsed);
}
initAppearance();

// ============================================================================
// 2. CONSTANTS, UTILITIES & API CLIENT
// ============================================================================
export const CATEGORIES = [
  'Antibiotics',
  'Pain Relief',
  'Cardiovascular',
  'Respiratory',
  'Digestive Health',
  'Diabetes',
  'Vitamins & Supplements',
  'Skin Care',
  'Eye & Ear Care',
  'First Aid',
  'Other',
];

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const AUTH_KEY = 'pharmatrack-auth';

function getAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token || null;
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Unable to connect to server. Please check your connection.');
    }
    throw error;
  }
}

export const api = {
  auth: {
    register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    me: () => request('/auth/me'),
    changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } }),
  },
  medicines: {
    list: (params = {}) => {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value);
        }
      });
      return request(`/medicines?${searchParams.toString()}`);
    },
    get: (id) => request(`/medicines/${id}`),
    create: (data) => request('/medicines', { method: 'POST', body: data }),
    update: (id, data) => request(`/medicines/${id}`, { method: 'PUT', body: data }),
    updateStock: (id, quantity, note) => request(`/medicines/${id}/stock`, { method: 'PATCH', body: { quantity, ...(note ? { note } : {}) } }),
    delete: (id) => request(`/medicines/${id}`, { method: 'DELETE' }),
    getAlerts: () => request('/medicines/alerts'),
    getStats: () => request('/medicines/stats'),
    getLogs: (id) => request(`/medicines/${id}/logs`),
    checkDuplicate: (name, batchNumber, id) => {
      const params = new URLSearchParams({ name, batchNumber });
      if (id) params.append('id', id);
      return request(`/medicines/check-duplicate?${params.toString()}`);
    },
    getReorder: () => request('/medicines/reorder'),
    importMany: (medicines) => request('/medicines/import', { method: 'POST', body: { medicines } }),
  },
  sales: {
    sell: (data) => request('/sales', { method: 'POST', body: data }),
    refund: (data) => request('/sales/return', { method: 'POST', body: data }),
    summary: (range = 'all') => request(`/sales/summary?range=${range}`),
  },
  reports: {
    summary: () => request('/reports/summary'),
    expiry: () => request('/reports/expiry'),
  },
  categories: {
    list: () => request('/categories'),
  },
  backup: {
    export: () => request('/backup/export'),
    import: (data) => request('/backup/import', { method: 'POST', body: data }),
  },
  health: () => request('/health'),
};

export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getDaysUntilExpiry(expiryDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diffTime = expiry - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getExpiryStatus(expiryDate) {
  const days = getDaysUntilExpiry(expiryDate);
  if (days < 0) return { status: 'expired', label: 'Expired', days, className: 'badge-danger' };
  if (days <= 30) return { status: 'expiring-soon', label: 'Expiring Soon', days, className: 'badge-warning' };
  if (days <= 60) return { status: 'expiring-later', label: 'Expiring in 31-60d', days, className: 'badge-blue' };
  return { status: 'good', label: 'Good', days, className: 'badge-success' };
}

export function formatCurrency(amount) {
  const currency = typeof localStorage !== 'undefined' ? localStorage.getItem('pharmatrack-currency') || 'INR' : 'INR';
  const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$' };
  const symbol = symbols[currency] || '₹';
  return `${symbol}${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-IN');
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = String(text ?? '');

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

export function csvRowsToMedicines(rows) {
  if (!rows || rows.length === 0) return { error: 'The file is empty' };

  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const indexOf = (col) => headers.indexOf(col);

  const idxName = indexOf('name');
  const idxCategory = indexOf('category');
  const idxBatch = indexOf('batch number');
  if (idxName === -1 || idxCategory === -1 || idxBatch === -1) {
    return { error: 'CSV must include columns: Name, Category, Batch Number' };
  }

  const parseNumberVal = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return NaN;
    return Number(String(v).trim().replace(/[^0-9.-]/g, ''));
  };

  const parseDateVal = (v) => {
    if (!v || String(v).trim() === '') return null;
    const d = new Date(String(v).trim());
    return isNaN(d.getTime()) ? null : d;
  };

  const medicines = [];
  let invalid = 0;
  const invalidRows = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const get = (idx) => (idx >= 0 && idx < cells.length ? (cells[idx] || '').toString().trim() : '');

    const name = get(idxName);
    const category = get(idxCategory);
    const batchNumber = get(idxBatch);

    if (!name || !category || !batchNumber) {
      invalid++;
      invalidRows.push(r + 1);
      continue;
    }

    const quantity = parseNumberVal(indexOf('quantity') >= 0 ? get(indexOf('quantity')) : '');
    const unitPrice = parseNumberVal(indexOf('unit price') >= 0 ? get(indexOf('unit price')) : '');
    const expiryDate = parseDateVal(indexOf('expiry date') >= 0 ? get(indexOf('expiry date')) : '');
    const mfgDate = parseDateVal(indexOf('mfg date') >= 0 ? get(indexOf('mfg date')) : '');

    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !expiryDate) {
      invalid++;
      invalidRows.push(r + 1);
      continue;
    }

    const threshold = parseNumberVal(indexOf('low stock threshold') >= 0 ? get(indexOf('low stock threshold')) : '');

    medicines.push({
      name,
      category,
      batchNumber,
      genericName: get(indexOf('generic name')) || undefined,
      manufacturer: get(indexOf('manufacturer')) || undefined,
      supplier: get(indexOf('supplier')) || undefined,
      quantity,
      unitPrice,
      expiryDate: expiryDate.toISOString(),
      manufacturingDate: mfgDate ? mfgDate.toISOString() : undefined,
      lowStockThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 10,
      location: get(indexOf('location')) || undefined,
      notes: get(indexOf('notes')) || undefined,
    });
  }

  return { medicines, total: rows.length - 1, invalid, invalidRows };
}

// ============================================================================
// 3. REACT CONTEXTS (AUTH & TOAST)
// ============================================================================
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, title, message) => {
    const id = Date.now() + Math.random();
    const toast = { id, type, title, message };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const success = useCallback((title, message) => showToast('success', title, message), [showToast]);
  const error = useCallback((title, message) => showToast('error', title, message), [showToast]);
  const warning = useCallback((title, message) => showToast('warning', title, message), [showToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, success, error, warning, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`} role="alert">
          <div className="toast-content">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-message">{toast.message}</div>
          </div>
          <button className="toast-close" onClick={() => onRemove(toast.id)} aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

const AuthContext = createContext(null);
const STORAGE_KEY = 'pharmatrack-auth';
const PIN_UNLOCK_KEY = 'pharmatrack-pin-unlocked';
const PIN_KEY = 'pharmatrack-pin';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.token && parsed.user && parsed.user.email ? parsed : null;
  } catch {
    return null;
  }
}

async function sha256(message) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = readStoredSession();
      if (!stored) {
        if (active) setChecking(false);
        return;
      }
      try {
        const data = await api.auth.me();
        if (active) setSession({ token: stored.token, user: data.user });
      } catch {
        if (active) {
          localStorage.removeItem(STORAGE_KEY);
          setSession(null);
        }
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveSession = useCallback((data) => {
    const next = { token: data.token, user: data.user };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
    return next;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.auth.login(email, password);
    return saveSession(data);
  }, [saveSession]);

  const register = useCallback(async (name, email, password) => {
    const data = await api.auth.register(name, email, password);
    return saveSession(data);
  }, [saveSession]);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    return api.auth.changePassword(currentPassword, newPassword);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PIN_UNLOCK_KEY);
    setSession(null);
  }, []);

  const setPin = useCallback(async (pin) => {
    const value = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(value)) return { ok: false, message: 'PIN must be 4-8 digits' };
    const hash = await sha256(value);
    localStorage.setItem(PIN_KEY, hash);
    sessionStorage.setItem(PIN_UNLOCK_KEY, '1');
    return { ok: true, message: 'PIN lock enabled' };
  }, []);

  const clearPin = useCallback(() => {
    localStorage.removeItem(PIN_KEY);
    sessionStorage.removeItem(PIN_UNLOCK_KEY);
  }, []);

  const hasPin = useCallback(() => {
    try {
      return localStorage.getItem(PIN_KEY) !== null;
    } catch {
      return false;
    }
  }, []);

  const verifyPin = useCallback(async (pin) => {
    const storedHash = localStorage.getItem(PIN_KEY);
    if (!storedHash) return false;
    const inputHash = await sha256(String(pin || '').trim());
    if (inputHash === storedHash) {
      sessionStorage.setItem(PIN_UNLOCK_KEY, '1');
      return true;
    }
    return false;
  }, []);

  const isPinUnlocked = useCallback(() => sessionStorage.getItem(PIN_UNLOCK_KEY) === '1', []);

  const value = {
    user: session?.user || null,
    checking,
    login,
    register,
    logout,
    changePassword,
    setPin,
    clearPin,
    hasPin,
    verifyPin,
    isPinUnlocked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

// ============================================================================
// 4. SHARED UI COMPONENTS
// ============================================================================
function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', variant = 'primary', loading }) {
  if (!open) return null;
  const variantClasses = { primary: 'btn-primary', danger: 'btn-danger', secondary: 'btn-secondary' };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <p className="text-gray-600">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary" disabled={loading}>Cancel</button>
          <button onClick={onConfirm} className={`btn ${variantClasses[variant]}`} disabled={loading}>
            {loading ? 'Please wait…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function PinLock({ onUnlocked }) {
  const { verifyPin, user, logout } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pin.trim() || verifying) return;
    setVerifying(true);
    setErrorMsg('');
    const ok = await verifyPin(pin);
    if (ok) {
      setPin('');
      onUnlocked && onUnlocked();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      setErrorMsg(`Incorrect PIN${next >= 3 ? ` — ${5 - next} attempt(s) left before signout` : ''}`);
      setPin('');
      if (next >= 5) logout();
    }
    setVerifying(false);
  };

  const onDigit = (d) => {
    if (pin.length < 8) setPin((prev) => prev + d);
  };

  return (
    <div className="pin-lock">
      <div className="pin-card">
        <div className="brand-logo mx-auto mb-4" style={{ width: 52, height: 52, borderRadius: 14 }}>
          <Pill className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <h1 className="text-lg font-bold text-gray-900 text-center">PharmaTrack is locked</h1>
        <p className="text-sm text-gray-500 text-center mt-1">Enter your PIN to continue · {user?.name}</p>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="input pl-9 text-center text-lg tracking-[0.5em] font-semibold"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                aria-label="Enter PIN"
              />
            </div>
          </div>
          {errorMsg && <p className="text-sm text-red-600 font-medium text-center mt-2" role="alert">{errorMsg}</p>}
          <div className="grid grid-cols-3 gap-2 mt-4 max-w-[260px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} type="button" onClick={() => onDigit(String(n))} className="pin-key">{n}</button>
            ))}
            <button type="button" onClick={() => setPin('')} className="pin-key text-gray-400 text-xs font-medium">Clear</button>
            <button type="button" onClick={() => onDigit('0')} className="pin-key">0</button>
            <button type="button" onClick={() => setPin((prev) => prev.slice(0, -1))} className="pin-key text-gray-400">⌫</button>
          </div>
          <button type="submit" className="btn btn-primary w-full justify-center mt-5" disabled={!pin || verifying}>
            {verifying ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 mt-4 mx-auto block">
          Sign out instead
        </button>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return (
      <div className="login-page">
        <div className="login-card auth-loading">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

function LabelModal({ medicine, onClose }) {
  if (!medicine) return null;
  const expiry = getExpiryStatus(medicine.expiryDate);

  const handlePrint = () => {
    document.body.classList.add('printing-label');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-label'), 500);
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title flex items-center gap-2">
            <Tag className="w-4 h-4" /> Shelf label
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="modal-body">
          <div className="label-print">
            <div className="label-sheet">
              <div className="label-brand">
                <div className="brand-logo" style={{ width: 26, height: 26, borderRadius: 7 }}>
                  <Tag className="w-3.5 h-3.5" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="label-brand-name">PharmaTrack</div>
                  <div className="label-brand-sub">Pharmacy Inventory</div>
                </div>
              </div>
              <h3 className="label-name">{medicine.name}</h3>
              {medicine.genericName && <p className="label-generic">{medicine.genericName}</p>}
              <div className="label-grid">
                <div><span className="label-key">Batch</span><span className="label-val">{medicine.batchNumber}</span></div>
                <div>
                  <span className="label-key">Expiry</span>
                  <span className={`label-val ${expiry.status === 'expired' ? 'label-expired' : expiry.status === 'expiring-soon' ? 'label-soon' : ''}`}>
                    {formatDate(medicine.expiryDate)}
                  </span>
                </div>
                <div><span className="label-key">Qty</span><span className="label-val">{medicine.quantity}</span></div>
                {medicine.location && <div><span className="label-key">Location</span><span className="label-val">{medicine.location}</span></div>}
              </div>
              <div className="label-footer">
                <span>{medicine.category}</span>
                {medicine.supplier && <span>Supplier: {medicine.supplier}</span>}
                <span className="label-date">Label printed {formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Cut and stick on shelf or product box.</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn btn-primary"><Printer className="w-4 h-4" /> Print label</button>
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const actions = [
    { label: 'New medicine', icon: Plus, to: '/medicines/new' },
    { label: 'Go to Dispensing', icon: ShoppingCart, to: '/sales' },
    { label: 'Go to Alerts', icon: AlertTriangle, to: '/alerts' },
    { label: 'Go to Settings', icon: SettingsIcon, to: '/settings' },
  ].map((a) => ({ ...a, go: () => navigate(a.to) }));

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.medicines.list({ search: query.trim(), limit: 8 });
        if (!cancelled) setResults(data.medicines || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  if (!open) return null;
  const totalItems = actions.length + results.length;

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < results.length && results[active]) {
        onClose();
        navigate(`/medicines/${results[active]._id}/edit`);
      } else if (active >= results.length) {
        onClose();
        actions[active - results.length]?.go();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="palette-input-wrap">
          <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search medicines or jump to a page… (Esc to close)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          />
        </div>
        <div className="palette-body">
          {!query.trim() && (
            <>
              <p className="palette-section">Jump to</p>
              {actions.map((action, i) => (
                <button
                  key={action.label}
                  className={`palette-item ${i === active ? 'active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => { onClose(); action.go(); }}
                >
                  <action.icon className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-left truncate"><span className="block text-sm text-gray-800">{action.label}</span></span>
                  <CornerDownLeft className="w-3.5 h-3.5 text-gray-300" />
                </button>
              ))}
            </>
          )}
          {query.trim() && loading && <p className="palette-hint">Searching…</p>}
          {query.trim() && !loading && (
            <>
              {results.length === 0 ? (
                <p className="palette-hint">No medicines found for “{query}”.</p>
              ) : (
                <>
                  <p className="palette-section">Medicines</p>
                  {results.map((m, i) => (
                    <button
                      key={m._id}
                      className={`palette-item ${i === active ? 'active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => { onClose(); navigate(`/medicines/${m._id}/edit`); }}
                    >
                      <Pill className="w-4 h-4 text-gray-400" />
                      <span className="flex-1 text-left min-w-0">
                        <span className="block text-sm text-gray-800 truncate">{m.name}</span>
                        <span className="block text-xs text-gray-400 truncate">
                          {m.category} · batch {m.batchNumber} · {m.quantity} in stock · expires {formatDate(m.expiryDate)}
                        </span>
                      </span>
                      <CornerDownLeft className="w-3.5 h-3.5 text-gray-300" />
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
        <div className="palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, accent = 'teal', trend, trendDown, skeleton, children }) {
  if (skeleton) {
    return (
      <div className="stat-card">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-3/4 bg-gray-200 rounded" />
          <div className="h-8 w-1/2 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const gradientMap = {
    teal: 'linear-gradient(135deg, #0d9488, #14b8a6)',
    red: 'linear-gradient(135deg, #ef4444, #dc2626)',
    amber: 'linear-gradient(135deg, #f59e0b, #d97706)',
    blue: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    green: 'linear-gradient(135deg, #22c55e, #16a34a)',
    purple: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  };

  const iconBgMap = {
    teal: { background: 'rgba(13,148,136,0.12)', color: '#0d9488' },
    red: { background: 'rgba(220,38,38,0.1)', color: '#dc2626' },
    amber: { background: 'rgba(217,119,6,0.12)', color: '#d97706' },
    blue: { background: 'rgba(37,99,235,0.1)', color: '#2563eb' },
    green: { background: 'rgba(22,163,74,0.12)', color: '#16a34a' },
    purple: { background: 'rgba(124,58,237,0.1)', color: '#7c3aed' },
  };

  return (
    <div className="stat-card">
      <div className="stat-accent" style={{ background: gradientMap[accent] || gradientMap.teal }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-title">{title}</p>
          <p className="stat-value">{value}</p>
          {trend && (
            <div className="stat-trend">
              <span className={trendDown ? 'text-red-600' : 'text-green-600'}>
                {trendDown ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </span>
              <span className="text-gray-500">{trend.label || trend.value}</span>
            </div>
          )}
        </div>
        <div className="stat-icon" style={iconBgMap[accent] || iconBgMap.teal}>
          <Icon className="w-6 h-6" aria-hidden="true" />
        </div>
      </div>
      {children}
    </div>
  );
}

function BarChart({ data, height = 170, color = 'var(--primary)', formatValue = (v) => v }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">No data yet</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((item, i) => {
        const pct = Math.round((item.value / max) * 100);
        return (
          <div key={`${item.label}-${i}`} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
            <span className="text-[10px] font-semibold text-gray-500 leading-none">{formatValue(item.value)}</span>
            <div className="chart-bar" style={{ height: `${Math.max(pct, 2)}%`, background: color, minHeight: 4 }} />
            <span className="text-[10px] text-gray-500 truncate w-full text-center leading-none pb-0.5">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

const CHART_COLORS = ['#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#16a34a', '#94a3b8'];
function DonutChart({ data, size = 150, formatValue = (v) => v }) {
  if (!data || data.length === 0) return <div className="flex items-center justify-center" style={{ width: size, height: size }}><p className="text-sm text-gray-400">No data</p></div>;
  const total = data.reduce((sum, d) => sum + Math.max(d.value, 0), 0) || 1;
  let acc = 0;
  const stops = data.map((d, i) => {
    const start = (acc / total) * 360;
    acc += Math.max(d.value, 0);
    const end = (acc / total) * 360;
    return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}deg ${end}deg`;
  });
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="donut" style={{ width: size, height: size, background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="donut-hole">
          <span className="donut-value">{formatValue(total)}</span>
          <span className="donut-label">total</span>
        </div>
      </div>
      <ul className="space-y-1.5 min-w-0 flex-1">
        {data.map((d, i) => (
          <li key={`${d.name}-${i}`} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-gray-700 truncate flex-1">{d.name}</span>
            <span className="text-gray-900 font-semibold">{formatValue(d.value)}</span>
            <span className="text-gray-400 text-xs w-10 text-right">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="btn btn-sm btn-outline p-2" aria-label="Previous">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p) => (
        <button key={p} onClick={() => onPageChange(p)} className={`btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-outline'}`}>{p}</button>
      ))}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="btn btn-sm btn-outline p-2" aria-label="Next">
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}

function AlertCard({ medicine, alertType, onAction }) {
  const alertConfig = {
    expired: { icon: AlertTriangle, badgeClass: 'badge-danger', label: 'EXPIRED', urgency: 'Immediate action required - cannot be sold', iconBg: { background: 'rgba(220,38,38,0.12)', color: '#dc2626' } },
    expiringSoon: { icon: Clock, badgeClass: 'badge-warning', label: 'EXPIRING SOON', urgency: 'Expires within 30 days - sell or return first', iconBg: { background: 'rgba(217,119,6,0.12)', color: '#d97706' } },
    expiringLater: { icon: TrendingUp, badgeClass: 'badge-blue', label: 'EXPIRING 31-60 DAYS', urgency: 'Monitor closely', iconBg: { background: 'rgba(37,99,235,0.12)', color: '#2563eb' } },
    lowStock: { icon: Package, badgeClass: 'badge-info', label: 'LOW STOCK', urgency: 'Below reorder threshold', iconBg: { background: 'rgba(13,148,136,0.12)', color: '#0d9488' } },
  };

  const config = alertConfig[alertType] || alertConfig.expired;
  const Icon = config.icon;
  const expiry = getExpiryStatus(medicine.expiryDate);
  const totalValue = medicine.quantity * medicine.unitPrice;
  const isLowStock = medicine.quantity <= medicine.lowStockThreshold;
  const { success, error } = useToast();
  const [acting, setActing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const handleSoldOut = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (acting) return;
    setActing(true);
    try {
      await api.medicines.updateStock(medicine._id, 0, `Marked sold out from ${alertType} alert`);
      success('Sold out', `${medicine.name} stock set to 0`);
      onAction && onAction();
    } catch (err) {
      error('Action failed', err.message);
    } finally {
      setActing(false);
    }
  };

  const handleDiscard = async () => {
    setActing(true);
    try {
      await api.medicines.delete(medicine._id);
      success('Removed', `${medicine.name} has been removed from inventory`);
      setDiscardOpen(false);
      onAction && onAction();
    } catch (err) {
      error('Action failed', err.message);
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      <Link to={`/medicines/${medicine._id}/edit`} className="card block p-0 overflow-hidden hover:shadow-md transition-all group">
        <div className="flex items-center gap-4 p-4">
          <div className="stat-icon" style={config.iconBg}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`badge ${config.badgeClass} text-xs font-semibold`}>{config.label}</span>
              <h3 className="font-semibold text-gray-900 truncate">{medicine.name}</h3>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
              <span>Batch: <span className="font-medium text-gray-700">{medicine.batchNumber}</span></span>
              <span>Category: <span className="font-medium text-gray-700">{medicine.category}</span></span>
              {medicine.location && <span>Location: <span className="font-medium text-gray-700">{medicine.location}</span></span>}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 flex-wrap">
              <span className="text-xs text-gray-500">Expiry: <strong className={expiry.status === 'expired' ? 'text-red-600' : 'text-gray-900'}>{formatDate(medicine.expiryDate)}</strong></span>
              <span className="text-xs text-gray-500">Stock: <strong className={isLowStock ? 'text-amber-600' : 'text-gray-900'}>{medicine.quantity}</strong></span>
              <span className="text-xs text-gray-500 ml-auto">Value: <strong>{formatCurrency(totalValue)}</strong></span>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button onClick={handleSoldOut} disabled={acting} className="btn btn-secondary btn-sm">
                <PackageX className="w-3.5 h-3.5" /> Mark sold out
              </button>
              <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDiscardOpen(true); }} disabled={acting} className="btn btn-danger-ghost btn-sm">
                <Trash2 className="w-3.5 h-3.5" /> Discard
              </button>
              <span className="p-1.5 text-gray-400 hover:text-teal-600 rounded-lg"><Edit className="w-4 h-4" /></span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 transition-colors shrink-0" />
        </div>
      </Link>
      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={handleDiscard}
        title="Discard medicine?"
        message={`Permanently remove "${medicine.name}" (batch ${medicine.batchNumber}) from inventory?`}
        confirmText="Discard"
        variant="danger"
        loading={acting}
      />
    </>
  );
}

function AlertSummary({ counts, skeleton }) {
  if (skeleton) return <div className="card"><div className="card-body animate-pulse h-28 bg-gray-100 rounded-lg" /></div>;
  const alertTypes = [
    { key: 'expired', label: 'Expired', icon: AlertTriangle, tileClass: 'alert-tile-red', description: 'Immediate action required' },
    { key: 'expiringSoon', label: 'Expiring ≤30 days', icon: Clock, tileClass: 'alert-tile-amber', description: 'Plan returns or sales' },
    { key: 'expiringLater', label: 'Expiring 31-60 days', icon: TrendingUp, tileClass: 'alert-tile-blue', description: 'Monitor closely' },
    { key: 'lowStock', label: 'Low Stock', icon: Package, tileClass: 'alert-tile-teal', description: 'Reorder soon' },
  ];
  const totalAlerts = counts.expired + counts.expiringSoon + counts.expiringLater + counts.lowStock;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Alert Summary</h2>
        {totalAlerts > 0 && (
          <Link to="/alerts" className="text-sm font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
      <div className="card-body">
        {totalAlerts === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">No alerts at the moment</p>
            <p className="empty-state-text">All medicines are within safe inventory limits.</p>
          </div>
        ) : (
          <div className="alert-grid">
            {alertTypes.map((type) => (
              <Link key={type.key} to="/alerts" className={`alert-tile ${type.tileClass}`}>
                <div className="flex items-start justify-between">
                  <type.icon className="w-5 h-5" />
                  <span className="alert-count">{counts[type.key] || 0}</span>
                </div>
                <div className="alert-label">{type.label}</div>
                <div className="alert-desc">{type.description}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecentMedicines({ skeleton }) {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!skeleton) {
      api.medicines.list({ sortBy: 'createdAt', sortOrder: 'desc', limit: 5 })
        .then((d) => setMedicines(d.medicines || []))
        .catch(() => setMedicines([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [skeleton]);

  if (loading || skeleton) return <div className="card"><div className="card-body animate-pulse h-40 bg-gray-100" /></div>;

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Recent Medicines</h2>
        <Link to="/medicines" className="text-sm text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1">
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="card-body p-0">
        {medicines.length === 0 ? (
          <div className="empty-state"><p className="empty-state-title">No medicines yet</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th className="hidden md:table-cell">Batch</th>
                  <th>Expiry</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <Link to={`/medicines/${m._id}/edit`} className="font-semibold text-gray-900 hover:text-teal-600">{m.name}</Link>
                      <p className="text-xs text-gray-400">{m.category}</p>
                    </td>
                    <td className="hidden md:table-cell text-sm text-gray-500">{m.batchNumber}</td>
                    <td><span className="badge badge-gray">{formatDate(m.expiryDate)}</span></td>
                    <td className="text-right font-semibold">{m.quantity}</td>
                    <td className="text-right text-sm text-gray-500">{formatCurrency(m.quantity * m.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MedicineFilters({ filters, onFiltersChange, categories, show, onToggle }) {
  const hasActiveFilters = filters.search || filters.category || filters.status;
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <button onClick={onToggle} className={`btn btn-sm ${show ? 'btn-primary' : 'btn-secondary'} flex items-center gap-1`}>
          <Filter className="w-4 h-4" /> Filters <ChevronDown className={`w-4 h-4 transition-transform ${show ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {show && (
        <div className="card-body pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, batch, generic..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value, page: 1 })}
                className="input pl-10"
              />
            </div>
            <select value={filters.category} onChange={(e) => onFiltersChange({ ...filters, category: e.target.value, page: 1 })} className="input">
              <option value="">All Categories</option>
              {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
            </select>
            <select value={filters.status} onChange={(e) => onFiltersChange({ ...filters, status: e.target.value, page: 1 })} className="input">
              <option value="">All Status</option>
              <option value="expired">Expired</option>
              <option value="expiring-soon">Expiring ≤30 days</option>
              <option value="expiring-later">Expiring 31-60 days</option>
              <option value="low-stock">Low Stock</option>
            </select>
            <div className="flex gap-2">
              <select value={filters.sortBy} onChange={(e) => onFiltersChange({ ...filters, sortBy: e.target.value })} className="input flex-1">
                <option value="expiryDate">Expiry Date</option>
                <option value="name">Name</option>
                <option value="quantity">Quantity</option>
                <option value="unitPrice">Price</option>
              </select>
              <select value={filters.sortOrder} onChange={(e) => onFiltersChange({ ...filters, sortOrder: e.target.value })} className="input w-24">
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>
          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-100">
              <span className="text-sm text-gray-500">Active filters</span>
              <button onClick={() => onFiltersChange({ search: '', category: '', status: '', sortBy: 'expiryDate', sortOrder: 'asc' })} className="btn btn-sm btn-outline flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MedicineTable({ medicines, loading, onEdit, onDelete, onView, onLabel }) {
  if (loading) return <div className="card"><div className="table-container p-6 animate-pulse">Loading medicines…</div></div>;
  if (medicines.length === 0) return <div className="card"><div className="empty-state"><p className="empty-state-title">No medicines found</p></div></div>;

  return (
    <div className="card overflow-hidden">
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th className="hidden md:table-cell">Category</th>
              <th className="hidden lg:table-cell">Batch</th>
              <th>Expiry Date</th>
              <th className="text-right">Qty</th>
              <th className="hidden xl:table-cell text-right">Price</th>
              <th className="text-right">Total Value</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((medicine) => {
              const expiry = getExpiryStatus(medicine.expiryDate);
              const totalValue = medicine.quantity * medicine.unitPrice;
              const isLowStock = medicine.quantity <= medicine.lowStockThreshold;

              return (
                <tr key={medicine._id}>
                  <td>
                    <Link to={`/medicines/${medicine._id}/edit`} className="font-semibold text-gray-900 hover:text-teal-600">{medicine.name}</Link>
                    {medicine.genericName && <p className="text-xs text-gray-400 mt-0.5">{medicine.genericName}</p>}
                  </td>
                  <td className="hidden md:table-cell"><span className="badge badge-gray">{medicine.category}</span></td>
                  <td className="hidden lg:table-cell text-sm text-gray-500">{medicine.batchNumber}</td>
                  <td>
                    <span className={`badge ${expiry.className}`}>{formatDate(medicine.expiryDate)}</span>
                  </td>
                  <td className={`text-right font-semibold ${isLowStock ? 'text-amber-600' : 'text-gray-900'}`}>{medicine.quantity}</td>
                  <td className="hidden xl:table-cell text-right text-sm text-gray-500">{formatCurrency(medicine.unitPrice)}</td>
                  <td className="text-right font-semibold text-gray-900">{formatCurrency(totalValue)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onEdit(medicine)} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Edit"><Edit className="w-4 h-4" /></button>
                      {onLabel && <button onClick={() => onLabel(medicine)} className="p-2 text-gray-400 hover:text-gray-600" aria-label="Label"><Printer className="w-4 h-4" /></button>}
                      <button onClick={() => onDelete(medicine)} className="p-2 text-gray-400 hover:text-red-600" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [alertCounts, setAlertCounts] = useState({ expired: 0, expiringSoon: 0, expiringLater: 0, lowStock: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pinLocked, setPinLocked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPin, isPinUnlocked } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Medicines', href: '/medicines', icon: Package },
    { name: 'Dispensing', href: '/sales', icon: ShoppingCart },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangle },
  ];

  const fetchAlertCounts = async () => {
    try {
      const data = await api.medicines.getAlerts();
      setAlertCounts({
        expired: data.expired?.length || 0,
        expiringSoon: data.expiringSoon?.length || 0,
        expiringLater: data.expiringLater?.length || 0,
        lowStock: data.lowStock?.length || 0,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAlertCounts();
    const interval = setInterval(fetchAlertCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasPin() && !isPinUnlocked()) setPinLocked(true);
  }, []);

  const totalAlerts = alertCounts.expired + alertCounts.expiringSoon + alertCounts.expiringLater + alertCounts.lowStock;
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="layout-root">
      <aside id="sidebar" className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/" className="sidebar-brand-link" onClick={() => setSidebarOpen(false)}>
            <div className="brand-logo"><Pill className="w-5 h-5" strokeWidth={2.5} /></div>
            <div>
              <div className="brand-name">PharmaTrack</div>
              <div className="brand-tag">Inventory Control</div>
            </div>
          </NavLink>
          <button className="lg:hidden p-2 text-white/60 hover:text-white" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">Menu</div>
          {navigation.map((item) => (
            <NavLink key={item.name} to={item.href} className={`nav-link ${isActive(item.href) ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
              <item.icon className="w-5 h-5" />
              <span className="truncate">{item.name}</span>
              {item.href === '/alerts' && totalAlerts > 0 && <span className="nav-count">{totalAlerts}</span>}
            </NavLink>
          ))}
          <div className="nav-label">Account</div>
          <NavLink to="/settings" className={`nav-link ${isActive('/settings') ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}>
            <SettingsIcon className="w-5 h-5" />
            <span className="truncate">Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{(user?.name || '?').charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-info"><p className="sidebar-user-name">{user?.name || 'User'}</p></div>
            <button onClick={logout} className="sidebar-logout" title="Sign out"><LogOut className="w-4 h-4" /></button>
          </div>
          <NavLink to="/medicines/new" className="quick-action" onClick={() => setSidebarOpen(false)}>
            <Plus className="w-5 h-5" /><span>Add Medicine</span>
          </NavLink>
        </div>
      </aside>

      {sidebarOpen && <div className="mobile-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="main-wrapper">
        <header className="topbar">
          <div className="topbar-inner flex-wrap">
            <button className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className="mobile-brand">
              <div className="brand-logo" style={{ width: 30, height: 30, borderRadius: 8 }}><Pill className="w-4 h-4" /></div>
              <span>PharmaTrack</span>
            </div>
            <div className="hidden md:flex flex-1 justify-center px-4">
              <button onClick={() => setPaletteOpen(true)} className="topbar-search">
                <Search className="w-4 h-4" /><span>Search medicines…</span><kbd>⌘K</kbd>
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="main-content">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {pinLocked && <PinLock onUnlocked={() => setPinLocked(false)} />}
    </div>
  );
}

// ============================================================================
// 5. PAGES
// ============================================================================

// --- LOGIN & SIGNUP ---
function Login() {
  const { login, checking, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = location.state?.from || '/';
  if (checking) return <div className="login-page"><div className="login-card auth-loading"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div></div>;
  if (user) return <Navigate to={redirectTo} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo"><Pill className="w-6 h-6" strokeWidth={2.5} /></div>
          <h1 className="login-brand-name">PharmaTrack</h1>
          <p className="login-brand-tag">Pharmacy Inventory Control</p>
        </div>
        <div className="login-form-side">
          <form onSubmit={handleSubmit} className="login-form">
            <h2 className="login-title">Welcome back</h2>
            <p className="login-subtitle">Sign in to your inventory</p>
            {error && <div className="login-error">{error}</div>}
            <div>
              <label className="label">Email address</label>
              <div className="login-input-wrap">
                <Mail className="w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@pharmatrack.app" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="login-input-wrap">
                <Lock className="w-4 h-4 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="login-password-toggle">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <div className="login-demo">
            <p className="login-demo-label">Need an account?</p>
            <Link to="/signup" className="btn btn-outline btn-sm w-full justify-center">Create account</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Signup() {
  const { register, checking, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (checking) return <div className="login-page"><div className="login-card auth-loading"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div></div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Please enter your name');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo"><Pill className="w-6 h-6" strokeWidth={2.5} /></div>
          <h1 className="login-brand-name">PharmaTrack</h1>
          <p className="login-brand-tag">Pharmacy Inventory Control</p>
        </div>
        <div className="login-form-side">
          <form onSubmit={handleSubmit} className="login-form">
            <h2 className="login-title">Create account</h2>
            <p className="login-subtitle">Sign up to manage your pharmacy inventory</p>
            {error && <div className="login-error">{error}</div>}
            <div>
              <label className="label">Full name</label>
              <div className="login-input-wrap">
                <User className="w-4 h-4 text-gray-400" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Dr. Sharma" required />
              </div>
            </div>
            <div>
              <label className="label">Email address</label>
              <div className="login-input-wrap">
                <Mail className="w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@pharmatrack.app" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="login-input-wrap">
                <Lock className="w-4 h-4 text-gray-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 6 characters" minLength={6} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>
          <div className="login-demo">
            <p className="login-demo-label">Already have an account?</p>
            <Link to="/login" className="btn btn-outline btn-sm w-full justify-center">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- DASHBOARD ---
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [salesWeek, setSalesWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  const loadData = async () => {
    try {
      const [statsData, salesData] = await Promise.all([api.medicines.getStats(), api.sales.summary('week')]);
      setStats(statsData);
      setSalesWeek(salesData);
    } catch (err) {
      error('Failed to load dashboard', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading || !stats) {
    return <div className="space-y-6"><div className="card p-8 text-center text-gray-500">Loading dashboard data…</div></div>;
  }

  const categoryChartData = (stats.categories || []).slice(0, 6).map((c) => ({ name: c._id || 'Other', value: c.count }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of inventory, sales, and urgent alerts</p>
        </div>
        <div className="page-actions">
          <Link to="/medicines/new" className="btn btn-primary"><Plus className="w-4 h-4" /> Add Medicine</Link>
          <Link to="/sales" className="btn btn-secondary"><ShoppingCart className="w-4 h-4" /> Dispense</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Medicines" value={stats.totalMedicines || 0} icon={Package} accent="teal" />
        <StatCard title="Total Stock Value" value={formatCurrency(stats.totalValue || 0)} icon={DollarSign} accent="blue" />
        <StatCard title="Expired Stock" value={stats.expiredCount || 0} icon={AlertTriangle} accent="red" />
        <StatCard title="Expiring ≤30d" value={stats.expiringSoonCount || 0} icon={Clock} accent="amber" />
      </div>

      <AlertSummary counts={{ expired: stats.expiredCount || 0, expiringSoon: stats.expiringSoonCount || 0, expiringLater: stats.expiringLaterCount || 0, lowStock: stats.lowStockCount || 0 }} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="text-lg font-semibold text-gray-900">Categories Breakdown</h2></div>
          <div className="card-body"><DonutChart data={categoryChartData} /></div>
        </div>
        <RecentMedicines />
      </div>
    </div>
  );
}

// --- MEDICINES ---
function Medicines() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', category: '', status: '', sortBy: 'expiryDate', sortOrder: 'asc' });
  const [showFilters, setShowFilters] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, medicine: null });
  const [labelMedicine, setLabelMedicine] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { success, error } = useToast();

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.medicines.list({ page, limit: 20, ...filters });
      setMedicines(data.medicines || []);
    } catch (err) {
      error('Failed to load medicines', err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, error]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const confirmDelete = async () => {
    if (!deleteDialog.medicine) return;
    setDeleting(true);
    try {
      await api.medicines.delete(deleteDialog.medicine._id);
      success('Deleted', `${deleteDialog.medicine.name} removed`);
      setDeleteDialog({ open: false, medicine: null });
      loadMedicines();
    } catch (err) {
      error('Delete failed', err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Medicines Inventory</h1>
          <p className="page-subtitle">Track batches, quantities, and expiration dates</p>
        </div>
        <div className="page-actions">
          <Link to="/medicines/new" className="btn btn-primary"><Plus className="w-4 h-4" /> Add Medicine</Link>
        </div>
      </div>

      <MedicineFilters filters={filters} onFiltersChange={setFilters} categories={CATEGORIES} show={showFilters} onToggle={() => setShowFilters(!showFilters)} />

      <MedicineTable
        medicines={medicines}
        loading={loading}
        onEdit={(m) => navigate(`/medicines/${m._id}/edit`)}
        onDelete={(m) => setDeleteDialog({ open: true, medicine: m })}
        onLabel={(m) => setLabelMedicine(m)}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, medicine: null })}
        onConfirm={confirmDelete}
        title="Delete Medicine?"
        message={`Delete "${deleteDialog.medicine?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />

      {labelMedicine && <LabelModal medicine={labelMedicine} onClose={() => setLabelMedicine(null)} />}
    </div>
  );
}

// --- MEDICINE FORM ---
function MedicineForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success, error } = useToast();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    name: '', genericName: '', category: '', batchNumber: '', manufacturer: '',
    supplier: '', quantity: 0, unitPrice: 0, expiryDate: '', manufacturingDate: '',
    lowStockThreshold: 10, location: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEditing) {
      api.medicines.get(id)
        .then((m) => {
          setFormData({
            ...m,
            expiryDate: m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : '',
            manufacturingDate: m.manufacturingDate ? new Date(m.manufacturingDate).toISOString().split('T')[0] : '',
          });
        })
        .catch((err) => {
          error('Failed to load', err.message);
          navigate('/medicines');
        });
    } else {
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFormData((f) => ({ ...f, expiryDate: nextYear }));
    }
  }, [id, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.category || !formData.batchNumber.trim() || !formData.expiryDate) {
      return error('Validation error', 'Please fill in Name, Category, Batch, and Expiry Date');
    }
    setSubmitting(true);
    try {
      if (isEditing) {
        await api.medicines.update(id, formData);
        success('Updated', `${formData.name} updated successfully`);
      } else {
        await api.medicines.create(formData);
        success('Created', `${formData.name} added to inventory`);
      }
      navigate('/medicines');
    } catch (err) {
      error('Failed to save', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/medicines" className="btn btn-secondary btn-sm"><ArrowLeft className="w-4 h-4" /> Back</Link>
        <h1 className="page-title">{isEditing ? 'Edit Medicine' : 'Add New Medicine'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Medicine Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" placeholder="e.g. Paracetamol 500mg" required />
          </div>
          <div>
            <label className="label">Generic Name</label>
            <input type="text" value={formData.genericName} onChange={(e) => setFormData({ ...formData, genericName: e.target.value })} className="input" placeholder="e.g. Acetaminophen" />
          </div>
          <div>
            <label className="label">Category *</label>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input" required>
              <option value="">Select Category</option>
              {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Batch Number *</label>
            <input type="text" value={formData.batchNumber} onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })} className="input" placeholder="e.g. BT-9021" required />
          </div>
          <div>
            <label className="label">Quantity in Stock *</label>
            <input type="number" min="0" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} className="input" required />
          </div>
          <div>
            <label className="label">Unit Price *</label>
            <input type="number" step="0.01" min="0" value={formData.unitPrice} onChange={(e) => setFormData({ ...formData, unitPrice: Number(e.target.value) })} className="input" required />
          </div>
          <div>
            <label className="label">Expiry Date *</label>
            <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className="input" required />
          </div>
          <div>
            <label className="label">Low Stock Threshold</label>
            <input type="number" min="1" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: Number(e.target.value) })} className="input" />
          </div>
        </div>
        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
          <Link to="/medicines" className="btn btn-secondary">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <Save className="w-4 h-4" /> {submitting ? 'Saving…' : 'Save Medicine'}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- ALERTS ---
function Alerts() {
  const [alerts, setAlerts] = useState({ expired: [], expiringSoon: [], expiringLater: [], lowStock: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expired');
  const { error } = useToast();

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await api.medicines.getAlerts();
      setAlerts(data);
    } catch (err) {
      error('Failed to load alerts', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const tabs = [
    { id: 'expired', label: 'Expired', count: alerts.expired?.length || 0, icon: AlertTriangle, accent: 'red' },
    { id: 'expiringSoon', label: 'Expiring ≤30 days', count: alerts.expiringSoon?.length || 0, icon: Clock, accent: 'amber' },
    { id: 'expiringLater', label: 'Expiring 31-60 days', count: alerts.expiringLater?.length || 0, icon: TrendingUp, accent: 'blue' },
    { id: 'lowStock', label: 'Low Stock', count: alerts.lowStock?.length || 0, icon: Package, accent: 'teal' },
  ];

  const currentList = alerts[activeTab] || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts & Notifications</h1>
          <p className="page-subtitle">Immediate attention items: expired, expiring, and low inventory</p>
        </div>
        <div className="page-actions">
          <button onClick={loadAlerts} className="btn btn-secondary"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <StatCard key={tab.id} title={tab.label} value={tab.count} icon={tab.icon} accent={tab.accent} />
        ))}
      </div>

      <div className="card">
        <div className="card-header border-b border-gray-200">
          <div className="alert-tabs">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`alert-tab ${activeTab === tab.id ? 'active' : ''}`}>
                <tab.icon className="w-4 h-4" /><span>{tab.label}</span>
                {tab.count > 0 && <span className="badge badge-gray">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {currentList.length === 0 ? (
            <div className="empty-state"><p className="empty-state-title">No alerts in this category</p></div>
          ) : (
            <div className="space-y-3">
              {currentList.map((m) => (
                <AlertCard key={m._id} medicine={m} alertType={activeTab} onAction={loadAlerts} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SALES & DISPENSING ---
function Sales() {
  const { success, error } = useToast();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [recentSales, setRecentSales] = useState([]);

  const loadRecent = async () => {
    try {
      const data = await api.sales.summary('today');
      setRecentSales(data.recent || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  const searchMedicines = async (q) => {
    setSearch(q);
    if (!q.trim()) return setResults([]);
    try {
      const data = await api.medicines.list({ search: q.trim(), limit: 6 });
      setResults(data.medicines || []);
    } catch {
      setResults([]);
    }
  };

  const addToCart = (medicine) => {
    if (medicine.quantity <= 0) return;
    setCart((prev) => {
      const found = prev.find((item) => item.medicineId === medicine._id);
      if (found) {
        return prev.map((item) => item.medicineId === medicine._id ? { ...item, quantity: Math.min(item.quantity + 1, medicine.quantity) } : item);
      }
      return [...prev, { medicineId: medicine._id, name: medicine.name, unitPrice: medicine.unitPrice, available: medicine.quantity, quantity: 1 }];
    });
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      for (const item of cart) {
        await api.sales.sell({ medicineId: item.medicineId, quantity: item.quantity });
      }
      success('Sale completed', `Dispensed ${cart.reduce((s, i) => s + i.quantity, 0)} item(s)`);
      setCart([]);
      loadRecent();
    } catch (err) {
      error('Checkout failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispensing & Sales</h1>
          <p className="page-subtitle">Dispense medicines, record sales, and track revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search medicine to dispense…" value={search} onChange={(e) => searchMedicines(e.target.value)} className="input pl-10" />
            </div>
            {results.length > 0 && (
              <div className="mt-3 divide-y divide-gray-100 border rounded-lg overflow-hidden">
                {results.map((m) => (
                  <div key={m._id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.category} · Stock: {m.quantity} · Price: {formatCurrency(m.unitPrice)}</p>
                    </div>
                    <button onClick={() => addToCart(m)} disabled={m.quantity <= 0} className="btn btn-primary btn-sm">
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header"><h2 className="text-lg font-semibold text-gray-900">Today's Transactions</h2></div>
            <div className="card-body p-0">
              <div className="table-container">
                <table>
                  <thead>
                    <tr><th>Medicine</th><th>Quantity</th><th className="text-right">Total</th></tr>
                  </thead>
                  <tbody>
                    {recentSales.map((s) => (
                      <tr key={s._id}>
                        <td>{s.medicineName}</td>
                        <td>{s.quantity}</td>
                        <td className="text-right font-semibold">{formatCurrency(s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-4 space-y-4 h-fit">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-teal-600" /> Active Bill
          </h2>
          {cart.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Cart is empty</p>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.medicineId} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCurrency(item.quantity * item.unitPrice)}</span>
                    <button onClick={() => setCart(cart.filter((c) => c.medicineId !== item.medicineId))} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t flex justify-between font-bold text-lg">
                <span>Total:</span><span>{formatCurrency(total)}</span>
              </div>
              <button onClick={checkout} disabled={submitting} className="btn btn-primary w-full justify-center">
                {submitting ? 'Processing…' : 'Complete Dispense'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- SETTINGS ---
function Settings() {
  const { user, changePassword, setPin, clearPin, hasPin } = useAuth();
  const { success, error } = useToast();
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pinVal, setPinVal] = useState('');
  const [pinEnabled, setPinEnabled] = useState(hasPin());

  const handlePassword = async (e) => {
    e.preventDefault();
    try {
      await changePassword(currentPwd, newPwd);
      success('Password updated', 'Your password was changed');
      setCurrentPwd('');
      setNewPwd('');
    } catch (err) {
      error('Password error', err.message);
    }
  };

  const handleTogglePin = async () => {
    if (pinEnabled) {
      clearPin();
      setPinEnabled(false);
      success('PIN disabled', 'PIN lock has been turned off');
    } else {
      if (!pinVal) return error('PIN required', 'Enter 4-8 digits for your PIN');
      const res = await setPin(pinVal);
      if (res.ok) {
        setPinEnabled(true);
        setPinVal('');
        success('PIN enabled', 'PIN lock is now active');
      } else {
        error('Invalid PIN', res.message);
      }
    }
  };

  const handleBackupExport = async () => {
    try {
      const data = await api.backup.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pharmatrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      success('Backup saved', 'Downloaded complete JSON backup');
    } catch (err) {
      error('Backup failed', err.message);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Security</h1>
          <p className="page-subtitle">Manage preferences, PIN lock, and data backup</p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-teal-600" /> Change Password</h2>
        <form onSubmit={handlePassword} className="space-y-3">
          <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Current Password" className="input" required />
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New Password (min 6 chars)" className="input" minLength={6} required />
          <button type="submit" className="btn btn-primary">Update Password</button>
        </form>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Lock className="w-5 h-5 text-teal-600" /> Fast PIN Lock</h2>
        <p className="text-sm text-gray-500">Lock access to PharmaTrack with a quick 4-8 digit numeric PIN.</p>
        {!pinEnabled ? (
          <div className="flex gap-2 max-w-sm">
            <input type="password" value={pinVal} onChange={(e) => setPinVal(e.target.value)} placeholder="Enter 4-8 digit PIN" className="input" />
            <button onClick={handleTogglePin} className="btn btn-primary">Enable PIN</button>
          </div>
        ) : (
          <button onClick={handleTogglePin} className="btn btn-danger">Disable PIN Lock</button>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Database className="w-5 h-5 text-teal-600" /> Backup & Export</h2>
        <p className="text-sm text-gray-500">Download a full JSON backup of medicines, sales history, and audit stock logs.</p>
        <button onClick={handleBackupExport} className="btn btn-secondary"><Download className="w-4 h-4" /> Download Full Backup (JSON)</button>
      </div>
    </div>
  );
}

// ============================================================================
// 6. MAIN APPLICATION ROOT & MOUNTING
// ============================================================================
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="medicines/new" element={<MedicineForm />} />
            <Route path="medicines/:id/edit" element={<MedicineForm />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="sales" element={<Sales />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;

// Auto-mount to #root when loaded as standalone module
if (typeof document !== 'undefined') {
  const container = document.getElementById('root');
  if (container && !window.__PHARMATRACK_MOUNTED__) {
    window.__PHARMATRACK_MOUNTED__ = true;
    ReactDOM.createRoot(container).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>
    );
  }
}