import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import {
  MicrophoneIcon,
  SpeakerWaveIcon,
  StopIcon,
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  PauseIcon
} from '@heroicons/react/24/outline';
import MicIcon from '@mui/icons-material/Mic';
import MicNoneIcon from '@mui/icons-material/MicNone';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FaceIcon from '@mui/icons-material/Face';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

const NaamaTalk = () => {
  const { currentUser, getToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [pulsating, setPulsating] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [showWelcomeText, setShowWelcomeText] = useState(true);
  const [audioVisualization, setAudioVisualization] = useState(Array(7).fill(5));
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [waveIntensity, setWaveIntensity] = useState(0);
  const [avatarRotation, setAvatarRotation] = useState(0);
  const [hueRotation, setHueRotation] = useState(0);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioQueueRef = useRef([]);
  const messagesEndRef = useRef(null);
  const avatarRef = useRef(null);
  
  // API Base URL - הגדרת כתובת בסיס ל-API
  const API_BASE_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5001/api' 
    : '/api';
  
  // יצירת מזהה סשן חדש בטעינה
  useEffect(() => {
    const generateSessionId = () => {
      // יצירת מזהה סשן אקראי בתוספת תווים כדי למנוע התנגשויות
      const timestamp = Date.now();
      const randomPart = Math.random().toString(36).substring(2, 10);
      const additionalRandom = Math.random().toString(36).substring(2, 10);
      
      const newId = `session-${timestamp}-${randomPart}-${additionalRandom}`;
      console.log('Generated new session ID:', newId);
      setSessionId(newId);
    };
    
    generateSessionId();
  }, []);
  
  // אירוע להתחלת אודיו בכל אינטראקציה של המשתמש
  useEffect(() => {
    const enableAudio = () => {
      setUserInteracted(true);
      if (!audioEnabled) {
        try {
          // נסה להתחיל את מערכת האודיו
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(err => {
              console.log('Failed to resume AudioContext:', err);
            });
          }
          
          // נסה להתחיל את מערכת ה-TTS
          if ('speechSynthesis' in window) {
            const dummyUtterance = new SpeechSynthesisUtterance('');
            dummyUtterance.volume = 0;
            window.speechSynthesis.speak(dummyUtterance);
          }
          
          setAudioEnabled(true);
        } catch (err) {
          console.error('Error enabling audio:', err);
        }
      }
    };
    
    // הוסף מאזין לאירועים
    document.addEventListener('click', enableAudio);
    document.addEventListener('touchstart', enableAudio);
    
    return () => {
      // הסר את המאזינים בעת פירוק הקומפוננטה
      document.removeEventListener('click', enableAudio);
      document.removeEventListener('touchstart', enableAudio);
    };
  }, [audioEnabled]);

  // גלילה למטה בכל פעם שיש הודעה חדשה
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // איתחול האודיו קונטקסט
  useEffect(() => {
    const setupAudio = async () => {
      try {
        if ('AudioContext' in window || 'webkitAudioContext' in window) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          audioContextRef.current = new AudioContext();
          
          // יוצרים אוסילטור שקט להתחלת האודיו קונטקסט
          if (userInteracted) {
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = 0; // השתקה
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            oscillator.start();
            oscillator.stop(audioContextRef.current.currentTime + 0.001);
          }
        }
      } catch (err) {
        console.error('Error setting up audio context:', err);
      }
    };
    
    if (userInteracted) {
      setupAudio();
    }
    
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => {
          console.error('Error closing audio context:', err);
        });
      }
    };
  }, [userInteracted]);
  
  // איתחול מערכת זיהוי הדיבור
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'he-IL';

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setRecognizedText(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`שגיאה בזיהוי הדיבור: ${event.error}`);
        stopRecording();
      };
    } else {
      setError('הדפדפן שלך אינו תומך בזיהוי דיבור');
    }

    return () => {
      if (recognitionRef.current) {
        stopRecording();
      }
    };
  }, []);

  // התחלת ההקלטה
  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        setError(null);
        setRecognizedText('');
        setUserInteracted(true);
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording:', err);
        setError('שגיאה בהתחלת ההקלטה');
      }
    }
  };

  // עצירת ההקלטה ושליחת הטקסט לשרת
  const stopRecording = async () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
        
        if (recognizedText.trim()) {
          await sendMessage(recognizedText);
        }
      } catch (err) {
        console.error('Failed to stop recording:', err);
        setError('שגיאה בעצירת ההקלטה');
      }
    }
  };

  // שליחת הודעה לשרת
  const sendMessage = async (text) => {
    try {
      setIsProcessing(true);
      setShowWelcomeText(false);
      
      // הוספת ההודעה של המשתמש לשיחה
      addMessage('user', text);
      setRecognizedText('');
      
      const token = await getToken();
      const response = await axios.post(`${API_BASE_URL}/ai/naama-talk`, {
        message: text,
        sessionId
      }, {
        headers: {
          Authorization: token
        }
      });

      if (response.data && response.data.success) {
        // הוספת התשובה של נעמה לשיחה
        const assistantMessage = response.data.reply;
        addMessage('assistant', assistantMessage);
        
        // נגן את התשובה ב-TTS או באמצעות האודיו שהתקבל מהשרת
        if (userInteracted) {
          if (response.data.audioUrl) {
            // השמע את קובץ האודיו שנוצר ע"י OpenAI TTS
            const fullAudioUrl = response.data.audioUrl.startsWith('http') 
              ? response.data.audioUrl 
              : `${window.location.origin}${response.data.audioUrl}`;
              
            console.log('Playing audio from:', fullAudioUrl);
            playAudio(fullAudioUrl);
          } else {
            // השמעה מקומית אם אין קובץ אודיו
            speakText(assistantMessage);
          }
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('שגיאה בשליחת ההודעה');
    } finally {
      setIsProcessing(false);
    }
  };

  // הוספת הודעה לרשימת ההודעות
  const addMessage = (role, content) => {
    const newId = `${role}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => [...prev, {
      id: newId,
      role,
      content,
      timestamp: new Date()
    }]);
  };

  // התחלת שיחה חדשה
  const startNewConversation = async () => {
    try {
      console.log('Starting new conversation...');
      setIsProcessing(true);
      setMessages([]);
      
      // בדיקה ויצירת מזהה סשן חדש אם צריך
      if (!sessionId || sessionId.length < 10) {
        const newRandomId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 10)}-${Math.random().toString(36).substr(2, 10)}`;
        console.log('Using new session ID:', newRandomId);
        setSessionId(newRandomId);
      }
      
      setShowWelcomeText(true);
      
      console.log('Requesting conversation start with session ID:', sessionId);
      const token = await getToken();
      
      // הוספת השהייה קצרה לפני הבקשה
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const response = await axios.post(`${API_BASE_URL}/ai/naama-talk/start`, {
        sessionId: sessionId
      }, {
        headers: {
          Authorization: token
        },
        timeout: 10000 // 10 שניות טיים אאוט
      });

      if (response.data && response.data.success) {
        // הוספת הודעת הפתיחה של נעמה
        const welcomeMessage = response.data.message || 'שלום, אני נעמה, העוזרת האישית שלך. איך אוכל לעזור לך היום?';
        addMessage('assistant', welcomeMessage);
        
        // נגן את הודעת הפתיחה רק אם כבר הייתה אינטראקציה של המשתמש
        if (userInteracted) {
          if (response.data.audioUrl) {
            // השמע את קובץ האודיו שנוצר ע"י OpenAI TTS
            const fullAudioUrl = response.data.audioUrl.startsWith('http') 
              ? response.data.audioUrl 
              : `${window.location.origin}${response.data.audioUrl}`;
              
            console.log('Playing welcome audio from:', fullAudioUrl);
            playAudio(fullAudioUrl);
          } else {
            try {
              speakText(welcomeMessage);
            } catch (err) {
              console.error('TTS not available, continuing without audio', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error starting new conversation:', err);
      
      // בדיקה אם השגיאה היא חוסר מידע עסקי
      if (err.response?.data?.errorCode === 'BUSINESS_INFO_MISSING') {
        setError('יש להגדיר תחילה את פרטי העסק. מעביר אותך לדף הגדרות העסק...');
        
        // הפנייה לדף יצירת העסק
        setTimeout(() => {
          const redirectPath = err.response.data.redirectTo || '/business-setup';
          window.location.href = redirectPath;
        }, 2000);
        
        return;
      }
      
      setError('שגיאה בהתחלת שיחה חדשה. נסה לרענן את הדף.');
      
      // לוודא שהמשתמש לא נשאר תקוע במסך טעינה ריק
      if (messages.length === 0) {
        addMessage('assistant', 'אירעה שגיאה בהתחלת השיחה. אנא לחץ על כפתור הרענון למעלה כדי לנסות שוב.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // משפר את הפונקציה speakText לאנימציה דינמית יותר
  const speakText = useCallback((text) => {
    if (!audioEnabled) return;
    
    setIsSpeaking(true);
    
    // יצירת אנימציות קול מתקדמות יותר
    const audioInterval = setInterval(() => {
      const newVisualization = Array(7).fill(0).map(() => 
        Math.floor(Math.random() * 20) + 5 + (Math.sin(Date.now() / 100) * 3)
      );
      setAudioVisualization(newVisualization);
    }, 100);
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      setIsSpeaking(false);
      clearInterval(audioInterval);
      setAudioVisualization(Array(7).fill(5));
    };
    
    utterance.onerror = (event) => {
      console.error('SpeechSynthesis error:', event);
      setIsSpeaking(false);
      clearInterval(audioInterval);
      setAudioVisualization(Array(7).fill(5));
    };
    
    window.speechSynthesis.speak(utterance);
  }, [audioEnabled]);

  // נגינת אודיו מ-URL - עם שיפורים לטיפול בשגיאות
  const playAudio = async (url) => {
    if (!userInteracted) {
      console.log('Cannot play audio before user interaction');
      return;
    }
    
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      setIsPlaying(true);
      setPulsating(true);
      setIsSpeaking(true);
      
      // ניסיון להוריד את קובץ האודיו
      console.log('Fetching audio from URL:', url);
      
      // תוספת של מספר אקראי כדי למנוע caching
      const cacheBuster = `?t=${Date.now()}`;
      const urlWithCacheBuster = url.includes('?') ? `${url}&_=${cacheBuster}` : `${url}${cacheBuster}`;
      
      const response = await fetch(urlWithCacheBuster, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Received empty audio buffer');
      }
      
      // פענוח הנתונים לאודיו
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer).catch(err => {
        console.error('Error decoding audio data:', err);
        throw new Error('Unable to decode audio data');
      });
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        setPulsating(false);
        setIsSpeaking(false);
      };
      
      source.start();
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsPlaying(false);
      setPulsating(false);
      setIsSpeaking(false);
      
      // במקרה של כישלון בהשמעת האודיו, ננסה להשתמש ב-TTS מקומי
      try {
        console.log('Falling back to browser TTS');
        const messageContent = messages[messages.length - 1]?.content;
        if (messageContent) {
          speakText(messageContent);
        }
      } catch (ttsErr) {
        console.error('Failed to use fallback TTS:', ttsErr);
        setError('לא הצלחנו להשמיע את ההודעה. אנא קרא את הטקסט.');
      }
    }
  };

  // עצירת נגינה
  const stopPlaying = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    setIsPlaying(false);
    setPulsating(false);
  };

  // התחלת האינטראקציה עם המערכת
  const startInteraction = () => {
    setUserInteracted(true);
    setShowWelcomeText(false);
  };

  // התחלת שיחה חדשה בטעינה אם אין הודעות
  useEffect(() => {
    let conversationAttempted = false;
    let attemptTimer = null;
    
    const attemptStartConversation = async () => {
      if (conversationAttempted) return;
      
      if (messages.length === 0 && !isProcessing && sessionId) {
        try {
          conversationAttempted = true;
          console.log('Attempting to start initial conversation with sessionId:', sessionId);
          
          // השהייה קצרה לפני התחלת השיחה הראשונית
          await new Promise(resolve => setTimeout(resolve, 1000));
          await startNewConversation();
        } catch (err) {
          console.error('Failed initial conversation attempt:', err);
          setError('שגיאה בהתחלת שיחה. ניתן לנסות שוב על ידי לחיצה על כפתור הרענון.');
          
          // הודעת מערכת למשתמש
          if (messages.length === 0) {
            addMessage('assistant', 'אירעה שגיאה בהתחלת השיחה. אנא לחץ על כפתור הרענון למעלה כדי לנסות שוב.');
          }
        }
      }
    };
    
    attemptTimer = setTimeout(attemptStartConversation, 1500);
    
    return () => {
      if (attemptTimer) {
        clearTimeout(attemptTimer);
      }
    };
  }, [messages.length, isProcessing, sessionId]);

  // עדכון חזותי של האוואטר
  useEffect(() => {
    if (isSpeaking) {
      const visualInterval = setInterval(() => {
        // עדכון עמודות האודיו
        setAudioVisualization(prev => 
          prev.map(() => Math.floor(Math.random() * 20) + 5)
        );
        
        // עדכון עוצמת הגלים
        setWaveIntensity(Math.random() * 3 + 1);
        
        // סיבוב האוואטר בעדינות
        setAvatarRotation(prev => (prev + (Math.random() * 2 - 1)) % 360);
        
        // שינוי צבע הדרגתי
        setHueRotation(prev => (prev + 0.5) % 360);
      }, 150);
      
      return () => clearInterval(visualInterval);
    } else {
      // איפוס לערכים רגילים כשלא מדברים
      setAudioVisualization(Array(7).fill(5));
      setWaveIntensity(0);
    }
  }, [isSpeaking]);

  // טיפול בהצגת הודעות
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-2" />
            <p>מתחיל שיחה חדשה עם נעמה...</p>
          </div>
        </div>
      );
    }

    return messages.map((message) => (
      <div
        key={message.id}
        className={`mb-4 ${
          message.role === 'user' ? 'self-end' : 'self-start'
        }`}
      >
        <div
          className={`rounded-lg px-4 py-2 max-w-md ${
            message.role === 'user'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white mr-2 shadow-lg'
              : 'bg-gradient-to-r from-purple-700 to-pink-600 text-white ml-2 shadow-lg'
          }`}
        >
          <p>{message.content}</p>
        </div>
        <div
          className={`text-xs text-gray-400 mt-1 ${
            message.role === 'user' ? 'text-left' : 'text-right'
          }`}
        >
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    ));
  };

  return (
    <div className="container mx-auto max-w-4xl">
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl overflow-hidden border border-purple-500">
        <div className="p-4 border-b border-purple-800 bg-gradient-to-r from-purple-900 to-indigo-900 flex justify-between items-center">
          <div className="flex items-center">
            <SpeakerWaveIcon className="h-6 w-6 text-purple-300 ml-2" />
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300">שיחה עם נעמה</h1>
          </div>
          <button
            onClick={() => {
              startInteraction();
              startNewConversation();
            }}
            disabled={isProcessing}
            className="p-2 rounded-full text-purple-300 hover:bg-purple-800 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>

        {/* דמות עגולה של נעמה - משודרגת */}
        <div className="relative">
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <div 
              ref={avatarRef}
              className={`w-36 h-36 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center shadow-2xl ${pulsating ? 'border-pink-400 animate-pulse' : 'border-indigo-600'} transition-all duration-300 relative overflow-hidden avatar-container`}
              onClick={startInteraction}
              style={{
                transform: `rotate(${avatarRotation}deg)`,
                borderWidth: '4px',
                filter: `hue-rotate(${hueRotation}deg)`
              }}
            >
              {/* אור זרקור פנימי */}
              <div className="absolute inset-0 spotlight"></div>
              
              <div className="relative w-28 h-28 rounded-full overflow-hidden bg-black bg-opacity-40 flex flex-col items-center justify-center z-10">
                {/* הוספת אפקטים דינמיים יותר למעגל הדיבור */}
                <div className="speaking-circle-container">
                  <div className={`speaking-circle ${isSpeaking ? 'active' : ''}`}>
                    {isSpeaking && (
                      <>
                        <div className="audio-visualizer">
                          {audioVisualization.map((height, index) => (
                            <div 
                              key={index} 
                              className="audio-column"
                              style={{
                                height: `${height}px`,
                                animation: `pulse 1.5s ease-in-out infinite ${index * 0.1}s`,
                                backgroundColor: `hsl(${200 + (index * 15)}, 70%, 50%)`,
                                boxShadow: `0 0 10px hsl(${200 + (index * 15)}, 70%, 50%)`,
                                transform: `translateY(${Math.sin(Date.now() / 1000 + index) * 3}px)`
                              }}
                            />
                          ))}
                        </div>
                        <div className="tech-circles">
                          {[...Array(3)].map((_, i) => (
                            <div 
                              key={i} 
                              className="tech-circle"
                              style={{
                                animationDelay: `${i * 0.5}s`,
                                opacity: 0.7 - (i * 0.2)
                              }}
                            ></div>
                          ))}
                        </div>
                      </>
                    )}
                    
                    <div className="wave-effect" style={{ opacity: waveIntensity * 0.3 }}></div>
                    <div className="wave-effect delay-1" style={{ opacity: waveIntensity * 0.2 }}></div>
                    
                    <div className={`mic-icon ${isSpeaking ? 'speaking' : ''} ${isRecording ? 'recording' : ''}`}>
                      {isRecording ? <MicIcon /> : isSpeaking ? <VolumeUpIcon /> : <FaceIcon />}
                    </div>
                    
                    {/* גלגלי שיניים סביב האייקון */}
                    {isSpeaking && (
                      <div className="gear-container">
                        <div className="gear gear-1"><SettingsSuggestIcon /></div>
                        <div className="gear gear-2"><SettingsSuggestIcon /></div>
                      </div>
                    )}
                  </div>
                </div>
                
                {showWelcomeText && !userInteracted && (
                  <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
                    <p className="text-xs text-center text-white px-2">לחץ להתחלת <br />השיחה</p>
                  </div>
                )}
              </div>
              
              {/* חלקיקים מעטפת */}
              {isSpeaking && (
                <div className="particles-container">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className="particle"
                      style={{
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        animationDuration: `${Math.random() * 2 + 1}s`,
                        animationDelay: `${Math.random() * 0.5}s`
                      }}
                    ></div>
                  ))}
                </div>
              )}
            </div>
            
            {/* השפעת זיהור מסביב */}
            {pulsating && (
              <div className="absolute inset-0 -z-10">
                <div className="w-36 h-36 rounded-full bg-pink-500 opacity-30 animate-ping"></div>
              </div>
            )}
            
            {/* טבעות היקפיות אנרגיה */}
            {isSpeaking && (
              <div className="energy-rings">
                {[...Array(3)].map((_, i) => (
                  <div 
                    key={i} 
                    className="energy-ring"
                    style={{
                      animationDelay: `${i * 0.3}s`,
                      borderColor: `rgba(${120 + (i * 40)}, 80, 255, ${0.8 - (i * 0.2)})`,
                      width: `${120 + (i * 20)}%`,
                      height: `${120 + (i * 20)}%`
                    }}
                  ></div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col h-[70vh]">
          <div className="flex-1 p-4 pt-44 overflow-y-auto flex flex-col bg-gradient-to-b from-gray-900 to-gray-800">
            {renderMessages()}
            <div ref={messagesEndRef} />
            
            {!userInteracted && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
                <div 
                  className="text-center bg-gradient-to-r from-purple-900 to-indigo-900 p-5 rounded-xl shadow-2xl border border-purple-500 transform hover:scale-105 transition-transform cursor-pointer"
                  onClick={startInteraction}
                >
                  <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 mb-3">
                    ברוכים הבאים לשיחה עם נעמה
                  </h2>
                  <p className="text-white mb-4">לחץ כאן כדי להתחיל בשיחה</p>
                  <div className="inline-block pulse-button bg-gradient-to-r from-purple-600 to-pink-500 p-3 rounded-full">
                    <MicIcon className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-purple-800 p-4 bg-gray-900">
            <div className="mb-2 min-h-10">
              {recognizedText && (
                <p className="text-sm text-purple-300 italic">
                  {recognizedText}
                </p>
              )}
            </div>
            
            <div className="flex items-center justify-center">
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="p-4 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg border-2 border-red-400"
                >
                  <StopIcon className="h-6 w-6" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    startInteraction();
                    startRecording();
                  }}
                  disabled={isProcessing || isPlaying}
                  className="p-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border-2 border-purple-400"
                >
                  <MicIcon className="h-6 w-6" />
                </button>
              )}

              {isPlaying && (
                <button
                  onClick={stopPlaying}
                  className="ml-4 p-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-full shadow-lg border-2 border-gray-500"
                >
                  <PauseIcon className="h-6 w-6" />
                </button>
              )}
            </div>
            
            <div className="text-center mt-3">
              <p className="text-sm text-purple-300">
                {isRecording 
                  ? 'מקליט... לחץ לעצירה' 
                  : isPlaying 
                    ? 'נעמה מדברת... לחץ להפסקה' 
                    : isProcessing 
                      ? 'מעבד...' 
                      : 'לחץ על המיקרופון כדי להתחיל לדבר'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 left-4 bg-purple-900 border-r-4 border-pink-500 text-white px-4 py-3 rounded shadow-md">
          <div className="flex">
            <div className="py-1">
              <svg
                className="h-6 w-6 text-pink-300 ml-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold">שגיאה</p>
              <p className="text-sm">{error}</p>
              <button 
                className="text-sm text-pink-300 hover:text-pink-100 underline mt-1"
                onClick={() => setError(null)}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx="true">{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        .pulse-button {
          animation: pulse-slow 2s infinite;
        }
        
        /* משפר את ה-CSS של האנימציות */
        .audio-visualizer {
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          width: 100%;
          height: 100%;
          gap: 3px;
          z-index: 2;
        }

        .audio-column {
          width: 3px;
          min-height: 5px;
          border-radius: 4px;
          transition: height 0.15s ease-in-out;
        }

        .wave-effect, .wave-effect.delay-1 {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: transparent;
          border: 2px solid rgba(0, 195, 255, 0.3);
          animation: wave 2s infinite;
        }
        
        .wave-effect.delay-1 {
          animation-delay: 0.5s;
        }

        @keyframes wave {
          0% {
            transform: scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.3);
            opacity: 0;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scaleY(1);
          }
          50% {
            transform: scaleY(1.5);
          }
        }
        
        /* אנימציית סיבוב לגלגלי השיניים */
        .gear-container {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        
        .gear {
          position: absolute;
          color: rgba(100, 200, 255, 0.6);
          filter: drop-shadow(0 0 5px rgba(0, 150, 255, 0.8));
        }
        
        .gear-1 {
          top: -5px;
          right: -5px;
          animation: spin 4s linear infinite;
          font-size: 14px;
        }
        
        .gear-2 {
          bottom: -5px;
          left: -5px;
          animation: spin 4s linear infinite reverse;
          font-size: 14px;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* מעגלים טכנולוגיים */
        .tech-circles {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          pointer-events: none;
        }
        
        .tech-circle {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border: 1px dashed rgba(0, 200, 255, 0.5);
          border-radius: 50%;
          animation: tech-spin 10s linear infinite;
        }
        
        @keyframes tech-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* חלקיקים */
        .particles-container {
          position: absolute;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 50%;
          pointer-events: none;
        }
        
        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 50%;
          animation: float-up 2s ease-in infinite;
        }
        
        @keyframes float-up {
          0% {
            transform: translateY(0) scale(0);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(-20px) scale(1);
            opacity: 0;
          }
        }
        
        /* טבעות אנרגיה */
        .energy-rings {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: -1;
        }
        
        .energy-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          border: 1px solid rgba(120, 80, 255, 0.6);
          border-radius: 50%;
          animation: pulse-ring 2s ease-out infinite;
        }
        
        @keyframes pulse-ring {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0;
          }
        }
        
        /* אור זרקור */
        .spotlight {
          background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.2) 0%, transparent 60%);
          mix-blend-mode: overlay;
        }
        
        /* אוואטר */
        .avatar-container {
          box-shadow: 0 0 20px rgba(156, 39, 176, 0.7), 
                      inset 0 0 15px rgba(233, 30, 99, 0.5);
          transition: all 0.3s ease-in-out;
        }
        
        .avatar-container:hover {
          box-shadow: 0 0 25px rgba(156, 39, 176, 0.9), 
                      inset 0 0 20px rgba(233, 30, 99, 0.7);
        }
      `}</style>
    </div>
  );
};

export default NaamaTalk; 