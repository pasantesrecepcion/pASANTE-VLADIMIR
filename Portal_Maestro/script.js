function updateDateTime() {
    const datetimeElement = document.getElementById('current-datetime');
    if (!datetimeElement) return;

    const now = new Date();
    
    // Opciones para el formato de fecha: "Viernes, 10 de Abril de 2026"
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    // Opciones para el formato de hora: "3:30 PM"
    const timeOptions = { 
        hour: 'numeric', 
        minute: 'numeric', 
        hour12: true 
    };

    // Obtenemos los strings formateados en español
    let dateString = now.toLocaleDateString('es-ES', dateOptions);
    let timeString = now.toLocaleTimeString('en-US', timeOptions); // Usamos en-US para forzar el formato PM/AM más limpio a veces, pero manual es más seguro

    // Formateo manual para asegurar la capitalización correcta "Viernes, 10 de Abril de 2026"
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();

    let hours = now.getHours();
    let minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // la hora '0' debe ser '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    const formattedDate = `${dayName}, ${day} de ${monthName} de ${year}`;
    const formattedTime = `${hours}:${minutes} ${ampm}`;

    datetimeElement.textContent = `${formattedDate}, ${formattedTime}`;
}

// Inicializar y actualizar cada minuto (o segundo)
updateDateTime();
setInterval(updateDateTime, 1000); // Actualiza cada segundo para precisión
