import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DraftRoom from './pages/DraftRoom';
import GameRoom from './pages/GameRoom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/draft/:roomCode" element={<DraftRoom />} />
        <Route path="/game/:roomCode" element={<GameRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
