import React, { useState, useEffect } from 'react';
import { format, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { Clock, CheckCircle } from 'lucide-react';
import 'react-day-picker/dist/style.css';
import '../styles/agenda.css';

// Mock data generation
const generateSlots = (date) => {
    const slots = [];
    const times = ['09:00', '10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00'];

    if (date.getDay() === 0) return [];

    const dateNum = date.getDate();
    // Deterministic availability
    times.forEach((time, index) => {
        if ((dateNum + index) % 3 !== 0) {
            slots.push({ time, available: true });
        }
    });
    return slots;
};

export default function Agenda({ compact = false }) {
    const today = startOfToday();
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [step, setStep] = useState(1); // 1: Select, 2: Form, 3: Success

    const slots = selectedDate ? generateSlots(selectedDate) : [];

    // Reset slot when date changes
    useEffect(() => {
        if (selectedDate) setSelectedSlot(null);
    }, [selectedDate]);

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);
    };

    return (
        <div className={`agenda-container ${compact ? 'agenda-compact' : ''}`}>

            <div className="agenda-card">
                {!compact && (
                    <div className="agenda-header-internal">
                        <h2>Reserva tu Hora</h2>
                        <p>Calendario de atención online</p>
                    </div>
                )}

                {step === 1 && (
                    <div className={`agenda-grid ${compact ? 'stacked' : ''}`}>

                        {/* Column 1: Calendar */}
                        <div className="calendar-section">
                            <h3 className="step-title">1. Elige un día</h3>
                            <div className="calendar-wrapper">
                                <DayPicker
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    locale={es}
                                    disabled={[{ before: today }, { dayOfWeek: [0] }]}
                                    modifiersClassNames={{
                                        selected: 'my-selected',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Column 2: Slots - Only show if date selected in compact mode for better UX */}
                        <div className={`slots-section ${!selectedDate && compact ? 'dimmed' : ''}`}>
                            <h3 className="step-title">
                                2. Elige una hora
                                {selectedDate && <span className="selected-date-label"> — {format(selectedDate, "d 'de' MMM", { locale: es })}</span>}
                            </h3>

                            <div className="slots-container">
                                {!compact && (
                                    <div className="current-date-header">
                                        <Clock size={18} />
                                        <span>
                                            {selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona un día'}
                                        </span>
                                    </div>
                                )}

                                <div className="slots-grid">
                                    {selectedDate ? (
                                        slots.length > 0 ? (
                                            slots.map((slot) => (
                                                <button
                                                    key={slot.time}
                                                    className={`slot-chip ${selectedSlot === slot.time ? 'active' : ''}`}
                                                    onClick={() => handleSlotSelect(slot.time)}
                                                >
                                                    {slot.time}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="no-slots">
                                                <p>No hay disponibilidad.</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="no-slots">
                                            <p>Selecciona una fecha primero.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                className="continue-btn"
                                disabled={!selectedSlot}
                                onClick={() => setStep(2)}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="form-section fade-in">
                        <h3 className="step-title">3. Tus Datos</h3>

                        <div className="summary-card-mini">
                            <div className="mini-info">
                                <Clock size={16} className="text-primary" />
                                <span>{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })} — {selectedSlot}</span>
                            </div>
                        </div>

                        <form className="booking-form" onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                            <div className="input-group">
                                <label>Nombre Completo</label>
                                <input type="text" required placeholder="Tu nombre" />
                            </div>
                            <div className="input-group">
                                <label>Teléfono (WhatsApp)</label>
                                <input type="tel" required placeholder="+56 9 ..." />
                            </div>
                            <div className="input-group">
                                <label>Motivo de consulta</label>
                                <select>
                                    <option>Dolor de Espalda</option>
                                    <option>Lesión Deportiva</option>
                                    <option>Evaluación General</option>
                                    <option>Terapia Respiratoria</option>
                                    <option>Otro</option>
                                </select>
                            </div>

                            <div className="form-actions simple">
                                <button type="button" className="text-btn" onClick={() => setStep(1)}>Volver</button>
                                <button type="submit" className="primary-btn">Confirmar Reserva</button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="success-view fade-in">
                        <div className="success-animation">
                            <CheckCircle size={60} className="check-icon" />
                        </div>
                        <h3>¡Solicitud Enviada!</h3>
                        <p className="success-desc">
                            Te contactaremos en breves minutos al WhatsApp para confirmar tu hora el <strong>{format(selectedDate, "d/MM", { locale: es })}</strong> a las <strong>{selectedSlot}</strong>.
                        </p>
                        <button className="outline-btn" onClick={() => { setStep(1); setSelectedSlot(null); }}>
                            Nueva Reserva
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
