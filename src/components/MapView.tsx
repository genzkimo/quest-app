import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  MapPin, 
  Compass, 
  Search, 
  X, 
  Layers,
  Info,
  BookMarked,
  Maximize2,
  Minimize2,
  Target,
  Shield,
  Award,
  MessageSquare,
  Lock,
  RefreshCw
} from 'lucide-react';
import { Quest, UserProfile } from '../types';
import { calculateBookingFee } from '../utils/fee';
import { motion, AnimatePresence } from 'motion/react';
import PullToRefresh from './PullToRefresh';
import { db } from '../utils/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { translations } from '../data/translations';
import { playLockAndLoadCoins, triggerHaptic } from '../utils/audio';
import UnifiedQuestCard from './UnifiedQuestCard';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocator } from '../utils/geolocator';

interface MapViewProps {
  quests: Quest[];
  userProfile: UserProfile;
  lang: 'ar' | 'fr' | 'en';
  onBookQuest: (questId: string, bookingFee: number) => void;
  showToast: (msg: string) => void;
  navigatingQuest: Quest | null;
  setNavigatingQuest: (quest: Quest | null) => void;
  onArrivedAtQuest: (questId: string) => void;
  onViewQuestDetail?: (id: string) => void;
  onManageQuest?: (questId: string) => void;
  onExtendPendingQuest?: (questId: string) => void;
  onExtendActiveContract?: (questId: string) => void;
  mapSelectedQuest?: Quest | null;
  setMapSelectedQuest?: (quest: Quest | null) => void;
  onCloseMap?: () => void;
  setQuests?: (quests: Quest[]) => void;
}

export default function MapView({ 
  quests, 
  userProfile, 
  lang, 
  onBookQuest, 
  showToast,
  navigatingQuest,
  setNavigatingQuest,
  onArrivedAtQuest,
  onViewQuestDetail,
  onManageQuest,
  onExtendPendingQuest,
  onExtendActiveContract,
  mapSelectedQuest,
  setMapSelectedQuest,
  onCloseMap,
  setQuests
}: MapViewProps) {
  const [gpsActive, setGpsActive] = useState(false);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(() => {
    return Geolocator.getCachedLocation();
  }); 
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [pinnedQuest, setPinnedQuest] = useState<Quest | null>(null);
  const [userLocAccuracy, setUserLocAccuracy] = useState<number | null>(null);
  const [isGpsLost, setIsGpsLost] = useState<boolean>(false);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastLocUpdateTimeRef = useRef<number>(0);
  const updateCountRef = useRef<number>(0);

  useEffect(() => {
    if (selectedQuest) {
      setPinnedQuest(selectedQuest);
    }
  }, [selectedQuest]);

  useEffect(() => {
    if (navigatingQuest) {
      setPinnedQuest(navigatingQuest);
    }
  }, [navigatingQuest]);

  const handleRefresh = async () => {
    try {
      const questsQuery = query(collection(db, 'quests'), orderBy('createdAt', 'desc'), limit(300));
      const questsSnapshot = await getDocs(questsQuery);
      const fetchedQuests: Quest[] = [];
      questsSnapshot.forEach((doc) => {
        fetchedQuests.push({ id: doc.id, ...doc.data() } as any);
      });
      if (setQuests && fetchedQuests.length > 0) {
        setQuests(fetchedQuests);
      }
      showToast(lang === 'ar' ? '🗺️ تم تحديث كويستات الخريطة بنجاح!' : '🗺️ Map quests refreshed successfully!');
    } catch (error) {
      console.error("Failed to refresh quests in MapView:", error);
      showToast(lang === 'ar' ? '⚠️ فشل تحديث بيانات الخريطة.' : '⚠️ Failed to update map data.');
    }
  };
  
  // Automatically select quest passed from home or other views
  useEffect(() => {
    if (mapSelectedQuest) {
      setSelectedQuest(mapSelectedQuest);
      if (setMapSelectedQuest) {
        setMapSelectedQuest(null);
      }
    }
  }, [mapSelectedQuest, setMapSelectedQuest]);

  const [searchQuery, setSearchQuery] = useState('');
  const [maxDistance, setMaxDistance] = useState(1200); // 1205km acts as national coverage
  const [isLocating, setIsLocating] = useState(false);
  const [simulatedDistance, setSimulatedDistance] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [navProgress, setNavProgress] = useState(0); // 0.0 to 1.0
  const [navStartLoc, setNavStartLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [hasCenteredGPS, setHasCenteredGPS] = useState(false);
  const [showDetailedSheet, setShowDetailedSheet] = useState<Quest | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isGpsServiceEnabled, setIsGpsServiceEnabled] = useState(true);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [hiddenArrivedQuestIds, setHiddenArrivedQuestIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('hidden_arrived_quest_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleHideArrivedQuest = (questId: string) => {
    setHiddenArrivedQuestIds(prev => {
      const updated = [...prev, questId];
      try {
        localStorage.setItem('hidden_arrived_quest_ids', JSON.stringify(updated));
      } catch (e) {
        console.warn("Error saving hidden arrived quest:", e);
      }
      return updated;
    });
    showToast(lang === 'ar' ? '👁️‍🗨️ تم إخفاء المهمة المكتملة الوصول بنجاح!' : '👁️‍🗨️ Arrived quest hidden successfully!');
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Map state and clustering refs
  const [mapZoom, setMapZoom] = useState<number>(6);
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Feature 5 states
  const [travelMode, setTravelMode] = useState<'driving' | 'cycling' | 'walking'>('walking');
  const [lockedRoutePoints, setLockedRoutePoints] = useState<[number, number][]>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<boolean>(false);
  const isFetchingRouteRef = useRef<boolean>(false);
  const lastRouteFetchKeyRef = useRef<string>('');

  const getDeterministicOffset = useCallback((id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latOffset = ((Math.abs(hash) % 100) / 10000) - 0.005;
    const lngOffset = (((Math.abs(hash) >> 8) % 100) / 10000) - 0.005;
    return { latOffset, lngOffset };
  }, []);

  const isLocationAuthorized = useCallback((quest: Quest) => {
    const isApprovedAndActive = (quest.helperId === userProfile.id || quest.assignedRunnerId === userProfile.id || quest.assignedRunnerIds?.includes(userProfile.id)) && quest.status !== 'completed';
    return quest.creatorId === userProfile.id || isApprovedAndActive;
  }, [userProfile.id]);

  const getQuestCoords = useCallback((quest: Quest) => {
    if (!quest) return { lat: 36.7538, lng: 3.0588 };
    const qLat = quest.lat ?? (quest as any)?.gpsCoords?.lat ?? 36.7538;
    const qLng = quest.lng ?? (quest as any)?.gpsCoords?.lng ?? 3.0588;
    if (isLocationAuthorized(quest)) {
      return { lat: qLat, lng: qLng };
    }
    const offset = getDeterministicOffset(quest.id);
    return { lat: qLat + offset.latOffset, lng: qLng + offset.lngOffset };
  }, [isLocationAuthorized, getDeterministicOffset]);

  // Synchronically listen to Geolocator status shifts via event listener without continuous polling loops
  useEffect(() => {
    const handleGpsSync = async () => {
      const enabled = await Geolocator.isLocationServiceEnabled();
      setIsGpsServiceEnabled(enabled);
    };
    handleGpsSync();

    const handleGpsStatusEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.enabled === 'boolean') {
        setIsGpsServiceEnabled(detail.enabled);
      }
    };
    window.addEventListener('gps_status_changed', handleGpsStatusEvent);
    return () => {
      window.removeEventListener('gps_status_changed', handleGpsStatusEvent);
    };
  }, []);

  // Decoupled camera state & interaction management refs to prevent resetting camera on data subscription updates
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const isUserInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<any>(null);
  const userHasMovedCameraRef = useRef(false);

  // When a quest is being navigated, trigger fullscreen automatically and initialize navigation tracking
  useEffect(() => {
    if (navigatingQuest) {
      setIsFullScreen(true);
      if (gpsActive && userLoc) {
        setNavStartLoc({ lat: userLoc.lat, lng: userLoc.lng });
      }
      setNavProgress(0);
    }
  }, [navigatingQuest, gpsActive, userLoc]);

  // Lock the real GPS coordinates as navigation start point as soon as GPS is confirmed active
  useEffect(() => {
    if (navigatingQuest && gpsActive && userLoc) {
      setNavStartLoc({ lat: userLoc.lat, lng: userLoc.lng });
    }
  }, [navigatingQuest, gpsActive, userLoc]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const lastGpsUpdateTimeRef = useRef<number>(0);

  // Calculate degree heading/angle between two coordinates
  const calculateHeadingDegree = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dy = lat2 - lat1;
    const dx = Math.cos(lat1 * Math.PI / 180) * (lng2 - lng1);
    const angleRad = Math.atan2(dx, dy);
    let angleDeg = angleRad * 180 / Math.PI;
    if (angleDeg < 0) {
      angleDeg += 360;
    }
    return Math.round(angleDeg);
  };

  // Exit Navigation handler
  const handleExitNavigation = () => {
    setNavigatingQuest(null);
    setNavProgress(0);
    if (!gpsActive) {
      setUserLoc(null);
    }
    showToast(lang === 'ar' ? '🛑 تم الخروج من وضع الملاحة والرجوع للاستكشاف العادي.' : '🛑 Exited guidance mode. Returning to map explorer.');
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const calculateDistanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371; // Earth major radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // in meters
  };

  const getDistanceToPolyline = (lat: number, lng: number, points: [number, number][]) => {
    if (!points || points.length === 0) return Infinity;
    let minDistance = Infinity;
    for (const pt of points) {
      const d = calculateDistanceMeters(lat, lng, pt[0], pt[1]);
      if (d < minDistance) {
        minDistance = d;
      }
    }
    return minDistance;
  };

  // Route locking logic: Lock route once, recalculate ONLY on travel mode toggling or if user drifts > 100 meters
  useEffect(() => {
    if (!navigatingQuest) {
      if (lockedRoutePoints.length > 0) {
        setLockedRoutePoints([]);
        lastRouteFetchKeyRef.current = '';
      }
      return;
    }

    // Do not fetch or generate the route until the GPS is active/verified!
    if (!gpsActive || !userLoc) {
      return;
    }

    const startCoords = userLoc;
    const endCoords = getQuestCoords(navigatingQuest);
    const fetchKey = `${navigatingQuest.id}_${travelMode}_${startCoords.lat.toFixed(3)}_${startCoords.lng.toFixed(3)}_${endCoords.lat.toFixed(3)}_${endCoords.lng.toFixed(3)}`;

    const fetchRoutePath = async (start: { lat: number; lng: number }, end: { lat: number; lng: number }, mode: 'driving' | 'cycling' | 'walking') => {
      if (!start || !end || isNaN(start.lat) || isNaN(start.lng) || isNaN(end.lat) || isNaN(end.lng)) {
        console.warn("Invalid coordinates provided to fetchRoutePath:", start, end);
        return;
      }

      if (isFetchingRouteRef.current) return;
      if (lastRouteFetchKeyRef.current === fetchKey && lockedRoutePoints.length > 0) return;

      isFetchingRouteRef.current = true;
      lastRouteFetchKeyRef.current = fetchKey;
      setIsCalculatingRoute(true);

      const profiles = mode === 'walking' 
        ? ['foot', 'driving', 'cycling'] 
        : mode === 'cycling' 
        ? ['cycling', 'driving', 'foot'] 
        : ['driving', 'foot', 'cycling'];

      let fetchedPoints: [number, number][] | null = null;

      for (const profile of profiles) {
        const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&alternatives=false&geometries=geojson`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data && data.code === 'Ok' && data.routes && data.routes[0]) {
              const coords = data.routes[0].geometry.coordinates;
              if (Array.isArray(coords) && coords.length > 0) {
                fetchedPoints = coords.map((c: any) => [c[1], c[0]] as [number, number]);
                break;
              }
            }
          }
        } catch (err: any) {
          console.warn(`OSRM Route fetch failure for ${profile}:`, err?.message || err);
        }
      }

      if (fetchedPoints && fetchedPoints.length > 0) {
        setLockedRoutePoints(fetchedPoints);
      } else {
        // Guaranteed fallback if all OSRM servers are offline
        setLockedRoutePoints([[start.lat, start.lng], [end.lat, end.lng]]);
      }

      isFetchingRouteRef.current = false;
      setIsCalculatingRoute(false);
    };

    if (lockedRoutePoints.length === 0) {
      // First route locking
      fetchRoutePath(userLoc, endCoords, travelMode);
      return;
    }

    // Measure actual routing drift distance in meters
    const currentDrift = getDistanceToPolyline(userLoc.lat, userLoc.lng, lockedRoutePoints);

    // If drift is larger than 100 meters, trigger Route Re-calculation (Rerouting)
    if (currentDrift > 100 && !isFetchingRouteRef.current) {
      showToast(
        lang === 'ar'
          ? `🔄 تم الانحراف عن المسار بـ ${Math.round(currentDrift)}م.. جاري تحديث المسار!`
          : `🔄 Drifted ${Math.round(currentDrift)}m from path (>100m). Recalculating route!`
      );
      fetchRoutePath(userLoc, endCoords, travelMode);
    }
  }, [userLoc?.lat, userLoc?.lng, navigatingQuest?.id, travelMode, lockedRoutePoints.length, gpsActive, getQuestCoords]);

  // Synchronize dynamic position mapping closer to target along the locked route (only in simulation when GPS is inactive)
  useEffect(() => {
    if (navigatingQuest && !gpsActive) {
      if (lockedRoutePoints.length > 0) {
        const totalPoints = lockedRoutePoints.length;
        const indexFloat = (totalPoints - 1) * navProgress;
        const lowerIndex = Math.floor(indexFloat);
        const upperIndex = Math.min(totalPoints - 1, Math.ceil(indexFloat));
        const factor = indexFloat - lowerIndex;
        
        const p1 = lockedRoutePoints[lowerIndex];
        const p2 = lockedRoutePoints[upperIndex];
        if (p1 && p2) {
          const lat = p1[0] + (p2[0] - p1[0]) * factor;
          const lng = p1[1] + (p2[1] - p1[1]) * factor;
          setUserLoc({ lat, lng });
        }
      } else if (navStartLoc) {
        const coords = getQuestCoords(navigatingQuest);
        const targetLat = coords.lat;
        const targetLng = coords.lng;
        const currentLat = navStartLoc.lat + (targetLat - navStartLoc.lat) * navProgress;
        const currentLng = navStartLoc.lng + (targetLng - navStartLoc.lng) * navProgress;
        setUserLoc({ lat: currentLat, lng: currentLng });
      }
    }
  }, [navProgress, navigatingQuest, navStartLoc, lockedRoutePoints, getQuestCoords, gpsActive]);

  // Auto-resize trigger for Leaflet when toggling full-screen mode
  useEffect(() => {
    if (mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isFullScreen]);

  const dict = translations[lang];
  const isRtl = lang === 'ar';

  // Visible quests: include open & pending quests for public discovery + booked/active quests for involved users
  const visibleQuests = useMemo(() => {
    return quests.filter(q => {
      if (q.status === 'completed' || q.status === 'cancelled' || q.status === 'cancelled_by_timeout' || q.status === 'stale_cleared') return false;

      // Requirement 2: Hide tasks that workers have arrived at from everyone EXCEPT the worker who arrived
      if (q.status === 'arrived') {
        const isArrivedWorker = q.helperId === userProfile.id || 
                               q.assignedRunnerId === userProfile.id || 
                               q.assignedRunnerIds?.includes(userProfile.id);
        if (!isArrivedWorker) return false;
        if (hiddenArrivedQuestIds.includes(q.id)) return false;
        return true;
      }

      if (q.status === 'open' || q.status === 'pending_verification') return true;
      const isUserInvolved = q.creatorId === userProfile.id || 
                             q.helperId === userProfile.id || 
                             q.assignedRunnerId === userProfile.id || 
                             q.assignedRunnerIds?.includes(userProfile.id);
      return isUserInvolved;
    });
  }, [quests, userProfile.id, hiddenArrivedQuestIds]);

  const startGpsWatch = useCallback(() => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsLocating(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        const currentCount = updateCountRef.current;

        // First 3 location updates are fast (unthrottled) to guarantee rapid high-accuracy lock.
        // After 3 updates, throttle updates to once every 10 seconds (10,000ms).
        if (currentCount >= 3) {
          if (lastLocUpdateTimeRef.current > 0 && now - lastLocUpdateTimeRef.current < 10000) {
            return;
          }
        }

        lastLocUpdateTimeRef.current = now;
        updateCountRef.current = currentCount + 1;

        const fetchedLoc = { 
          lat: position.coords.latitude, 
          lng: position.coords.longitude 
        };
        const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : 25;
        setUserLoc(fetchedLoc);
        setUserLocAccuracy(accuracy);
        setGpsActive(true);
        setIsLocating(false);
        setHasCenteredGPS(true);
        setGpsDenied(false);
        setIsGpsServiceEnabled(true);
        setIsGpsLost(false);
        Geolocator.saveCachedLocation(fetchedLoc.lat, fetchedLoc.lng);
      },
      (error) => {
        console.warn("Geolocation watch update error:", error);
        setIsLocating(false);
        if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
          setIsGpsLost(true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  }, []);

  const triggerGPSGet = (isManualReset = false) => {
    setIsLocating(true);
    if (isManualReset) {
      // Reset update count on manual reset/re-center button so user gets 3 fast updates again
      updateCountRef.current = 0;
      lastLocUpdateTimeRef.current = Date.now();
    }
    startGpsWatch();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const now = Date.now();
          const currentCount = updateCountRef.current;

          if (!isManualReset && currentCount >= 3 && lastLocUpdateTimeRef.current > 0 && now - lastLocUpdateTimeRef.current < 10000) {
            setIsLocating(false);
            return;
          }

          lastLocUpdateTimeRef.current = now;
          if (currentCount < 3) {
            updateCountRef.current = currentCount + 1;
          }

          const fetchedLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
          const accuracy = position.coords.accuracy ? Math.round(position.coords.accuracy) : 25;
          setUserLoc(fetchedLoc);
          setUserLocAccuracy(accuracy);
          setGpsActive(true);
          setIsLocating(false);
          setHasCenteredGPS(true);
          setGpsDenied(false);
          setIsGpsServiceEnabled(true);
          setIsGpsLost(false);
          Geolocator.saveCachedLocation(fetchedLoc.lat, fetchedLoc.lng);

          if (isManualReset) {
            userHasMovedCameraRef.current = false;
            setIsUserInteracting(false);
            isUserInteractingRef.current = false;
            if (mapInstanceRef.current) {
              mapInstanceRef.current.flyTo([fetchedLoc.lat, fetchedLoc.lng], 15, { animate: true, duration: 1 });
            }
            showToast(lang === 'ar' ? '📍 تم تحديد موقعك الفعلي بدقة عالية وتوسيط الخريطة!' : '📍 Live high-accuracy GPS position synced & centered!');
          }
        },
        (error) => {
          console.warn("Geolocation single acquisition failed:", error);
          setIsLocating(false);
          setIsGpsLost(true);
          if (error.code === error.PERMISSION_DENIED) {
            setGpsActive(false);
            setGpsDenied(true);
            setIsGpsServiceEnabled(false);
            showToast(lang === 'ar' ? '⚠️ تم رفض إذن الـ GPS' : '⚠️ GPS permission denied');
          } else {
            setIsGpsServiceEnabled(true);
            setGpsDenied(false);
            showToast(lang === 'ar' ? '⚠️ جاري البحث عن إشارة الـ GPS، يمكنك تصفح الخريطة بحرية' : '⚠️ Acquiring GPS signal, feel free to browse the map');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
    } else {
      setIsLocating(false);
      setGpsActive(false);
      setGpsDenied(true);
      showToast(lang === 'ar' ? '⚠️ الـ GPS غير مدعوم في هذا المتصفح' : '⚠️ GPS is not supported in this browser');
    }
  };

  const calculateDistanceKm = useCallback((qLat?: number, qLng?: number) => {
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') return 0;
    if (typeof qLat !== 'number' || typeof qLng !== 'number') return 0;
    const R = 6371; // Earth major radius in km
    const dLat = (qLat - userLoc.lat) * Math.PI / 180;
    const dLng = (qLng - userLoc.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(qLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return parseFloat(dist.toFixed(1));
  }, [userLoc?.lat, userLoc?.lng]);

  const calculateDistanceKmRaw = useCallback((qLat?: number, qLng?: number) => {
    if (!userLoc || typeof userLoc.lat !== 'number' || typeof userLoc.lng !== 'number') return 0;
    if (typeof qLat !== 'number' || typeof qLng !== 'number') return 0;
    const R = 6371; // Earth major radius in km
    const dLat = (qLat - userLoc.lat) * Math.PI / 180;
    const dLng = (qLng - userLoc.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLoc.lat * Math.PI / 180) * Math.cos(qLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, [userLoc?.lat, userLoc?.lng]);

  const filteredMapQuests = useMemo(() => {
    return visibleQuests.filter(quest => {
      const coords = getQuestCoords(quest);
      const km = calculateDistanceKm(coords.lat, coords.lng);
      const matchesDistance = maxDistance >= 1200 ? true : km <= maxDistance;
      const matchesSearch = searchQuery === '' || 
                            quest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            quest.location.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesDistance && matchesSearch;
    });
  }, [visibleQuests, getQuestCoords, calculateDistanceKm, maxDistance, searchQuery]);


  useEffect(() => {
    if (selectedQuest && gpsActive) {
      const coords = getQuestCoords(selectedQuest);
      const km = calculateDistanceKm(coords.lat, coords.lng);
      if (km < 1) {
        setSimulatedDistance(lang === 'ar' ? `${Math.round(km * 1000)} متر` : `${Math.round(km * 1000)} meters`);
      } else {
        setSimulatedDistance(lang === 'ar' ? `${km} كم` : `${km} km`);
      }
    } else {
      setSimulatedDistance(null);
    }
  }, [selectedQuest, userLoc, gpsActive]);

  // Handle Book Quest inside Map Modal or popup trigger
  const handleMapBookClick = (quest: Quest) => {
    // Strict GPS Location check: Booking requires active GPS location
    if (gpsDenied || !gpsActive || !userLoc) {
      showToast(
        lang === 'ar' 
          ? '⚠️ لا يمكن حجز الكويست إلا بعد تفعيل خدمة تحديد الموقع (GPS)' 
          : '⚠️ Cannot book quest without enabling GPS location service'
      );
      triggerGPSGet(true);
      return;
    }

    const fee = calculateBookingFee(quest.cashReward);
    if (userProfile.tokenBalance < fee) {
      showToast(lang === 'ar' ? '⚡ رصيد استخدام غير كافٍ لدفع رسوم الحجز (5% من المكافأة، الحد الأدنى 35 د.ج والحد الأقصى 2000 د.ج). الرصيد يستخدم فقط لدفع رسوم استخدام منصة Quest مثل نشر أو حجز المهام.' : '⚡ Insufficient usage balance for booking platform fee (5% fee, min 35 DA, max 2000 DA). Balance is strictly used to pay Quest platform usage fees.');
      return;
    }

    onBookQuest(quest.id, fee);
    setSelectedQuest(null);

    showToast(lang === 'ar' 
      ? '🚀 تم التقديم والطلب بنجاح! في انتظار موافقة صاحب العمل لتفعيل العقد وبدء تتبع المسار المباشر ⏳' 
      : '🚀 Applied successfully! Awaiting creator approval to activate the contract and launch active GPS routing ⏳');

    const audioEnabled = userProfile.audioEffectsEnabled !== false;
    const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
    playLockAndLoadCoins(audioEnabled);
    triggerHaptic('sharp', hapticEnabled);
  };

  // Permission-aware GPS initialization & online/offline recovery
  useEffect(() => {
    Geolocator.getPermissionState().then((perm) => {
      if (perm === 'granted' || userLoc) {
        setIsGpsServiceEnabled(true);
        setGpsDenied(false);
        triggerGPSGet(true);
      } else if (perm === 'denied') {
        setIsGpsServiceEnabled(false);
        setGpsDenied(true);
      } else {
        // 'prompt' mode: allow map interaction freely and attempt silent GPS request
        setIsGpsServiceEnabled(true);
        setGpsDenied(false);
        triggerGPSGet(true);
      }
    });

    const gpsIntervalId = setInterval(() => {
      Geolocator.getPermissionState().then((perm) => {
        if (perm === 'granted') {
          triggerGPSGet(false);
        }
      });
    }, 10000);

    const handleOffline = () => {
      setIsGpsLost(true);
      showToast(lang === 'ar' ? '⚠️ انقطع الاتصال بالشبكة والـ GPS' : '⚠️ Network / GPS signal lost');
    };

    const handleOnline = () => {
      setIsGpsLost(false);
      startGpsWatch();
      triggerGPSGet(false);
      showToast(lang === 'ar' ? '🟢 تم استعادة اتصال الـ GPS بنجاح!' : '🟢 GPS signal recovered successfully!');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(gpsIntervalId);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [startGpsWatch, lang]);

  // Initialize map container once
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [34.0, 3.5], // Centered beautifully at macro national level over Algeria
        zoom: 6, // View the entire national map at startup
        zoomControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true
      });

      setMapZoom(map.getZoom());

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        maxNativeZoom: 19,
        keepBuffer: 10,
        updateWhenZooming: false,
        updateWhenIdle: true,
        crossOrigin: true
      }).addTo(map);

      // Listen to user map interactions to set flags and prevent snapping
      const handleUserInteractionStart = () => {
        setIsUserInteracting(true);
        isUserInteractingRef.current = true;
        userHasMovedCameraRef.current = true; // Flag that camera position should NOT auto-reset in background
        if (interactionTimeoutRef.current !== null) {
          window.clearTimeout(interactionTimeoutRef.current);
          interactionTimeoutRef.current = null;
        }
      };

      const handleUserInteractionEnd = () => {
        if (interactionTimeoutRef.current !== null) {
          window.clearTimeout(interactionTimeoutRef.current);
        }
        interactionTimeoutRef.current = window.setTimeout(() => {
          setIsUserInteracting(false);
          isUserInteractingRef.current = false;
        }, 5000); // Wait 5 seconds of absolute stillness
      };

      map.on('dragstart', handleUserInteractionStart);
      map.on('zoomstart', handleUserInteractionStart);
      map.on('dragend', handleUserInteractionEnd);
      map.on('zoomend', () => {
        setMapZoom(map.getZoom());
        handleUserInteractionEnd();
      });
      map.on('touchstart', handleUserInteractionStart);
      map.on('touchend', handleUserInteractionEnd);
      map.on('mousedown', handleUserInteractionStart);
      map.on('mouseup', handleUserInteractionEnd);

      mapInstanceRef.current = map;
    }

    // Rule 1 & 3: Map mounts silently without triggering location alerts. GPS queries are action-triggered.

    return () => {
      if (interactionTimeoutRef.current !== null) {
        window.clearTimeout(interactionTimeoutRef.current);
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('dragstart');
        mapInstanceRef.current.off('zoomstart');
        mapInstanceRef.current.off('dragend');
        mapInstanceRef.current.off('zoomend');
        mapInstanceRef.current.off('touchstart');
        mapInstanceRef.current.off('touchend');
        mapInstanceRef.current.off('mousedown');
        mapInstanceRef.current.off('mouseup');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Center on selected quest when it changes
  useEffect(() => {
    if (selectedQuest && mapInstanceRef.current && !isUserInteractingRef.current) {
      const coords = getQuestCoords(selectedQuest);
      mapInstanceRef.current.setView([coords.lat, coords.lng], Math.max(12, mapInstanceRef.current.getZoom()));
    }
  }, [selectedQuest, getQuestCoords]);

  // Update map center smoothly when user position is updated, adapting to fit bounds if navigating
  useEffect(() => {
    if (mapInstanceRef.current) {
      if (navigatingQuest) {
        // Only run automatic fitBounds if the user isn't interacting right now and GPS is verified
        if (!isUserInteractingRef.current) {
          const navCoords = getQuestCoords(navigatingQuest);
          if (gpsActive && userLoc) {
            const bounds = L.latLngBounds([
              [userLoc.lat, userLoc.lng],
              [navCoords.lat, navCoords.lng]
            ]);
            mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60] });
          } else {
            // If GPS is not active yet, only center on the quest marker so we don't snap to Algiers fallback!
            mapInstanceRef.current.setView([navCoords.lat, navCoords.lng], 13);
          }
        }
      } else if (hasCenteredGPS && gpsActive && userLoc) {
        // ONLY auto-center/zoom if the user is NOT interacting and hasn't manually adjusted their map view
        if (!isUserInteractingRef.current && !userHasMovedCameraRef.current) {
          mapInstanceRef.current.setView([userLoc.lat, userLoc.lng], 13);
        }
      }
    }
  }, [userLoc, navigatingQuest, hasCenteredGPS, gpsActive, getQuestCoords]);

  // Sync markers for Active quests on database change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // A map of desired markers to place on the map
    const desiredMarkers = new Map<string, { latlng: L.LatLngExpression; icon: L.DivIcon; onClick?: () => void }>();

    // Add User Current Location pulsing radar icon
    if (gpsActive && userLoc) {
      const userIcon = L.divIcon({
        className: 'user-marker-glow',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 bg-[#4FC3F7]/30 rounded-full animate-ping"></div>
            <div class="absolute w-16 h-16 bg-[#4FC3F7]/10 rounded-full animate-pulse"></div>
            <div class="w-4.5 h-4.5 bg-[#4FC3F7] border-2 border-white rounded-full shadow-[0_0_10px_rgba(79,195,247,0.8)]"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      desiredMarkers.set('user_loc', {
        latlng: [userLoc.lat, userLoc.lng],
        icon: userIcon
      });
    }

    // Add Active Destination Target pin
    if (navigatingQuest) {
      const navCoords = getQuestCoords(navigatingQuest);
      const destinationIcon = L.divIcon({
        className: 'destination-marker-glow',
        html: `
          <div class="relative flex flex-col items-center justify-center cursor-pointer">
            <div class="absolute -inset-1.5 bg-[#FF3B7C]/40 rounded-full animate-ping"></div>
            <div class="absolute -inset-3 bg-[#FF3B7C]/15 rounded-full animate-pulse"></div>
            <div class="w-10 h-10 bg-slate-950 border-2 border-[#FF3B7C] rounded-full shadow-[0_0_15px_rgba(255,59,124,0.9)] flex items-center justify-center z-20 text-md hover:scale-110 transition duration-200">
              🎯
            </div>
            <span class="bg-[#FF3B7C] text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap mt-1 font-mono uppercase tracking-wider z-25">
              ${lang === 'ar' ? 'الوجهة النشطة' : 'ACTIVE TARGET'}
            </span>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
      });
      desiredMarkers.set('nav_dest', {
        latlng: [navCoords.lat, navCoords.lng],
        icon: destinationIcon,
        onClick: () => {
          setSelectedQuest(navigatingQuest);
          const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
          triggerHaptic('soft', hapticEnabled);
        }
      });
    }

    // Add Selected or Pinned Quest pin with pulsing ring and high-contrast styling (never disappears when details sheet closes)
    const targetQuest = selectedQuest || pinnedQuest;
    if (targetQuest && (!navigatingQuest || targetQuest.id !== navigatingQuest.id)) {
      const selCoords = getQuestCoords(targetQuest);
      const selectedIcon = L.divIcon({
        className: `custom-selected-pin-${targetQuest.id}`,
        html: `
          <div class="relative flex flex-col items-center">
            <div class="absolute -inset-1.5 bg-gradient-to-r from-[#FFD34D] to-[#FF3B7C] opacity-60 rounded-full animate-ping"></div>
            <div class="p-2 rounded-full shadow-2xl border border-white bg-slate-950 text-white hover:scale-110 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFD34D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <span class="bg-[#FFD34D] text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full mt-1 shadow-lg whitespace-nowrap border border-white">
              ${targetQuest.cashReward} DA
            </span>
          </div>
        `,
        iconSize: [38, 48],
        iconAnchor: [19, 44]
      });

      desiredMarkers.set(`selected_quest_${targetQuest.id}`, {
        latlng: [selCoords.lat, selCoords.lng],
        icon: selectedIcon,
        onClick: () => {
          setSelectedQuest(targetQuest);
          const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
          triggerHaptic('soft', hapticEnabled);
        }
      });
    }

    // Filter quests that aren't actively navigated, selected, or pinned
    const questsToPlot = filteredMapQuests.filter(quest => 
      !(navigatingQuest && navigatingQuest.id === quest.id) &&
      !(targetQuest && targetQuest.id === quest.id)
    );

    // Calculate dynamic distance threshold for clustering based on zoom level
    const zoom = mapZoom;
    let clusterRadiusDeg = 0;
    if (zoom <= 4) clusterRadiusDeg = 1.6;
    else if (zoom === 5) clusterRadiusDeg = 1.1;
    else if (zoom === 6) clusterRadiusDeg = 0.65;
    else if (zoom === 7) clusterRadiusDeg = 0.38;
    else if (zoom === 8) clusterRadiusDeg = 0.19;
    else if (zoom === 9) clusterRadiusDeg = 0.095;
    else if (zoom === 10) clusterRadiusDeg = 0.048;
    else if (zoom === 11) clusterRadiusDeg = 0.024;
    else if (zoom === 12) clusterRadiusDeg = 0.012;
    else if (zoom === 13) clusterRadiusDeg = 0.006;
    else if (zoom === 14) clusterRadiusDeg = 0.003;
    else clusterRadiusDeg = 0; // Zoom 15+ has no clustering

    interface Cluster {
      id: string;
      lat: number;
      lng: number;
      quests: Quest[];
    }

    const clusters: Cluster[] = [];

    if (clusterRadiusDeg > 0) {
      questsToPlot.forEach(quest => {
        const coords = getQuestCoords(quest);
        let foundCluster = false;
        for (const cluster of clusters) {
          const dist = Math.sqrt(Math.pow(coords.lat - cluster.lat, 2) + Math.pow(coords.lng - cluster.lng, 2));
          if (dist < clusterRadiusDeg) {
            cluster.quests.push(quest);
            // Average center calculation
            const count = cluster.quests.length;
            cluster.lat = ((count - 1) * cluster.lat + coords.lat) / count;
            cluster.lng = ((count - 1) * cluster.lng + coords.lng) / count;
            foundCluster = true;
            break;
          }
        }
        if (!foundCluster) {
          clusters.push({
            id: `cluster_${quest.id}`,
            lat: coords.lat,
            lng: coords.lng,
            quests: [quest]
          });
        }
      });
    } else {
      questsToPlot.forEach(quest => {
        const coords = getQuestCoords(quest);
        clusters.push({
          id: `quest_${quest.id}`,
          lat: coords.lat,
          lng: coords.lng,
          quests: [quest]
        });
      });
    }

    // Populate desiredMarkers based on clusters list
    clusters.forEach(cluster => {
      if (cluster.quests.length === 1) {
        const quest = cluster.quests[0];
        const isUrgent = quest.urgency === 'urgent';
        
        const pinIcon = L.divIcon({
          className: `custom-leaf-pin-${quest.id}`,
          html: `
            <div class="relative flex flex-col items-center">
              ${isUrgent ? '<div class="absolute -inset-1.5 bg-[#FF3B7C]/40 rounded-full animate-ping"></div>' : ''}
              <div class="p-2 rounded-full shadow-lg border-2 border-white transition-all text-white ${
                isUrgent ? 'bg-[#FF3B7C]' : 'bg-[#FFD34D] text-[#1F2A44]'
              }">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <span class="bg-slate-950/90 border border-slate-700 text-[8px] font-black text-white px-1.5 py-0.5 rounded mt-0.5 shadow-md whitespace-nowrap">
                ${quest.cashReward} DA
              </span>
            </div>
          `,
          iconSize: [36, 48],
          iconAnchor: [18, 44]
        });

        desiredMarkers.set(`quest_${quest.id}`, {
          latlng: [cluster.lat, cluster.lng],
          icon: pinIcon,
          onClick: () => {
            setSelectedQuest(quest);
            const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
            triggerHaptic('soft', hapticEnabled);
          }
        });
      } else {
        const count = cluster.quests.length;
        let size = 40;
        let colorClass = 'bg-slate-900 border-[#FFD34D] text-[#FFD34D]';
        if (count > 50) {
          size = 56;
          colorClass = 'bg-red-950 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
        } else if (count > 10) {
          size = 48;
          colorClass = 'bg-amber-950 border-amber-500 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.4)]';
        } else {
          size = 40;
          colorClass = 'bg-slate-900 border-[#FFD34D] text-white shadow-[0_0_8px_rgba(255,211,77,0.3)]';
        }

        const clusterIcon = L.divIcon({
          className: `custom-cluster-${cluster.id}`,
          html: `
            <div class="relative flex items-center justify-center" style="width: ${size}px; height: ${size}px;">
              <div class="absolute inset-0 rounded-full animate-pulse opacity-20 bg-current"></div>
              <div class="w-full h-full rounded-full border-2 flex items-center justify-center font-mono font-black text-xs ${colorClass}">
                ${count}
              </div>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        desiredMarkers.set(cluster.id, {
          latlng: [cluster.lat, cluster.lng],
          icon: clusterIcon,
          onClick: () => {
            map.setView([cluster.lat, cluster.lng], Math.min(18, map.getZoom() + 2));
            const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
            triggerHaptic('soft', hapticEnabled);
          }
        });
      }
    });

    // 1. Remove unwanted markers
    for (const [key, marker] of markersMapRef.current.entries()) {
      if (!desiredMarkers.has(key)) {
        marker.remove();
        markersMapRef.current.delete(key);
      }
    }

    // 2. Add or update existing markers
    for (const [key, data] of desiredMarkers.entries()) {
      const existingMarker = markersMapRef.current.get(key);
      if (existingMarker) {
        existingMarker.setLatLng(data.latlng);
        const prevHtml = (existingMarker as any)._customIconHtml;
        const newHtml = data.icon.options.html;
        if (prevHtml !== newHtml) {
          existingMarker.setIcon(data.icon);
          (existingMarker as any)._customIconHtml = newHtml;
        }
        existingMarker.off('click');
        if (data.onClick) {
          existingMarker.on('click', data.onClick);
        }
      } else {
        const newMarker = L.marker(data.latlng, { icon: data.icon }).addTo(map);
        (newMarker as any)._customIconHtml = data.icon.options.html;
        if (data.onClick) {
          newMarker.on('click', data.onClick);
        }
        markersMapRef.current.set(key, newMarker);
      }
    }

    // Update GPS Accuracy Circle on Map
    if (gpsActive && userLoc && userLocAccuracy && userLocAccuracy > 0) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([userLoc.lat, userLoc.lng]);
        accuracyCircleRef.current.setRadius(userLocAccuracy);
      } else {
        accuracyCircleRef.current = L.circle([userLoc.lat, userLoc.lng], {
          radius: userLocAccuracy,
          color: '#4FC3F7',
          fillColor: '#4FC3F7',
          fillOpacity: 0.15,
          weight: 1.5,
          dashArray: '4, 4'
        }).addTo(map);
      }
    } else if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    // Update Polyline
    const navCoords = navigatingQuest ? getQuestCoords(navigatingQuest) : null;
    const shouldShowPolyline = !!(navigatingQuest && gpsActive && userLoc && navCoords);
    const plinePoints: L.LatLngExpression[] = shouldShowPolyline
      ? (lockedRoutePoints.length > 0
          ? [[userLoc!.lat, userLoc!.lng], ...lockedRoutePoints] as L.LatLngExpression[]
          : [
              [userLoc!.lat, userLoc!.lng],
              [navCoords!.lat, navCoords!.lng]
            ]
        )
      : [];

    if (shouldShowPolyline) {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(plinePoints);
      } else {
        const pline = L.polyline(plinePoints, {
          color: '#FF3B7C',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'pulsing-routing-path'
        }).addTo(map);
        polylineRef.current = pline;
      }
    } else {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
    }
  }, [filteredMapQuests, gpsActive, userLoc, userLocAccuracy, lang, navigatingQuest, selectedQuest, lockedRoutePoints, travelMode, mapZoom, userProfile.hapticFeedbackEnabled, getQuestCoords]);

  const remainingDistance = useMemo(() => {
    if (!navigatingQuest) return 0;
    const coords = getQuestCoords(navigatingQuest);
    return calculateDistanceKm(coords.lat, coords.lng);
  }, [navigatingQuest, calculateDistanceKm, getQuestCoords]);

  const remainingDistanceRaw = useMemo(() => {
    if (!navigatingQuest) return Infinity;
    const coords = getQuestCoords(navigatingQuest);
    return calculateDistanceKmRaw(coords.lat, coords.lng);
  }, [navigatingQuest, calculateDistanceKmRaw, getQuestCoords]);

  const isWithinGeofence = true; // Bypassed physical distance constraint so confirming arrival is always available on map guidance
  
  const etaMinutes = useMemo(() => {
    if (!navigatingQuest) return 0;
    let etaFactor = 12; // default walking 5km/h
    if (travelMode === 'driving') {
      etaFactor = 1.5; // car ~40km/h
    } else if (travelMode === 'cycling') {
      etaFactor = 3; // bike/motorcycle ~20km/h
    }
    return Math.max(1, Math.round(remainingDistance * etaFactor));
  }, [navigatingQuest, travelMode, remainingDistance]);

  const currentHeading = useMemo(() => {
    if (!navigatingQuest || !navStartLoc || !userLoc) return 0;
    const coords = getQuestCoords(navigatingQuest);
    return calculateHeadingDegree(userLoc.lat, userLoc.lng, coords.lat, coords.lng);
  }, [navigatingQuest, navStartLoc, userLoc?.lat, userLoc?.lng, getQuestCoords]);

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      lang={lang}
      audioEffectsEnabled={userProfile?.audioEffectsEnabled !== false}
      hapticFeedbackEnabled={userProfile?.hapticFeedbackEnabled !== false}
    >
      <div className="space-y-4 pb-12 h-[calc(100vh-140px)] flex flex-col" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {/* Dynamic routing line animations */}
      <style>{`
        @keyframes routingPulseAnim {
          to {
            stroke-dashoffset: -20;
          }
        }
        .pulsing-routing-path {
          stroke-dasharray: 10, 10;
          animation: routingPulseAnim 1.2s linear infinite !important;
        }
      `}</style>

      {/* Horizontal search & distance parameter controls */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 flex flex-col md:flex-row gap-3 shadow-sm shrink-0">
        <div className="relative flex-1">
          <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5`} />
          <input 
            type="text" 
            placeholder={lang === 'ar' ? "ابحث عن مهام على الخريطة..." : "Search coordinates pins..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-2.5 bg-gray-50 border border-gray-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#1F2A44]`}
          />
        </div>

        {/* Proximity range adjust */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-150 px-4 py-2 rounded-2xl text-xs font-semibold">
          <span className="text-gray-500 shrink-0">{lang === 'ar' ? 'نطاق البحث:' : 'Search Range:'}</span>
          <input 
            type="range" 
            min="5" 
            max="1200" 
            step="5"
            value={maxDistance}
            onChange={(e) => setMaxDistance(parseInt(e.target.value))}
            className="w-24 md:w-32 accent-[#FF3B7C] h-1.5 bg-gray-200 rounded-lg cursor-pointer"
          />
          <span className="text-[#FF3B7C] font-mono font-black shrink-0">
            {maxDistance >= 1200 ? (lang === 'ar' ? 'كل الجزائر 🇩🇿' : 'All Algeria 🇩🇿') : `${maxDistance} km`}
          </span>
        </div>

        {/* Satellite trigger */}
        <button 
          onClick={triggerGPSGet}
          disabled={isLocating}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-[#1F2A44] hover:bg-[#1F2A44]/90 text-white cursor-pointer transition-all duration-200 shadow-sm shrink-0"
        >
          <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'GPS Telemetry...' : dict.bountyHunterTitle}</span>
        </button>


      </div>

      {/* Styled Map Area wrapper */}
      <div className={
        isFullScreen 
          ? "fixed inset-0 w-screen h-screen bg-slate-900 z-[9999] overflow-hidden" 
          : "flex-1 bg-slate-900 border border-slate-800 rounded-3xl relative overflow-hidden shadow-inner min-h-[350px]"
      }>
        {/* Leaflet interactive Map container element */}
        <div 
          ref={mapContainerRef} 
          className="absolute inset-0 w-full h-full z-10 transition-all duration-300" 
        />

        {/* GPS Signal Loss Recovery Notification Banner - Positioned cleanly below top header bar (z-[10020]) */}
        {isGpsLost && (
          <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-[10020] w-[90%] max-w-md bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl text-xs font-black shadow-2xl flex items-center justify-center gap-2 border-2 border-amber-300 animate-bounce">
            <RefreshCw className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
            <span className="text-center leading-tight">
              {lang === 'ar'
                ? '⚠️ انقطع اتصال الـ GPS — جاري المحاولة واستعادة الإشارة تلقائياً...'
                : '⚠️ GPS Signal Lost — Auto-reconnecting continuously...'}
            </span>
          </div>
        )}

        {/* Immediate Orange Notice Banner when Location Services are Disabled or Inactive */}
        {(gpsDenied || !isGpsServiceEnabled || (!gpsActive && !userLoc)) && (
          <div className="absolute top-20 md:top-24 left-1/2 -translate-x-1/2 z-[10020] w-[92%] max-w-md bg-amber-500 text-slate-950 border-2 border-amber-300 p-4 rounded-2xl shadow-2xl flex flex-col items-center text-center gap-3 animate-in fade-in duration-100">
            <div className="flex items-center gap-2 text-slate-950 font-black text-xs">
              <MapPin className="w-4 h-4 text-slate-950 animate-bounce" />
              <span>{lang === 'ar' ? 'تحديد الموقع (GPS) غير مفعّل على الهاتف 📍' : 'Phone GPS Location Disabled 📍'}</span>
            </div>
            <p className="text-[11px] font-extrabold text-slate-900 leading-snug">
              {lang === 'ar'
                ? 'يرجى تفعيل خدمة تحديد الموقع (GPS) من الهاتف وتسهيل الوصول لتحديد موقعك واستعراض المهام القريبة.'
                : 'Please enable GPS location services from phone system settings to pinpoint position & view tasks.'}
            </p>
            <button
              onClick={async () => {
                setIsLocating(true);
                try {
                  await Geolocator.openLocationSettings();
                  const accurate = await Geolocator.getAccuratePhysicalLocation();
                  const newLoc = { lat: accurate.lat, lng: accurate.lng };
                  setUserLoc(newLoc);
                  setUserLocAccuracy(Math.round(accurate.accuracy));
                  setGpsActive(true);
                  setGpsDenied(false);
                  setIsGpsServiceEnabled(true);
                  setIsGpsLost(false);
                  Geolocator.saveCachedLocation(newLoc.lat, newLoc.lng);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([newLoc.lat, newLoc.lng], 15, { animate: true, duration: 1 });
                  }
                  showToast(lang === 'ar' ? '🎯 تم تفعيل خدمة الموقع وتحديد موقعك على الخريطة بنجاح!' : '🎯 GPS enabled & position centered!');
                } catch (err) {
                  console.warn("MapView location request error:", err);
                  setGpsDenied(true);
                  setIsGpsServiceEnabled(false);
                  alert(
                    lang === 'ar'
                      ? '⚠️ يرجى تفعيل الـ GPS والتأكد من السماح بالوصول للموقع من إعدادات الهاتف'
                      : '⚠️ Please enable GPS and allow location access in phone settings'
                  );
                } finally {
                  setIsLocating(false);
                }
              }}
              disabled={isLocating}
              className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 active:scale-95 text-amber-400 rounded-xl text-xs font-black shadow-lg cursor-pointer transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLocating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>{lang === 'ar' ? 'جاري الفحص والاستدعاء من النظام...' : 'Requesting System GPS...'}</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>{lang === 'ar' ? '⚡ تشغيل خدمة الموقع من النظام وتحديد موقعي 📍' : '⚡ Enable System GPS & Center Location 📍'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Full-screen Toggle FAB and Top Region Action Bar */}
        {isFullScreen ? (
          <div className="absolute top-0 left-0 right-0 z-[10005] bg-slate-950/80 backdrop-blur-md p-4 flex items-center justify-between border-b border-slate-800">
            {/* Left section: App name or state */}
            <div className="flex items-center gap-2 select-none">
              <span className="w-2.5 h-2.5 bg-[#FF3B7C] rounded-full animate-pulse"></span>
              <span className="text-[10px] text-slate-300 font-black tracking-widest uppercase">
                {lang === 'ar' ? 'خريطة المهام المباشرة 🇩🇿' : 'LIVE QUEST MAP'}
              </span>
            </div>

            {/* Right section: Dedicated Prominent red close FAB button */}
            <button
              id="close-map-button"
              onClick={() => {
                if (onCloseMap) {
                  onCloseMap();
                }
                const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                triggerHaptic('soft', hapticEnabled);
              }}
              className="bg-red-600 hover:bg-red-700 text-white p-2.5 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer border border-red-500"
              title={lang === 'ar' ? 'إغلاق الخريطة والعودة' : 'Close Map'}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setIsFullScreen(true);
              const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
              triggerHaptic('soft', hapticEnabled);
            }}
            className="absolute top-4 left-4 z-[45] bg-white hover:bg-slate-50 text-slate-850 p-3 rounded-2xl shadow-xl border border-gray-150 backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 font-black text-xs uppercase"
            style={{ direction: 'ltr' }}
          >
            <Maximize2 className="w-4 h-4 text-[#FF3B7C]" />
            <span className="hidden md:inline text-[10px] text-slate-850">{lang === 'ar' ? 'ملء الشاشة' : 'Full Screen'}</span>
          </button>
        )}

        {/* Floating Assistant Controls (أزرار المساعدة العائمة) */}
        <motion.div 
          animate={isMobile ? {
            top: isFullScreen ? '80px' : '16px',
            right: '16px',
            bottom: 'auto',
            y: 0
          } : {
            top: '50%',
            y: '-50%',
            right: '16px',
            bottom: 'auto'
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute z-[45] flex flex-col gap-2"
        >
          {/* Recenter GPS */}
          <button
            onClick={() => {
              triggerGPSGet(true);
              const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
              triggerHaptic('soft', hapticEnabled);
            }}
            title={lang === 'ar' ? 'تحديد الموقع الجغرافي (GPS)' : 'Get Live Position (GPS)'}
            className="w-11 h-11 bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-115 active:scale-90 border-2 border-white cursor-pointer flex-shrink-0 relative group"
            id="gps-recenter-target-button"
          >
            <Target className={`w-5.5 h-5.5 ${isLocating ? 'animate-pulse text-[#FFD34D]' : 'text-white'}`} />
            <span className="absolute right-14 bg-slate-900 text-white text-[9px] font-bold px-2.5 py-1 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {lang === 'ar' ? 'تحديد موقعي الميداني' : 'Snap Camera to GPS'}
            </span>
          </button>

          {/* Zoom In */}
          <button
            onClick={() => {
              handleZoomIn();
              const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
              triggerHaptic('soft', hapticEnabled);
            }}
            title={lang === 'ar' ? 'تكبير' : 'Zoom In'}
            className="w-11 h-11 bg-white hover:bg-slate-50 text-slate-850 rounded-full flex items-center justify-center shadow-xl border border-gray-150 font-black text-lg transition-all hover:scale-110 active:scale-95 cursor-pointer flex-shrink-0"
          >
            ＋
          </button>

          {/* Zoom Out */}
          <button
            onClick={() => {
              handleZoomOut();
              const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
              triggerHaptic('soft', hapticEnabled);
            }}
            title={lang === 'ar' ? 'تصغير' : 'Zoom Out'}
            className="w-11 h-11 bg-white hover:bg-slate-50 text-slate-850 rounded-full flex items-center justify-center shadow-xl border border-gray-150 font-black text-lg transition-all hover:scale-110 active:scale-95 cursor-pointer flex-shrink-0"
          >
            －
          </button>
        </motion.div>



        {/* Bottom sheet popup template for the selected Quest */}
        <AnimatePresence>
          {selectedQuest && (() => {
            const tokenAmount = calculateBookingFee(selectedQuest.cashReward);
            return (
              <motion.div
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 bg-slate-950/95 border border-slate-800 rounded-3xl p-4.5 shadow-2xl z-40 flex flex-col sm:flex-row gap-4 items-center justify-between cursor-pointer hover:bg-slate-900 transition-all duration-200 backdrop-blur-md"
                onClick={() => {
                  if (onViewQuestDetail) {
                    onViewQuestDetail(selectedQuest.id);
                  } else {
                    setShowDetailedSheet(selectedQuest);
                  }
                  const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                  triggerHaptic('sharp', hapticEnabled);
                }}
              >
                <div className="flex gap-3.5 items-center w-full sm:w-auto min-w-0">
                  <div className="w-11 h-11 bg-[#FF3B7C]/15 border border-[#FF3B7C]/30 text-[#FF3B7C] rounded-full flex items-center justify-center shrink-0">
                    <Target className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="space-y-1 min-w-0 text-start flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-black uppercase tracking-wider">
                      <span className="bg-white/10 text-[#FFD34D] px-2 py-0.5 rounded">
                        {selectedQuest.category}
                      </span>
                      {selectedQuest.urgency === 'urgent' && (
                        <span className="bg-[#FF3B7C] text-white px-2 py-0.5 rounded animate-pulse">
                          {lang === 'ar' ? 'عاجل جداً 🔥' : 'URGENT 🔥'}
                        </span>
                      )}
                      {simulatedDistance && (
                        <span className="bg-[#4FC3F7]/10 text-[#4FC3F7] px-2 py-0.5 rounded">
                          {simulatedDistance} {lang === 'ar' ? 'متبقية' : 'remaining'}
                        </span>
                      )}
                    </div>
                    <h4 className="font-extrabold text-white text-sm sm:text-base leading-snug truncate">
                      {selectedQuest.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-bold truncate flex items-center gap-1">
                      {isLocationAuthorized(selectedQuest) ? (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-[#4FC3F7]" />
                          {selectedQuest.location}
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          <span>{lang === 'ar' ? '🔒 الموقع مخفي حتى قبول الحجز وتفعيل العقد' : '🔒 Location hidden until booking approved'}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Compact bounty & Required safety locks tokens metrics */}
                <div className="flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0">
                  <div className="flex gap-4 font-mono text-center col-span-2">
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-extrabold block uppercase tracking-wider">{lang === 'ar' ? 'العائد النزيه' : 'BOUNTY'}</span>
                      <span className="text-sm font-black text-white">{selectedQuest.cashReward} DA</span>
                    </div>
                    <div className="border-l border-white/10 h-6"></div>
                    <div className="text-right">
                      <span className="text-[8px] text-slate-400 font-extrabold block uppercase tracking-wider">{lang === 'ar' ? 'الرموز المطلوبة' : 'REQUIRED TOKENS'}</span>
                      <span className="text-sm font-black text-[#FFD34D]">⚡ {tokenAmount}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 shrink-0 items-center">
                    {selectedQuest.status === 'arrived' && 
                     (selectedQuest.helperId === userProfile.id || selectedQuest.assignedRunnerId === userProfile.id || selectedQuest.assignedRunnerIds?.includes(userProfile.id)) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideArrivedQuest(selectedQuest.id);
                          setSelectedQuest(null);
                        }}
                        className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl hover:bg-amber-500 hover:text-slate-950 transition duration-200 select-none cursor-pointer flex items-center gap-1"
                      >
                        👁️‍🗨️ {lang === 'ar' ? 'اخفاء' : 'Hide'}
                      </button>
                    )}
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewQuestDetail) {
                          onViewQuestDetail(selectedQuest.id);
                        } else {
                          setShowDetailedSheet(selectedQuest);
                        }
                        const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                        triggerHaptic('sharp', hapticEnabled);
                      }}
                      className="bg-[#FF3B7C]/15 border border-[#FF3B7C]/25 text-[#FF3B7C] text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl hover:bg-[#FF3B7C] hover:text-white transition duration-200 select-none cursor-pointer"
                    >
                      {lang === 'ar' ? 'فتح التفاصيل 🎯' : 'Inspect 🎯'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedQuest(null);
                      }}
                      className="bg-white/5 hover:bg-white/15 text-slate-350 p-2 rounded-full transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Dynamic Navigation HUD Card */}
        <AnimatePresence>
          {navigatingQuest && (
            <motion.div
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              className="absolute bottom-4 left-4 right-4 bg-slate-950/95 text-white p-5 rounded-3xl border border-rose-500/40 shadow-2xl z-30 flex flex-col gap-4 backdrop-blur-md"
            >
              {/* Header Details with Compass and Travel Mode Selector */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3.5">
                <div className="flex items-center gap-3">
                  {/* 360 Rotation Compass guidance pointer */}
                  <div className="relative w-11 h-11 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <Compass 
                      className="w-5.5 h-5.5 text-rose-500 transition-transform duration-300 animate-pulse" 
                      style={{ transform: `rotate(${currentHeading}deg)` }} 
                    />
                    <span className="absolute -top-1.5 text-[7px] font-black tracking-widest text-rose-400">N</span>
                  </div>
                  
                  <div className="space-y-0.5 min-w-0 text-start">
                    <span className="text-[9px] text-rose-400 font-extrabold tracking-wider uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                      {lang === 'ar' ? 'نظام تتبع المسار المباشر' : 'SATELLITE NAVIGATION HUD'}
                    </span>
                    <h4 className="font-extrabold text-white text-xs sm:text-sm truncate max-w-[200px] sm:max-w-xs">{navigatingQuest.title}</h4>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{navigatingQuest.location}</p>
                  </div>
                </div>

                {/* Transportation Mode Select Panel (Feature 5) */}
                <div className="flex bg-slate-100/5 border border-white/5 rounded-xl p-1 gap-1 select-none w-full md:w-auto shrink-0 self-center">
                  <button
                    onClick={() => {
                      setTravelMode('driving');
                      const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                      triggerHaptic('soft', hapticEnabled);
                    }}
                    title={lang === 'ar' ? 'بالسيارة (Driving Mode)' : 'Car (Driving Mode)'}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                      travelMode === 'driving' 
                        ? 'bg-[#FF3B7C] text-white shadow-md shadow-[#FF3B7C]/20 font-black' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span>🚗</span>
                    <span>{lang === 'ar' ? 'سيارة' : 'CAR'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setTravelMode('cycling');
                      const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                      triggerHaptic('soft', hapticEnabled);
                    }}
                    title={lang === 'ar' ? 'بالدراجة النارية (Shortcuts & Motos)' : 'Moto (Shortcuts & Motos)'}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                      travelMode === 'cycling' 
                        ? 'bg-[#FF3B7C] text-white shadow-md shadow-[#FF3B7C]/20 font-black' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span>🏍️</span>
                    <span>{lang === 'ar' ? 'دراجة' : 'MOTO'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setTravelMode('walking');
                      const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                      triggerHaptic('soft', hapticEnabled);
                    }}
                    title={lang === 'ar' ? 'مشياً على الأقدام (Alleys & Narrow Paths)' : 'Pedestrian (Alleys & Narrow Paths)'}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                      travelMode === 'walking' 
                        ? 'bg-[#FF3B7C] text-white shadow-md shadow-[#FF3B7C]/20 font-black' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <span>🚶</span>
                    <span>{lang === 'ar' ? 'مشياً' : 'WALK'}</span>
                  </button>
                </div>
              </div>

              {/* Navigation Data Indicators and Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-6 font-mono text-center w-full sm:w-auto justify-around sm:justify-start">
                  <div className="text-start sm:text-center">
                    <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">{lang === 'ar' ? 'المسافة المتبقية' : 'DISTANCE'}</span>
                    <span className="text-sm font-black text-rose-400">{remainingDistance} km</span>
                  </div>
                  <div className="border-l border-white/10 h-8 self-center"></div>
                  <div className="text-start sm:text-center">
                    <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider animate-pulse">
                      {travelMode === 'driving' 
                        ? (lang === 'ar' ? 'وقت السيارة المقدر' : 'CAR ETA') 
                        : travelMode === 'cycling'
                          ? (lang === 'ar' ? 'وفت الدراجة المقدر' : 'MOTO ETA')
                          : (lang === 'ar' ? 'وقت المشي المقدر' : 'WALK ETA')
                      }
                    </span>
                    <span className="text-sm font-black text-[#FFD34D]">{etaMinutes} {lang === 'ar' ? 'دقيقة' : 'mins'}</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                  {isWithinGeofence ? (
                    <button
                      onClick={() => {
                        const hapticEnabled = userProfile.hapticFeedbackEnabled !== false;
                        triggerHaptic('sharp', hapticEnabled);
                        onArrivedAtQuest(navigatingQuest.id);
                      }}
                      className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-[#FFD34D] to-[#FF3B7C] hover:from-[#FFD34D]/90 hover:to-[#FF3B7C]/90 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF3B7C]/40 animate-pulse transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-white/20 uppercase tracking-wide"
                    >
                      <span>🏁 {lang === 'ar' ? 'وصلت! أرسل تنبيه الوصول الموثق' : 'Arrived! Confirm Arrival'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleExitNavigation}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 font-black text-xs rounded-xl hover:scale-105 active:scale-95 transition-all uppercase cursor-pointer border border-slate-700"
                      >
                        {lang === 'ar' ? 'إنهاء الملاحة' : 'Exit Guidance'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* DETAILED BOOKING FLOW PREVIEW OVERLAY SHEET */}
        <AnimatePresence>
          {showDetailedSheet && (() => {
            return (
              <div className="fixed inset-0 bg-[#1F2A44]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
                {/* Backdrop closer click hook */}
                <div 
                  className="absolute inset-0 cursor-pointer" 
                  onClick={() => setShowDetailedSheet(null)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  className="relative max-w-lg w-full z-10 p-2 sm:p-0"
                >
                  <div className="bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 relative antialiased animate-in fade-in zoom-in duration-200">
                    <UnifiedQuestCard 
                      quest={showDetailedSheet}
                      userProfile={userProfile}
                      userLoc={userLoc}
                      lang={lang}
                      isModal={true}
                      onClose={() => setShowDetailedSheet(null)}
                      onBookQuest={(questId, tokenFee) => {
                        onBookQuest(questId, tokenFee);
                        setShowDetailedSheet(null);
                      }}
                      onStartNavigation={(q) => {
                        setNavigatingQuest(q);
                        setShowDetailedSheet(null);
                      }}
                      onOpenChat={(chatParams) => {
                        const openChatEvent = new CustomEvent('open-chat', {
                          detail: chatParams
                        });
                        window.dispatchEvent(openChatEvent);
                        setShowDetailedSheet(null);
                      }}
                      onManageQuest={onManageQuest}
                      onExtendPendingQuest={onExtendPendingQuest}
                      onExtendActiveContract={onExtendActiveContract}
                      showToast={showToast}
                    />
                  </div>
                </motion.div>
              </div>
            );
            // Bypassed dead code
            const tokenAmount = calculateBookingFee(showDetailedSheet.cashReward);
            
            const galleryImages: string[] = [];
            if (showDetailedSheet.images && showDetailedSheet.images.length > 0) {
              galleryImages.push(...showDetailedSheet.images);
            } else if (showDetailedSheet.imageUrls && showDetailedSheet.imageUrls.length > 0) {
              galleryImages.push(...showDetailedSheet.imageUrls);
            } else if (showDetailedSheet.imageUrl) {
              galleryImages.push(showDetailedSheet.imageUrl);
            }

            const isBookedByMe = showDetailedSheet.helperId === userProfile.id && showDetailedSheet.status === 'booked';

            const getCategoryEquipment = (category: string) => {
              switch (category) {
                case 'صيانة':
                  return [
                    lang === 'ar' ? 'حقيبة أدوات الصيانة ومفاتيح الربط' : 'Maintenance tool bag & wrenches',
                    lang === 'ar' ? 'مفكات براغي متنوعة وشريط كهربائي واقٍ' : 'Assorted screwdrivers & insulating tape',
                    lang === 'ar' ? 'مصباح يدوي وقفازات أمان متينة للعمل الميداني' : 'Flashlight & sturdy work gloves'
                  ];
                case 'توصيل':
                  return [
                    lang === 'ar' ? 'وسيلة نقل مناسبة (دراجة نارية أو سيارة)' : 'Suitable transport vehicle (moto/car)',
                    lang === 'ar' ? 'حقيبة ظهر معزولة حرارياً لحماية الطلبات والسلع' : 'Insulated backpack for cargo protection',
                    lang === 'ar' ? 'خوذة حماية وهاتف مشحون للتواصل والملاحة' : 'Safety helmet & charged GPS phone'
                  ];
                case 'تعليم':
                  return [
                    lang === 'ar' ? 'جهاز كمبيوتر محمول أو كمبيوتر لوحي للشرح' : 'Laptop or tablet computer for explanation',
                    lang === 'ar' ? 'كراس الملاحظات وأقلام ملونة للتوضيح التفاعلي' : 'Notebook & colored explanation markers'
                  ];
                case 'تسوق':
                  return [
                    lang === 'ar' ? 'حقيبة تسوق قماشية صديقة للبيئة ومتينة' : 'Durable eco-friendly grocery bags',
                    lang === 'ar' ? 'قائمة الطلبات المكتوبة مسبقاً لمراجعة الأسعار دقيقة' : 'Detailed shopping items index'
                  ];
                case 'تقنية':
                  return [
                    lang === 'ar' ? 'جهاز لابتوب مجهز بأدوات التطوير والتحديث' : 'Developer laptop with specialized setups',
                    lang === 'ar' ? 'كابل شبكة RJ45 ومفاتيح تخزين USB' : 'RJ45 network ethernet cables & USB storage keys',
                    lang === 'ar' ? 'جهاز فحص الإشارة أو كود التفعيل المتاح' : 'Testing utility signal diagnostic dongles'
                  ];
                case 'رعاية أليفة':
                  return [
                    lang === 'ar' ? 'حزام قيادة متين وطوق مخصص للسلامة' : 'Durable leash & secure safety collar',
                    lang === 'ar' ? 'أكياس تجميع المخلفات ومطهر يدين' : 'Waste disposal pouches & hand sanitizers',
                    lang === 'ar' ? 'طعام حيوانات جاف ومكافآت تدريبية صغيرة' : 'Pet food treats for behavioral rewarding'
                  ];
                default:
                  return [
                    lang === 'ar' ? 'أدوات مخصصة ومعدات مناسبة لطبيعة الكويست' : 'Specific utility tools optimized for this role',
                    lang === 'ar' ? 'هاتف ذكي مفعل به نظام تحديد المواقع العالمي GPS' : 'Active GPS-enabled smartphone'
                  ];
              }
            };

            return (
              <div className="fixed inset-0 bg-[#1F2A44]/70 backdrop-blur-xs flex items-center justify-center p-4 z-[999] overflow-y-auto">
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col my-8"
                >
                  {/* Upper Header with prominent "X" close button to preserve map state */}
                  <div className="p-6 pb-4 relative flex flex-col items-start border-b border-gray-100 bg-linear-to-b from-gray-50/50 to-white">
                    <button
                      onClick={() => setShowDetailedSheet(null)}
                      className="absolute top-5 right-5 bg-slate-900 hover:bg-slate-800 text-white rounded-full p-2.5 w-10 h-10 shadow-lg flex items-center justify-center transition-all duration-200 active:scale-90 z-25 cursor-pointer text-base focus:outline-none"
                      title={lang === 'ar' ? 'العودة للخريطة' : 'Back to Map'}
                    >
                      <X className="w-5 h-5 font-black shrink-0" />
                    </button>

                    <div className="flex flex-wrap gap-2 mb-2 pr-12">
                      <span className="bg-[#1F2A44] text-[#FFD34D] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {showDetailedSheet.category}
                      </span>
                      {showDetailedSheet.urgency === 'urgent' && (
                        <span className="bg-[#FF3B7C] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                          {lang === 'ar' ? 'عاجل جداً 🔥' : 'Urgent 🔥'}
                        </span>
                      )}
                      {showDetailedSheet.urgency === 'featured' && (
                        <span className="bg-[#FFD34D] text-[#1F2A44] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                          ⭐ {lang === 'ar' ? 'مميز' : 'Featured'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug tracking-tight text-start mt-1 pr-10">
                      {showDetailedSheet.title}
                    </h3>
                  </div>

                  {/* Detailed Description, Interactive Gallery Grid & Required Equipment List */}
                  <div className="p-6 space-y-5 text-start w-full">
                    <div>
                      <h4 className="text-gray-400 font-bold text-[10px] uppercase mb-1.5">{lang === 'ar' ? 'تفاصيل المهمة بالكامل' : 'Quest Description Details'}</h4>
                      <p className="text-xs sm:text-sm text-gray-750 leading-relaxed font-bold bg-slate-50 p-4 rounded-2xl border border-gray-150/65 whitespace-pre-line text-start">
                        {showDetailedSheet.description}
                      </p>
                    </div>

                    {/* Facebook-style image grid layout */}
                    {galleryImages.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-gray-400 font-bold text-[10px] uppercase text-start">
                          {lang === 'ar' ? 'معرض الصور التوضيحية (انقر للتكبير) 🎥' : 'Quest Image Gallery (tap to preview) 🎥'}
                        </h4>
                        {galleryImages.length === 1 && (
                          <div 
                            className="w-full h-52 sm:h-60 rounded-2xl overflow-hidden shadow-xs cursor-pointer relative bg-gray-50 border border-gray-150/70" 
                            onClick={() => setLightboxImage(galleryImages[0])}
                          >
                            <img src={galleryImages[0]} alt="Quest reference details" className="w-full h-full object-cover hover:scale-[1.012] transition duration-350" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        {galleryImages.length === 2 && (
                          <div className="grid grid-cols-2 gap-2 h-36 sm:h-44 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
                            {galleryImages.map((img, idx) => (
                              <div key={idx} className="h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
                                <img src={img} alt={`Quest detailed ${idx + 1}`} className="w-full h-full object-cover hover:scale-102 transition duration-350" referrerPolicy="no-referrer" />
                              </div>
                            ))}
                          </div>
                        )}
                        {galleryImages.length === 3 && (
                          <div className="grid grid-cols-3 grid-rows-2 gap-2 h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
                            <div className="col-span-2 row-span-2 h-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(galleryImages[0])}>
                              <img src={galleryImages[0]} alt="Quest principal reference" className="w-full h-full object-cover hover:scale-102 transition duration-350" referrerPolicy="no-referrer" />
                            </div>
                            {galleryImages.slice(1, 3).map((img, idx) => (
                              <div key={idx} className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
                                <img src={img} alt={`Quest detailed secondary ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-350" referrerPolicy="no-referrer" />
                              </div>
                            ))}
                          </div>
                        )}
                        {galleryImages.length >= 4 && (
                          <div className="grid grid-cols-3 grid-rows-3 gap-2 h-40 sm:h-48 rounded-2xl overflow-hidden bg-gray-50 border border-gray-150/70">
                            <div className="col-span-2 row-span-3 h-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(galleryImages[0])}>
                              <img src={galleryImages[0]} alt="Quest core graphic reference" className="w-full h-full object-cover hover:scale-102 transition duration-350" referrerPolicy="no-referrer" />
                            </div>
                            {galleryImages.slice(1, 4).map((img, idx) => {
                              const isLast = idx === 2;
                              const extraCount = galleryImages.length - 4;
                              return (
                                <div key={idx} className="col-span-1 row-span-1 h-full w-full cursor-pointer overflow-hidden relative" onClick={() => setLightboxImage(img)}>
                                  <img src={img} alt={`Quest detailed carousel mini ${idx + 2}`} className="w-full h-full object-cover hover:scale-102 transition duration-350" referrerPolicy="no-referrer" />
                                  {isLast && extraCount > 0 && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-black text-xs select-none">
                                      +{extraCount + 1}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}



                    {/* Location Area Details */}
                    <div className="border-t border-gray-150 pt-4 text-start">
                      <h4 className="text-gray-400 font-bold text-[10px] uppercase mb-1">{lang === 'ar' ? 'الموقع الجغرافي للمهمة' : 'Chore Delivery Landmark Location'}</h4>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-700 bg-gray-50 p-3 rounded-2xl border border-gray-150/50">
                        <MapPin className="w-4 h-4 text-[#4FC3F7] shrink-0" />
                        <span>{showDetailedSheet.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Card Details */}
                  <div className="p-6 bg-[#1F2A44] border-t border-white/10 rounded-b-3xl">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[9px] text-[#FFD34D] block font-black uppercase tracking-wider mb-1 text-start">
                            💰 {lang === 'ar' ? 'العائد المالي النقدي الميداني' : 'Direct Cash Payout'}
                          </span>
                          <span className="text-xl sm:text-2xl font-black text-white font-mono flex items-baseline gap-1">
                            {showDetailedSheet.cashReward} <span className="text-xs font-sans text-gray-300 font-semibold">{lang === 'ar' ? 'دينار جزائري' : 'DZD'}</span>
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-gray-300 block font-black uppercase tracking-wider mb-1">
                            ⚡ {lang === 'ar' ? 'رسوم حجز استخدام المنصة' : 'Platform Booking Fee'}
                          </span>
                          <span className="text-sm font-black text-[#FFD34D] font-mono flex items-center justify-end gap-1">
                            {lang === 'ar' ? `سيتم خصم رسوم الحجز: ${tokenAmount} د.ج` : `Booking Fee: ${tokenAmount} DA`}
                          </span>
                        </div>
                      </div>

                      <div className="text-[9.5px] text-gray-300 font-bold leading-relaxed border-t border-white/10 pt-2 text-start">
                        ℹ️ {lang === 'ar' 
                          ? 'الدفع يتم يداً بيد نقداً مائة بالمائة أو عبر تطبيق بريدي موب فور التسليم الميداني. الرصيد يستخدم فقط لدفع رسوم استخدام منصة Quest مثل نشر أو حجز المهام.' 
                          : 'Paid directly in cash or via BaridiMob transfer on completion. Balance is strictly used to pay Quest platform fees for publishing or booking quests.'}
                      </div>

                      <div className="space-y-2 pt-1">
                        {showDetailedSheet.applicants?.some(a => a.userId === userProfile.id) ? (
                          <button
                            disabled
                            className="w-full bg-white/10 text-gray-300 py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center p-2.5 gap-2"
                          >
                            <span className="text-center">{lang === 'ar' ? 'تم تقديم طلبك بنجاح.. في انتظار اختيار صاحب العمل ⏳' : 'Application pending.. Awaiting creator selection ⏳'}</span>
                          </button>
                        ) : (calculateDistanceKm(getQuestCoords(showDetailedSheet).lat, getQuestCoords(showDetailedSheet).lng) > 50) ? (
                          <button
                            disabled
                            className="w-full bg-gray-500 text-gray-200 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                          >
                            <MapPin className="w-4.5 h-4.5 text-gray-200" />
                            <span className="text-center text-[10px] sm:text-xs">
                              هذه المهمة خارج نطاقك الجغرافي المتاح للحجز 📍
                            </span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              handleMapBookClick(showDetailedSheet);
                              setShowDetailedSheet(null);
                            }}
                            className={`w-full py-3.5 rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-center ${
                              isBookedByMe 
                                ? 'bg-emerald-600 text-white shadow-emerald-600/10' 
                                : 'bg-[#FF3B7C] hover:bg-[#FF3B7C]/95 text-white shadow-[#FF3B7C]/25'
                            }`}
                          >
                            <Award className="w-4.5 h-4.5" />
                            <span>
                              {isBookedByMe 
                                ? (lang === 'ar' ? 'أنت تحجز هذه المهمة حالياً' : 'You are currently navigating this quest')
                                : (lang === 'ar' 
                                    ? `احجز المهمة الآن (سيتم خصم رسوم الحجز: ${tokenAmount} د.ج) ⚡` 
                                    : `Book Quest Now (Deduct Fee: ${tokenAmount} DA) ⚡`
                                  )
                              }
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetailedSheet(null)}
                          className="w-full bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
                        >
                          {lang === 'ar' ? 'العودة إلى الخريطة' : 'Back to Live Map'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* GLORIOUS LIGHTBOX PREVIEW */}
        <AnimatePresence>
          {lightboxImage && (
            <div 
              className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 cursor-zoom-out select-none"
              onClick={() => setLightboxImage(null)}
            >
              <button 
                className="absolute top-6 right-6 bg-slate-900/80 text-white p-3 rounded-full hover:bg-slate-800 transition shadow-lg shrink-0 z-30"
                onClick={() => setLightboxImage(null)}
              >
                <X className="w-6 h-6 stroke-[3px]" />
              </button>
              <motion.img 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                src={lightboxImage} 
                alt="Fullscreen focused reference" 
                className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-white/5" 
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </AnimatePresence>

      </div>

      {/* Info notice */}
      <div className="bg-[#1F2A44]/5 border border-[#1F2A44]/10 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-slate-600 font-medium leading-relaxed shrink-0">
        <Info className="w-4.5 h-4.5 text-[#1F2A44] shrink-0 mt-0.5" />
        <p>
          {lang === 'ar' 
            ? 'خريطة صائد الكويستات التفاعلية المباشرة، التي تعتمد على OpenStreetMap وتحدث كل مهام الجزائر في الوقت الفعلي. انقر على الدبابيس لحجز المهام.'
            : 'Interactive Hunt coordinates mapped using live OpenStreetMap layers across the entirety of Algeria. Red is urgent, gold is standard.'}
        </p>
      </div>
    </div>
    </PullToRefresh>
  );
}
