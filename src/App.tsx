import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Coffees, { CoffeeForm, CoffeeDetail } from './pages/Coffees';
import BrewLog from './pages/BrewLog';
import BrewForm from './pages/BrewForm';
import BrewDetail from './pages/BrewDetail';
import Analytics from './pages/Analytics';
import Recipes, { RecipeForm, RecipeDetail } from './pages/Recipes';
import WaterRecipes, { WaterRecipeForm, WaterRecipeDetail } from './pages/WaterRecipes';
import Settings from './pages/Settings';
import Compare from './pages/Compare';
import Roasters from './pages/Roasters';
import Learnings from './pages/Learnings';
import CoffeeReadiness from './pages/CoffeeReadiness';

function AppRoutes() {
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-brew-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brew-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-brew-muted text-sm">Loading your journal…</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/coffees" element={<Coffees />} />
        <Route path="/coffees/new" element={<CoffeeForm />} />
        <Route path="/coffees/:id" element={<CoffeeDetail />} />
        <Route path="/coffees/:id/edit" element={<CoffeeForm />} />
        <Route path="/brews" element={<BrewLog />} />
        <Route path="/brews/new" element={<BrewForm />} />
        <Route path="/brews/:id/edit" element={<BrewForm />} />
        <Route path="/brews/:id" element={<BrewDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/recipes" element={<Recipes />} />
        <Route path="/recipes/new" element={<RecipeForm />} />
        <Route path="/recipes/:id" element={<RecipeDetail />} />
        <Route path="/recipes/:id/edit" element={<RecipeForm />} />
        <Route path="/water-recipes" element={<WaterRecipes />} />
        <Route path="/water-recipes/new" element={<WaterRecipeForm />} />
        <Route path="/water-recipes/:id" element={<WaterRecipeDetail />} />
        <Route path="/water-recipes/:id/edit" element={<WaterRecipeForm />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/learnings" element={<Learnings />} />
        <Route path="/readiness" element={<CoffeeReadiness />} />
        <Route path="/roasters" element={<Roasters />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
