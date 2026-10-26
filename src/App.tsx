import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ShopSettingsProvider } from "@/contexts/ShopSettingsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { useDynamicTheme } from "@/hooks/useDynamicTheme";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import POSTerminal from "./pages/pos/POSTerminal";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Users from "./pages/admin/Users";
import Branches from "./pages/admin/Branches";
import Settings from "./pages/admin/Settings";
import ShopSettings from "./pages/admin/ShopSettings";
import InventoryManagement from "./pages/inventory/InventoryManagement";
import StockMovements from "./pages/inventory/StockMovements";
import Suppliers from "./pages/operations/Suppliers";
import Returns from "./pages/operations/Returns";
import SalesReports from "./pages/reports/SalesReports";
import NotFound from "./pages/NotFound";
import ProfitReport from "./pages/reports/ProfitReport";
import TaxSettings from "./pages/admin/TaxSettings";
import ExpiryAgeing from "./pages/inventory/ExpiryAgeing";
import StockTransfers from "./pages/inventory/StockTransfers";
import BulkImport from "./pages/admin/BulkImport";
import Stores from "./pages/platform/Stores";
import Profile from "./pages/Profile";
import Creditors from "./pages/operations/Creditors";

const queryClient = new QueryClient();

// Component to apply dynamic theme
function ThemeProvider({ children }: { children: React.ReactNode }) {
  useDynamicTheme();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ShopSettingsProvider>
            <ThemeProvider>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/pos" element={<POSTerminal />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/branches" element={<Branches />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/shop-settings" element={<ShopSettings />} />
                  <Route path="/inventory" element={<InventoryManagement />} />
                  <Route path="/stock-movements" element={<StockMovements />} />
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/returns" element={<Returns />} />
                  <Route path="/reports" element={<SalesReports />} />
                  <Route path="/profit" element={<ProfitReport />} />
                  <Route path="/tax-settings" element={<TaxSettings />} />
                  <Route path="/expiry" element={<ExpiryAgeing />} />
                  <Route path="/stock-transfers" element={<StockTransfers />} />
                  <Route path="/bulk-import" element={<BulkImport />} />
                  <Route path="/stores" element={<Stores />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/creditors" element={<Creditors />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ThemeProvider>
          </ShopSettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
