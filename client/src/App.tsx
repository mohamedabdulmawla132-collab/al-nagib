import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Purchase from "./pages/Purchase";
import StudentLesson from "./pages/StudentLesson";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherLogin from "./pages/TeacherLogin";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/teacher-login" component={TeacherLogin} />
      <Route path="/teacher" component={TeacherDashboard} />
      <Route path="/student/:id" component={StudentLesson} />
      <Route path="/purchase" component={Purchase} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
