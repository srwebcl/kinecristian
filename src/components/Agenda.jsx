import React, { useState, useEffect } from 'react';
import { format, startOfToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import { Clock, CheckCircle, MapPin } from 'lucide-react'; // Importamos MapPin
import 'react-day-picker/dist/style.css';
import '../styles/agenda.css';

export default function Agenda({ compact = false }) {
    const today = startOfToday();
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [step, setStep] = useState(1);
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(false);

    // NUEVO ESTADO: Agregamos 'address'
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '', // <--- Nueva variable
        reason: 'Dolor de Espalda'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchSlots = async () => {
            if (!selectedDate) {
                setSlots([]);
                return;
            }
            setLoading(true);
            setSelectedSlot(null);
            try {
                const dateParam = encodeURIComponent(selectedDate.toISOString());
                const response = await fetch(`/api/slots?date=${dateParam}`);
                if (response.ok) {
                    const data = await response.json();
                    setSlots(data);
                } else {
                    setSlots([]);
                }
            } catch (error) {
                console.error("Error fetching slots:", error);
                setSlots([]);
            } finally {
                setLoading(false);
            }
        };
        fetchSlots();
    }, [selectedDate]);

    const handleSlotSelect = (slot) => {
        setSelectedSlot(slot);
    };

    const handleReserve = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: selectedDate,
                    time: selectedSlot,
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email,
                    address: formData.address, // <--- Enviamos la dirección
                    reason: formData.reason
                })
            });

            if (response.ok) {
                setStep(3);
            } else {
                const errorData = await response.json();
                alert(`Error al agendar: ${errorData.error || 'Intenta nuevamente.'}`);
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            alert('Hubo un error de conexión.');
        } finally {
            setIsSubmitting(false);
        }
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
                        <div className="calendar-section">
                            <h3 className="step-title">1. Elige un día</h3>
                            <div className="calendar-wrapper">
                                <DayPicker
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    locale={es}
                                    disabled={[{ before: today }, { dayOfWeek: [0] }]}
                                    modifiersClassNames={{ selected: 'my-selected' }}
                                />
                            </div>
                        </div>

                        <div className={`slots-section ${!selectedDate && compact ? 'dimmed' : ''}`}>
                            <h3 className="step-title">
                                2. Elige una hora
                                {selectedDate && <span className="selected-date-label"> — {format(selectedDate, "d 'de' MMM", { locale: es })}</span>}
                            </h3>
                            <div className="slots-container">
                                {!compact && (
                                    <div className="current-date-header">
                                        <Clock size={18} />
                                        <span>{selectedDate ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es }) : 'Selecciona un día'}</span>
                                    </div>
                                )}
                                <div className="slots-grid">
                                    {loading ? (
                                        <div className="no-slots"><p>Cargando horas...</p></div>
                                    ) : selectedDate ? (
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
                                            <div className="no-slots"><p>No hay disponibilidad.</p></div>
                                        )
                                    ) : (
                                        <div className="no-slots"><p>Selecciona una fecha primero.</p></div>
                                    )}
                                </div>
                            </div>
                            <button className="continue-btn" disabled={!selectedSlot} onClick={() => setStep(2)}>
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

                        <form className="booking-form" onSubmit={handleReserve}>
                            <div className="input-group">
                                <label>Nombre Completo</label>
                                <input type="text" required placeholder="Tu nombre" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Teléfono (WhatsApp)</label>
                                <input type="tel" required placeholder="+56 9 ..." value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                            </div>
                            <div className="input-group">
                                <label>Correo Electrónico</label>
                                <input type="email" required placeholder="ejemplo@correo.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>

                            {/* NUEVO CAMPO DIRECCIÓN */}
                            <div className="input-group">
                                <label>Dirección a Domicilio (Calle, Número, Comuna)</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: Av. del Mar 1234, La Serena"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        style={{ paddingLeft: '2.5rem' }}
                                    />
                                    <MapPin size={18} style={{ position: 'absolute', left: '10px', top: '12px', color: '#94a3b8' }} />
                                </div>
                            </div>

                            <div className="input-group">
                                <label>Motivo de consulta</label>
                                <select value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })}>
                                    <option>Dolor de Espalda</option>
                                    <option>Lesión Deportiva</option>
                                    <option>Evaluación General</option>
                                    <option>Terapia Respiratoria</option>
                                    <option>Otro</option>
                                </select>
                            </div>

                            <div className="form-actions simple">
                                <button type="button" className="text-btn" onClick={() => setStep(1)} disabled={isSubmitting}>Volver</button>
                                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                                    {isSubmitting ? 'Agendando...' : 'Confirmar Reserva'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="success-view fade-in">
                        <div className="success-animation"><CheckCircle size={60} className="check-icon" /></div>
                        <h3>¡Solicitud Enviada!</h3>
                        <p className="success-desc">
                            Hemos enviado la confirmación a <strong>{formData.email}</strong>. Te contactaremos al WhatsApp para coordinar tu llegada a: <strong>{formData.address}</strong>.
                        </p>
                        <button className="outline-btn" onClick={() => {
                            setStep(1);
                            setSelectedSlot(null);
                            setFormData({ name: '', phone: '', email: '', address: '', reason: 'Dolor de Espalda' });
                        }}>
                            Nueva Reserva
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}