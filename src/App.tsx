import { useState, useEffect, useMemo } from 'react';
import { MapPin, Compass, Search, Loader2, Sparkles, Navigation, Filter, Map as MapIcon, ChevronDown, List, Locate } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { findHiddenGems } from './services/geminiService';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface GemMarker {
  name: string;
  lat: number;
  lng: number;
}

function MapEvents({ setCenter }: { setCenter: (pos: { lat: number; lng: number }) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      setCenter({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gems, setGems] = useState<string | null>(null);
  const [markers, setMarkers] = useState<GemMarker[]>([]);
  const [status, setStatus] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Filters
  const [minKm, setMinKm] = useState(0);
  const [maxKm, setMaxKm] = useState(5);
  const [minRating, setMinRating] = useState(4.5);
  const [maxReviews, setMaxReviews] = useState(200);
  const [vibe, setVibe] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [mapCenterPos, setMapCenterPos] = useState<{ lat: number; lng: number } | null>(null);

  const categories = [
    { id: 'all', label: 'All', icon: Sparkles },
    { id: 'food', label: 'Cuisine', icon: Navigation },
    { id: 'garden', label: 'Nature', icon: Compass },
    { id: 'scenic', label: 'Scenic', icon: MapPin },
  ];

  const getLocation = () => {
    setLoading(true);
    setError(null);
    setStatus('Pinpointing your location...');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setMapCenterPos({ lat: latitude, lng: longitude });
        handleSearch(latitude, longitude);
      },
      (err) => {
        setError('Location access required for discovery.');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  };

  const handleSearch = async (lat: number, lng: number) => {
    setLoading(true);
    setStatus('Unveiling local secrets...');
    try {
      const { text, groundingMetadata } = await findHiddenGems(
        lat, 
        lng, 
        minKm, 
        maxKm, 
        category, 
        minRating, 
        maxReviews, 
        vibe
      );
      const coordMatch = text.match(/COORDINATES:\s*(\[.*\])/s);
      if (coordMatch) {
        try {
          const parsedMarkers = JSON.parse(coordMatch[1]);
          setMarkers(parsedMarkers);
        } catch (e) {
          console.error("Failed to parse coordinates", e);
        }
      }
      const displayText = text.replace(/COORDINATES:\s*\[.*\]/s, '').trim();
      setGems(displayText);
    } catch (err) {
      console.error(err);
      setError('The secrets remain hidden. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const recenterMap = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setMapCenterPos({ lat: latitude, lng: longitude });
      },
      (err) => console.error(err),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  };

  const mapCenter = useMemo<[number, number]>(() => {
    if (location) return [location.lat, location.lng];
    return [0, 0];
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="atmosphere" />
      
      {/* Header */}
      <header className="px-6 py-8 md:px-12 flex justify-between items-center z-[1000]">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
            <Compass className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-serif font-black tracking-tighter text-white uppercase">Gems</h1>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.2em] transition-all border ${showFilters ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
        </motion.div>
      </header>

      {/* Filters Overlay */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="z-[999] relative"
          >
            <div className="mx-6 md:mx-12 mb-8 glass-panel rounded-3xl p-8 grid md:grid-cols-3 gap-10">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/50">Discovery Radius</label>
                  <span className="text-sm font-serif italic text-amber-200">{maxKm}km</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={maxKm} 
                  onChange={(e) => setMaxKm(parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                
                <div className="flex justify-between items-center pt-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/50">Min Rating</label>
                  <span className="text-sm font-serif italic text-amber-200">{minRating}★</span>
                </div>
                <input 
                  type="range" 
                  min="3" 
                  max="5" 
                  step="0.1"
                  value={minRating} 
                  onChange={(e) => setMinRating(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/50">The Vibe</label>
                <input 
                  type="text"
                  placeholder="e.g. cozy, industrial, quiet..."
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-colors text-white placeholder:text-white/20"
                />
                
                <div className="flex justify-between items-center pt-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/50">Max Reviews</label>
                  <span className="text-sm font-serif italic text-amber-200">{maxReviews}</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="1000" 
                  step="10"
                  value={maxReviews} 
                  onChange={(e) => setMaxReviews(parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/50">Category</label>
                <div className="flex flex-wrap gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${category === cat.id ? 'bg-amber-500 border-amber-500 text-black' : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'}`}
                    >
                      <cat.icon className="w-3 h-3" />
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow container mx-auto px-6 py-12 max-w-6xl relative z-10">
        <AnimatePresence mode="wait">
          {!gems && !loading && (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="text-center space-y-12 py-20"
            >
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block p-8 rounded-full bg-amber-500/5 border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.1)]"
              >
                <Sparkles className="w-16 h-16 text-amber-400" />
              </motion.div>
              
              <div className="space-y-6">
                <h2 className="text-6xl md:text-8xl font-serif font-black leading-[0.9] tracking-tighter text-white">
                  Seek the <br />
                  <span className="text-amber-500 italic font-light">Unseen.</span>
                </h2>
                <p className="text-lg text-white/40 max-w-xl mx-auto font-light leading-relaxed tracking-wide">
                  High ratings. Low review counts. <br />
                  The world's best kept secrets, revealed for you.
                </p>
              </div>
              
              <div className="pt-12">
                <button
                  onClick={getLocation}
                  className="group relative inline-flex items-center gap-4 px-12 py-6 bg-white text-black rounded-full text-xs font-black uppercase tracking-[0.3em] overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                >
                  <span className="relative z-10">Begin Discovery</span>
                  <Navigation className="w-4 h-4 transition-all group-hover:rotate-45" />
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-amber-500/80 text-xs font-black uppercase tracking-widest"
                >
                  {error}
                </motion.p>
              )}
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 space-y-10"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 rounded-full border-t-2 border-r-2 border-amber-500/50 border-l-2 border-l-transparent border-b-2 border-b-transparent"
                />
                <Compass className="w-10 h-10 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-3xl font-serif italic text-amber-200">{status}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-[0.4em]">Consulting the ancient maps</p>
              </div>
            </motion.div>
          )}

          {gems && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-12 pb-20"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/10 pb-10">
                <div className="space-y-3">
                  <h2 className="text-5xl font-serif font-black text-white tracking-tighter">Secrets Revealed</h2>
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest text-amber-400">
                      {category}
                    </span>
                    <span className="text-white/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <MapPin className="w-3 h-3" />
                      Within {maxKm}km
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/5 border border-white/10">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    <List className="w-3.5 h-3.5" /> List
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'map' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    <MapIcon className="w-3.5 h-3.5" /> Map
                  </button>
                </div>
              </div>

              <div className="grid gap-12">
                {viewMode === 'list' ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass-panel p-10 md:p-16 rounded-[40px]"
                  >
                    <div className="markdown-body max-w-none">
                      <Markdown>{gems}</Markdown>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="h-[700px] rounded-[40px] overflow-hidden border border-white/10 shadow-2xl z-0 relative group/map"
                  >
                    <button 
                      onClick={recenterMap}
                      className="absolute top-6 right-6 z-[1000] w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all"
                      title="Recenter to my location"
                    >
                      <Locate className="w-6 h-6" />
                    </button>
                    <button 
                      onClick={() => {
                        if (mapCenterPos) handleSearch(mapCenterPos.lat, mapCenterPos.lng);
                      }}
                      className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 bg-amber-500 text-black rounded-full flex items-center gap-2 shadow-2xl hover:scale-105 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <Search className="w-4 h-4" /> Search this area
                    </button>
                    <MapContainer 
                      center={mapCenter} 
                      zoom={13} 
                      style={{ height: '100%', width: '100%', filter: 'invert(90%) hue-rotate(180deg) brightness(95%) contrast(90%)' }}
                    >
                      <MapEvents setCenter={setMapCenterPos} />
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      />
                      <ChangeView center={mapCenter} zoom={13} />
                      
                      {location && (
                        <Marker position={[location.lat, location.lng]}>
                          <Popup>Your current position</Popup>
                        </Marker>
                      )}

                      {markers.map((marker, idx) => (
                        <Marker key={idx} position={[marker.lat, marker.lng]}>
                          <Popup>
                            <div className="font-serif font-bold text-lg">{marker.name}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-1">Hidden Gem</div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </motion.div>
                )}
              </div>

              <div className="glass-panel p-12 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden relative group">
                <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative z-10 space-y-5">
                  <h3 className="text-4xl font-serif italic text-white">The journey is the reward.</h3>
                  <p className="text-white/50 max-w-md font-light leading-relaxed">
                    Go where others don't. See what others miss. 
                    Your discovery awaits in the shadows of the mainstream.
                  </p>
                </div>
                <button 
                  onClick={() => {
                    if (location) handleSearch(location.lat, location.lng);
                  }}
                  className="relative z-10 px-10 py-5 bg-amber-500 text-black rounded-full text-xs font-black uppercase tracking-[0.3em] hover:scale-105 transition-transform shadow-[0_0_30px_rgba(245,158,11,0.3)]"
                >
                  Seek Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5">
        <div className="container mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-amber-500/50" />
              <span className="text-xs font-black uppercase tracking-[0.5em] text-white/40">Hidden Gems</span>
            </div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest">Unveiling the world's best kept secrets</p>
          </div>
          
          <div className="flex gap-12 text-[10px] font-black uppercase tracking-[0.3em] text-white/30">
            <a href="#" className="hover:text-amber-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-amber-400 transition-colors">Archive</a>
          </div>
          
          <p className="text-[10px] text-white/10 uppercase tracking-[0.4em]">
            © 2024 Discovery Collective
          </p>
        </div>
      </footer>
    </div>
  );
}
