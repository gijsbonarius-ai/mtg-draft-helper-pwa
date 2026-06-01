import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import DraftRoom from './pages/DraftRoom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/draft/:roomCode" element={<DraftRoom />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
