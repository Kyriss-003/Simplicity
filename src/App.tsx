import { AuthGate } from './components/AuthGate';
import HomeScreen from './screens/HomeScreen';

export default function App() {
  return (
    <AuthGate>
      <HomeScreen />
    </AuthGate>
  );
}
