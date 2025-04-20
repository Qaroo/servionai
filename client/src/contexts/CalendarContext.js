import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

// יצירת Context חדש
const CalendarContext = createContext();

// Hook לשימוש בקונטקסט
export const useCalendar = () => useContext(CalendarContext);

// ספק הקונטקסט
export const CalendarProvider = ({ children }) => {
  const { currentUser, getToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [workingHours, setWorkingHours] = useState({
    monday: { start: '09:00', end: '17:00', isActive: true },
    tuesday: { start: '09:00', end: '17:00', isActive: true },
    wednesday: { start: '09:00', end: '17:00', isActive: true },
    thursday: { start: '09:00', end: '17:00', isActive: true },
    friday: { start: '09:00', end: '14:00', isActive: true },
    saturday: { start: '00:00', end: '00:00', isActive: false },
    sunday: { start: '00:00', end: '00:00', isActive: false },
  });
  const [appointmentDuration, setAppointmentDuration] = useState(30); // בדקות

  // הגדרת הקונפיגורציה לבקשות
  const getAuthConfig = async () => {
    const token = await getToken();
    return {
      headers: {
        Authorization: token
      }
    };
  };

  // קבלת הפגישות
  const fetchAppointments = async (startDate, endDate) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/calendar/appointments`, {
        ...config,
        params: { startDate, endDate }
      });

      if (response.data && response.data.success) {
        setAppointments(response.data.appointments);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('שגיאה בטעינת הפגישות');
    } finally {
      setLoading(false);
    }
  };

  // קבלת המשבצות הפנויות
  const fetchAvailableSlots = async (date) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/calendar/available-slots`, {
        ...config,
        params: { date }
      });

      if (response.data && response.data.success) {
        setAvailableSlots(response.data.slots);
      }
    } catch (err) {
      console.error('Error fetching available slots:', err);
      setError('שגיאה בטעינת המשבצות הפנויות');
    } finally {
      setLoading(false);
    }
  };

  // קביעת פגישה חדשה
  const createAppointment = async (appointmentData) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.post(`/api/calendar/appointments`, appointmentData, config);

      if (response.data && response.data.success) {
        // עדכון רשימת הפגישות
        setAppointments(prevAppointments => [...prevAppointments, response.data.appointment]);
        return response.data.appointment;
      }
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('שגיאה ביצירת הפגישה');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // עדכון פגישה קיימת
  const updateAppointment = async (appointmentId, updatedData) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.put(`/api/calendar/appointments/${appointmentId}`, updatedData, config);

      if (response.data && response.data.success) {
        // עדכון רשימת הפגישות
        setAppointments(prevAppointments => 
          prevAppointments.map(appointment => 
            appointment.id === appointmentId ? response.data.appointment : appointment
          )
        );
        return response.data.appointment;
      }
    } catch (err) {
      console.error('Error updating appointment:', err);
      setError('שגיאה בעדכון הפגישה');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // מחיקת פגישה
  const deleteAppointment = async (appointmentId) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.delete(`/api/calendar/appointments/${appointmentId}`, config);

      if (response.data && response.data.success) {
        // הסרת הפגישה מהרשימה
        setAppointments(prevAppointments => 
          prevAppointments.filter(appointment => appointment.id !== appointmentId)
        );
        return true;
      }
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError('שגיאה במחיקת הפגישה');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // קבלת שעות העבודה
  const fetchWorkingHours = async () => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.get(`/api/calendar/working-hours`, config);

      if (response.data && response.data.success) {
        setWorkingHours(response.data.workingHours);
        setAppointmentDuration(response.data.appointmentDuration || 30);
      }
    } catch (err) {
      console.error('Error fetching working hours:', err);
      setError('שגיאה בטעינת שעות העבודה');
    } finally {
      setLoading(false);
    }
  };

  // עדכון שעות העבודה
  const updateWorkingHours = async (newWorkingHours, newDuration) => {
    try {
      setLoading(true);
      setError(null);

      const config = await getAuthConfig();
      const response = await axios.put(`/api/calendar/working-hours`, {
        workingHours: newWorkingHours,
        appointmentDuration: newDuration
      }, config);

      if (response.data && response.data.success) {
        setWorkingHours(newWorkingHours);
        setAppointmentDuration(newDuration);
        return true;
      }
    } catch (err) {
      console.error('Error updating working hours:', err);
      setError('שגיאה בעדכון שעות העבודה');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // טעינת שעות העבודה בהתחלה
  useEffect(() => {
    if (currentUser) {
      fetchWorkingHours();
    }
  }, [currentUser]);

  const value = {
    appointments,
    availableSlots,
    workingHours,
    appointmentDuration,
    loading,
    error,
    fetchAppointments,
    fetchAvailableSlots,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    updateWorkingHours
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
};

export default CalendarContext; 